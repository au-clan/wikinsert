import fs from 'fs'
import path from 'path';

import { clonePages } from '/scratch/boulenge/wikinsert/crawler/wiki_utils.js';


const args = process.argv.slice(2); // remove first two arguments (node executable path and script file path)

let titles = [];
let curids = [];
let oldids = [];
let directory = "";

let reader = "";

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-p') {
        reader = "path"
    } else if (args[i] === '-t') {
        // Next arguments are input paths
        reader = "title" ;
    } else if (args[i] === '-c') {
        // Next arguments are output paths
        reader = "curid";
    }
    else if (args[i] === '-o') {
        // Next arguments are output paths
        reader = "oldid";
    }
    else {
        if (reader === "path") {
          directory = args[i];
        }
        if (reader === "title") {
            titles.push(args[i]);
        }
        else if (reader === "curid") {
            curids.push(args[i]);
        }
        else if (reader === "oldid") {
            oldids.push(args[i]);
        }
}}

if (titles.length !== curids.length || titles.length !== oldids.length) {
    console.error('Number of titles, curids and oldids should be the same');
    process.exit(1);
}

let preparedUrls = [];

for (let i = 0; i < titles.length; i++) {
    let title = titles[i];
    let curid = curids[i];
    let oldid = oldids[i];
    preparedUrls.push(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title)}&curid=${curid}&oldid=${oldid}`);
}

if (preparedUrls.length === 0) {
    console.error('No URLs to clone');
    process.exit(1);
}

(async () => {
    const numThreads = 5;

    // Ensure the output directory exists
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    try {
        //console.log('Cloning pages...');
        await clonePages(preparedUrls, directory, numThreads);
        //console.log(`Cloning pages done, saved in ${directory}`);
    } catch (error) {
        console.error('Error cloning pages:', error);
    }
})();

