import pkg from 'lodash';
import jsdom from 'jsdom';
import { install, XPathResultType } from 'wgxpath';
import fetch from 'node-fetch';
import retry from 'async-retry';
import scrape from 'website-scraper';
import SaveToExistingDirectoryPlugin from 'website-scraper-existing-directory';

const { JSDOM } = jsdom;
const { get } = pkg;

/**
 * Extract wikipedia article id from the html of an article
 *
 * @param htmlText
 * @returns {*}
 */
//export const getArticleId = (htmlText) => {
const getArticleId = (htmlText) => {    
  const dom = new JSDOM(htmlText, { includeNodeLocations: true });
  install(dom.window, true);

  const document = dom.window.document;

  // Extract article ID mentioned in the <script> tag in the <head> tag of the page
  const xpathArticleId = "//head/script/text()[contains(., 'wgArticleId')]";
  let expression = document.createExpression(xpathArticleId, null);
  const scriptNodes = expression.evaluate(document, XPathResultType.ANY_TYPE);
  let scriptText = scriptNodes.iterateNext();
  const articleIdRegex = /"wgArticleId":(\d+)/;
  const matchResults = scriptText.textContent.match(articleIdRegex);

  if (matchResults.length < 2) {
    return;
  }
  return matchResults[1];
};

/**
 * Obtain the latest revision ID before the given timestamp for a given article ID
 *
 * @param pageId
 * @param timestamp
 * @returns {Promise<*>}
 */
const getOldIdFromTimestamp = async (pageId, timestamp = '2020-01-31T23:59:59Z') => {    
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.append('action', 'query');
    url.searchParams.append('prop', 'revisions');
    url.searchParams.append('pageids', pageId);
    url.searchParams.append('rvlimit', '1');
    url.searchParams.append('rvdir', 'older');
    url.searchParams.append('format', 'json');
    url.searchParams.append('rvprop', 'timestamp|ids');
    url.searchParams.append('rvstart', timestamp);
  
    let result = null;
    try {
      result = await retry(async () => {
        console.log('getOldIdFromTimestamp Calling fetch with url', url.toString());
        const res = await fetch(url, {
          headers: {
            Accept: "application/json"
          }
        });
        console.log(res.status);
        return await res.json();
      }, {
        retries: 5,
        onRetry: () => console.log("getOldIdFromTimestamp Retrying failed request...")
      });
    } catch (e) {
       console.log(e);
       console.log(`getOldIdFromTimestamp Retry failed 5 times for url ${url.toString()}`);
       throw Error(e);
    }
    return get(result, `query.pages.${pageId}.revisions[0].revid`)
};

/**
 * Crawl HTML using fetch
 *
 * @param pageId
 * @param timestamp
 * @returns {Promise<*>}
 */
//export const getOldIdFromTimestamp = async (pageId, timestamp = '2020-01-31T23:59:59Z') => {
const crawlHtml = async (url, flog) => {
    let result = null;
    try {
      result = await retry(async () => {
        //console.log('crawlHtml: Calling fetch with url', url.toString());
        flog.write(`crawlHtml: Calling fetch with url ${url.toString()}\n`);
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:79.0) Gecko/20100101 Firefox/79.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        //console.log(res.status);
        flog.write(res.status+"\n");
        return await res.text();
      }, { /*
        * settings
        * retries=4, timeout=1, factor=4 (should be middle ground, to be tried)
        * retries=5, timeout=2, factor=2 (has failures (around 5-7 per 1K pages), but relatively faster (around 16 minutes for 4K pages))
        * retries=5, timeout=1, factor=3 (no failures, but could be a bit slow (around 20 minutes for 4K pages))
        */
        retries: 4,
        minTimeout: 1000,
        factor: 4,
        onRetry: () => {
          //console.log("CrawlHtml: Retrying failed request...");
          flog.write("CrawlHtml: Retrying failed request...\n");
        }
      });
    } catch (e) {
       console.log(e);
       //console.log(`CrawlHtml: Retry failed 5 times for url ${url.toString()}`);
       flog.write(`CrawlHtml: Retry failed 5 times for url ${url.toString()}\n`);
       throw Error(e);
    }
    return result;
};

/**
 * Crawl html and required resources of the wikipedia articles corresponding to the specified page ids
 * Save the crawled items in a directory named with the page Id inside the specified directory
 *
 * @param pageIds
 * @param directory
 * @param shouldCloneRevision
 * @returns {Promise<void>}
 */

const clonePages = async (preparedUrls, directory, numThreads) => {

  /* class ExtractExtensionFromPHPResourcePlugin {
    apply (registerAction) {
      let occupiedFilenames, subdirectories, defaultFilename;
  
      registerAction('beforeStart', ({options}) => {
        occupiedFilenames = [];
        subdirectories = options.subdirectories;
        defaultFilename = options.defaultFilename;
      });
      registerAction('generateFilename', ({resource}) => {
        const filename = byTypeFilenameGenerator(resource, {subdirectories, defaultFilename}, occupiedFilenames);
        occupiedFilenames.push(filename);
        return {filename};
      });
    }
  } /*

  /*{
    apply(registerAction) {
      let occupiedFilenames = {}, subdirectories = null, defaultFilename = 'index.html';
      
      registerAction('generateFilename', async ({resource}) => {
        let superParentResource = resource;
        while (superParentResource && superParentResource.parent) {
          superParentResource = superParentResource.parent
        }

        const matchRes = superParentResource.url.match(/\?[^#]*[&?]curid=(\d+)/);
        const pageId = matchRes[1];

        occupiedFilenames[pageId] = occupiedFilenames[pageId] || [];
        console.log("Occupied filenames:1 ", occupiedFilenames);
        const filename = byTypeFilenameGenerator(resource, {subdirectories, defaultFilename}, occupiedFilenames[pageId]);
        console.log("Occupied filenames:2 ", occupiedFilenames);
        occupiedFilenames[pageId].push(filename);

        // Manually fixing the file names of critical js and css resources required to render a crawled wikipage properly.
        // Due to the way wikipedia has implemented how it obtains these resources, they will all have a .php extension
        // if not fixed manually and browser won't identify them when rendering.
        if (!resource.filename && resource.url.indexOf('load.php') >= 0) {
          if(resource.type === 'js' )
            return {filename: `${pageId}/${filename.replace('php', 'js')}`};
          if(resource.type === 'css')
            return {filename: `${pageId}/${filename.replace('php', 'css')}`};
        }
        return {filename: `${pageId}/${filename}`};
      })
    }
  }/*
  /*
  class LoggerPlugin{
      apply(registerAction){
        registerAction('beforeRequest', async ({resource}) => {
            let superParentResource = resource;
            while (superParentResource && superParentResource.parent) {
              superParentResource = superParentResource.parent
            }
            const matchRes = superParentResource.url.match(/\?curid=(\d+)/);
            const pageId = matchRes[1];
            console.log("Started request for pid: ", pageId);
        });
      }
  }
  */

  class ErrorHandlerPlugin {
    apply(registerAction) {
        registerAction('onResourceError', async ({resource, error}) => {
            let superParentResource = resource;
            while (superParentResource && superParentResource.parent) {
              superParentResource = superParentResource.parent
            }
            const matchRes = superParentResource.url.match(/\?[^#]*[&?]curid=(\d+)/);
            const pageId = matchRes[1];
            //console.log("Error occurred for pid: ", pageId);
            console.log("The eror is: ", error);
        });
    }
  }

  const options = {
    urls: preparedUrls,
    directory: `${directory}`,
    /*sources: [
        {selector: 'img', attr: 'src'},
        {selector: 'img', attr: 'srcset'},
        {selector: 'link[rel="stylesheet"]', attr: 'href'},
        {selector: 'script', attr: 'src'},
        {selector: 'style', attr: 'innerHTML' },
        {selector: '[style*="background"]', attr: 'style' },
        {selector: 'link[rel="icon"]', attr: 'href' },
        {selector: 'link[rel="shortcut icon"]', attr: 'href' },
        {selector: 'input#vector-main-menu-dropdown-checkbox', attr: 'id' },
        {selector: 'label#vector-main-menu-dropdown-label', attr: 'for' },
        {selector: '.vector-dropdown-content', attr: 'innerHTML' },
        {selector: '.vector-header-container', attr: 'innerHTML' },
        {selector: 'input#p-lang-btn-checkbox', attr: 'id' },
        {selector: 'label#p-lang-btn-label', attr: 'innerText' },
        {selector: '.interlanguage-link', attr: 'innerHTML' },
        ],*/
    request: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:79.0) Gecko/20100101 Firefox/79.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
    },
    subdirectories: null,
    plugins: [new SaveToExistingDirectoryPlugin(),
      //new ExtractExtensionFromPHPResourcePlugin(), 
      new ErrorHandlerPlugin() ],
    requestConcurrency: numThreads
  };

  await scrape(options);
};

const _getOldIdFromTimestamp = getOldIdFromTimestamp;
export { _getOldIdFromTimestamp as getOldIdFromTimestamp };
const _getArticleId = getArticleId;
export { _getArticleId as getArticleId };
const _crawlHtml = crawlHtml;
export { _crawlHtml as crawlHtml };
const _clonePages = clonePages;
export { _clonePages as clonePages };