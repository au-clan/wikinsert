import fs from 'fs';
import { PromisePool } from '@supercharge/promise-pool';
import { crawlHtml } from './wiki_utils.js';
import readline from 'readline';
import path from 'path';
import { PerformanceObserver, performance } from 'perf_hooks';

async function main(){
    /* Parsing Command Line Arguments */

    var fname = '';
    var numThreads = 1;
    var directory = '';
    var lang = '';
    process.argv.forEach(function (val, index, array) {
        // update the fname, numThreads, directory variables
        if (val == '-a' || val == '--articles') {
            fname = array[index+1];
        }
        if (val == '-t' || val == '--concurrency') {
            // convert to int
            numThreads = array[index+1];
            numThreads = parseInt(numThreads);
        }
        if (val == '-d' || val == '--destinationDirectory') {
            directory = array[index+1];
        }
        if (val == '-l' || val == '--language') {
            lang = array[index+1];
        }
      });
    
    if (fname == '') {
        console.log('Please provide a file containing a list of articles!');
        return;
    }
    if (directory == '') {
        console.log('Please provide a path to the directory for downloading html!');
        return;
    }
    if (lang == '') {
        console.log('Please provide a language!');
        return;
    }

    if (!fs.existsSync(directory)){
        fs.mkdirSync(directory);
    }
    const timeout = 3000;

    const rl = readline.createInterface({
        input: fs.createReadStream(fname, {encoding: 'utf-8'}),
        terminal: false
    });

    /* Reading articles file synchronously */
    const articles = [];
    const preparedUrls = [];
    try{
        const articleData = fs.readFileSync(fname, 'UTF-8');
        //console.log(articleData);
        const lines = articleData.split(/\r?\n/);
        for (const line of lines){
            if(line !== null && line !== ''){
                const items = line.split(/\t/);
                const article = {
                    // link: anchorNode.href,
                    pid: items[0],
                    revid: items[1],
                };
                articles.push(article);
                preparedUrls.push(`https://${lang}.wikipedia.org/wiki/?curid=${article.pid}&oldid=${article.revid}`);
            }
        }
        // rl.on('line', (line) => {
        //     const items = line.split(/\t/);
        //     console.log(items[0], items[1]);
        //     articleNames.push(items[0]);
        //     articleIds.push(items[1]);
        // });
    } catch (err) {
        console.error(err);
    }
    console.log(articles.length);
    console.log(`Crawling ${preparedUrls.length} articles in directory ${directory}`);

    /*
     * Calling the clonePages() method using request queueing
     */
    /*
    async function getPages(preparedUrls, directory, numThreads, batchSize, timeout=30000){
        const numIter = Math.ceil(preparedUrls.length / batchSize);
        const errorIds = [];
        for(i = 0; i<numIter; i++){
            console.log(`${i}th iteration`);
            let articlesToCrawl = preparedUrls.slice(i*batchSize,Math.min(preparedUrls.length,(i+1)*batchSize));
            await utils.clonePages(articlesToCrawl, directory, numThreads)
            //*
            .catch(err => {
                console.log(err);
                console.log(`Error occurred: Thus, waiting ${timeout/1000} seconds before sending new requests`);
            });
            * /
            console.log(`Waiting ${timeout/1000} seconds before sending new requests`);
            await new Promise(resolve => setTimeout(resolve, timeout));
        }
    }
    await getPages(preparedUrls, directory, numThreads, 1000);
    */

    async function getPages(preparedUrls, directory, numThreads){
        const errorIds = [];
        var flog = fs.createWriteStream(path.resolve(directory,'log.txt'));
        var ferr = fs.createWriteStream(path.resolve(directory,'errors.txt'));
        var count = 0;
        const { results, errors } = await PromisePool  
            .for(preparedUrls)
            .withConcurrency(numThreads)
            .process(async url => {
                const pidMatch = url.match(/\?curid=(\d+)/);
                const pageId = pidMatch[1];
                const revidMatch = url.match(/\&oldid=(\d+)/);
                const revId = revidMatch[1];
                const html = await crawlHtml(url, flog).catch(async (err) => {
                    errorIds.push({pid: pageId, revid: revId});
                    ferr.write(pageId+'\t'+revId+'\n');
                    //await new Promise(resolve => setTimeout(resolve, (30000)));
                });
                fs.writeFile(path.resolve(directory,`${pageId}_${revId}.html`), html, () => { });
                //await new Promise(resolve => setTimeout(resolve, (100)));
                count++;
                if (count % 1000 == 0) {
                    console.log(`${count} articles crawled`);
                }
            })
        ferr.end();
        flog.end();
        return errorIds;
    }

    var t0 = performance.now()    
    const errorIds = await getPages(preparedUrls, directory, numThreads);
    var t1 = performance.now()
    console.log(`Crawling ${preparedUrls.length} articles took ${(t1 - t0)/1000} seconds`);
    console.log(errorIds);
    console.log("yo!");

    //await utils.clonePages(preparedUrls.slice(0,200), directory, numThreads*2);
    // console.log(errorIds.length);
    // errorIds = await getRevIds(errorIds, numThreads);
    // console.log(errorIds.length);
}

main();
