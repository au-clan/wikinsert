// const jsdom = require("jsdom");
// const jsdom = require("jsdom-no-css");
const wgxpath = require('wgxpath');
const fs = require('fs');
const tokenizer = require('sbd');
const md5 = require('md5');
const S = require('string');
const { JSDOM } = require('jsdom');
const { stderr } = require('process');
const { time } = require('console');
//const wgxpath = require('wicked-good-xpath')

const HTML_CHAR_ENTITIES = {
    '38': '&amp;',
    '60': '&lt;',
    '62': '&gt;',
    '160': '&nbsp;'
};
const XPATH_CONDITIONS = {
    NOT_STARTS_WITH_NON_NS_0: `not(contains(@href, '/wiki/Talk:')) and
        not(contains(@href, '/wiki/talk:')) and
        not(contains(@href, '/wiki/User:')) and
        not(contains(@href, '/wiki/user:')) and
        not(contains(@href, '/wiki/User talk:')) and
        not(contains(@href, '/wiki/user talk:')) and
        not(contains(@href, '/wiki/Wikipedia:')) and
        not(contains(@href, '/wiki/wikipedia:')) and
        not(contains(@href, '/wiki/Wikipedia talk:')) and
        not(contains(@href, '/wiki/wikipedia talk:')) and
        not(contains(@href, '/wiki/File:')) and
        not(contains(@href, '/wiki/file:')) and
        not(contains(@href, '/wiki/File talk:')) and
        not(contains(@href, '/wiki/file talk:')) and
        not(contains(@href, '/wiki/MediaWiki:')) and
        not(contains(@href, '/wiki/mediawiki:')) and
        not(contains(@href, '/wiki/MediaWiki talk:')) and
        not(contains(@href, '/wiki/mediawiki talk:')) and
        not(contains(@href, '/wiki/Template:')) and
        not(contains(@href, '/wiki/template:')) and
        not(contains(@href, '/wiki/Template talk:')) and
        not(contains(@href, '/wiki/template talk:')) and
        not(contains(@href, '/wiki/Help:')) and
        not(contains(@href, '/wiki/help:')) and
        not(contains(@href, '/wiki/Help talk:')) and
        not(contains(@href, '/wiki/help talk:')) and
        not(contains(@href, '/wiki/Category:')) and
        not(contains(@href, '/wiki/category:')) and
        not(contains(@href, '/wiki/Category talk:')) and
        not(contains(@href, '/wiki/category talk:')) and
        not(contains(@href, '/wiki/Portal:')) and
        not(contains(@href, '/wiki/portal:')) and
        not(contains(@href, '/wiki/Portal talk:')) and
        not(contains(@href, '/wiki/portal talk:')) and
        not(contains(@href, '/wiki/Draft:')) and
        not(contains(@href, '/wiki/draft:')) and
        not(contains(@href, '/wiki/Draft talk:')) and
        not(contains(@href, '/wiki/draft talk:')) and
        not(contains(@href, '/wiki/TimedText:')) and
        not(contains(@href, '/wiki/timedtext:')) and
        not(contains(@href, '/wiki/TimedText talk:')) and
        not(contains(@href, '/wiki/timedtext talk:')) and
        not(contains(@href, '/wiki/Module:')) and
        not(contains(@href, '/wiki/module:')) and
        not(contains(@href, '/wiki/Module talk:')) and
        not(contains(@href, '/wiki/module talk:')) and
        not(contains(@href, '/wiki/Book:')) and
        not(contains(@href, '/wiki/book:')) and
        not(contains(@href, '/wiki/Book talk:')) and
        not(contains(@href, '/wiki/book talk:')) and
        not(contains(@href, '/wiki/Education Program:')) and
        not(contains(@href, '/wiki/education program:')) and
        not(contains(@href, '/wiki/Education Program talk:')) and
        not(contains(@href, '/wiki/education program talk:')) and
        not(contains(@href, '/wiki/Gadget:')) and
        not(contains(@href, '/wiki/gadget:')) and
        not(contains(@href, '/wiki/Gadget talk:')) and
        not(contains(@href, '/wiki/gadget talk:')) and
        not(contains(@href, '/wiki/Gadget definition:')) and
        not(contains(@href, '/wiki/gadget definition:')) and
        not(contains(@href, '/wiki/Gadget definition talk:')) and
        not(contains(@href, '/wiki/gadget definition talk:')) and
        not(contains(@href, '/wiki/Special:')) and
        not(contains(@href, '/wiki/special:')) and
        not(contains(@href, '/wiki/Media')) and
        not(contains(@href, '/wiki/media')) and
        not(contains(@href, '/wiki/Image')) and
        not(contains(@href, '/wiki/image'))
`
        };

/**
 * Convert parsed HTML character entities used in wikipedia text to their corresponding HTML representations
 *
 * @param string
 * @returns {string}
 */
const convertToHTMLChars = string => {
    let c, i = 0;
    let result = '';
    while(!isNaN(c = string.charCodeAt(i))) {
      const mapping = HTML_CHAR_ENTITIES[c.toString()];
      if (!mapping) {
        result += string.charAt(i);
      } else {
        result += mapping;
      }
      i++;
    }
    return result;
};

function createRangeMap(data) {
    let rangeMap = {};
    for (let i = 0; i < data.length; i++) {
        let current = data[i];
        let next = data[i + 1];
        let end = next ? next.start : Infinity;
        rangeMap[current.section] = { start: current.start, end: end };
    }
    return rangeMap;
}

function getSection(rangeMap, input) {
    for (let section in rangeMap) {
        let range = rangeMap[section];
        if (input >= range.start && input < range.end) {
            return section;
        }
    }
    return null; // No section found for the input
}

async function findSections(document, dom) {
    
    const xpathSections = `//div[@id='mw-content-text']//h2[
        not(ancestor-or-self::noscript) and 
        not(ancestor-or-self::style) and 
        not(ancestor-or-self::cite) and
        not(ancestor-or-self::script) and
        not(ancestor-or-self::table) and
        not(ancestor::div[
            contains(@class, "thumb") or 
            contains(@role, "navigation") or 
            contains(@class, "navbox") or 
            contains(@class, "toc") or 
            contains(@class, "reflist") or
            contains(@class, "printfooter") or
            contains(@class, "soslink") or
            contains(@style, "float:")]
        )
    ]`;
    

    let section_expression = document.createExpression(xpathSections, null);
    const sectionNodes = section_expression.evaluate(document, wgxpath.XPathResultType.ANY_TYPE);
    let sectionNode = sectionNodes.iterateNext();
    let sectionNodeId = 0;
    let sectionNodes2Offset = [];
    sectionNodes2Offset.push({'start':0, 'section':'Lead'});

    while (sectionNode) {
        const sectionLocation = dom.nodeLocation(sectionNode);
        const section = convertToHTMLChars(sectionNode.textContent);
        //console.log(`Found section ${section} at location ${sectionLocation.startOffset} to ${sectionLocation.endOffset}`);
        sectionNodes2Offset.push({'start':sectionLocation.startOffset, 'section':section});
        sectionNode = sectionNodes.iterateNext();
        sectionNodeId++;
    }

    
    let rangeMap = createRangeMap(sectionNodes2Offset);

    return rangeMap;
}

/**
 * Extracts sentences with their index from HTML
 *
 * @param htmlText
 * @returns {Promise<*>}
 */
async function extractSentences(htmlText, dom, document, sectionMap){ //extractSentences(dom, htmlText, outDir, article) {
    // let dom = new JSDOM(htmlText, { includeNodeLocations: true });
    // htmlText = dom.serialize();
    
    const xpathAllText = `//div[@id='mw-content-text']//text()[
        not(ancestor-or-self::noscript) and
        not(ancestor-or-self::*/@class='mw-headline') and
        not(ancestor-or-self::style) and 
        not(ancestor-or-self::cite) and
        not(ancestor-or-self::script) and
        not(ancestor-or-self::table) and
        not(ancestor::div[
            contains(@class, "thumb") or 
            contains(@role, "navigation") or 
            contains(@class, "navbox") or 
            contains(@class, "toc") or 
            contains(@class, "reflist") or
            contains(@class, "printfooter") or
            contains(@class, "soslink") or
            contains(@style, "float:")
        ]
    )
    ]`; 


    start_time = performance.now();
    let expression = document.createExpression(xpathAllText, null);
    const textNodes = expression.evaluate(document, wgxpath.XPathResultType.ANY_TYPE);
    //console.log(JSDOM.fragment(htmlText).textContent);

    //const fdata = fs.createWriteStream(path.resolve(outDir,article.id+'_sentences.json'));
    //const fsentences = fs.createWriteStream(path.resolve(outDir,article.id+'_sentences.txt'));
    let textNode = textNodes.iterateNext();
    let allText = "";
    let textNodeId = 0;
    let textNodes2Offset = [];

    time_to_xpath = performance.now();

    while (textNode) {
        const textLocation = dom.nodeLocation(textNode);
        //const text = htmlText.substring(textLocation.startOffset, textLocation.endOffset)
        const text = convertToHTMLChars(textNode.textContent);
        // if(text === '\n'){
        //     textNode = textNodes.iterateNext();
        //     continue;
        // }
        allText += "<<O"+textNodeId+">>"+text+"<<C"+textNodeId+">>";
        textNodes2Offset.push({'start':textLocation.startOffset,'end':textLocation.endOffset});
        //console.log(`Found text ${text} at location ${textLocation.startOffset} to ${textLocation.endOffset}`);
        textNode = textNodes.iterateNext();
        textNodeId++;
    }

    time_to_find_nodes = performance.now();

    sentences = tokenizer.sentences(allText, {"newline_boundaries":true});

    time_to_tokenize = performance.now();

    numLines = 0;
    let sentenceStore = [];
    let startNode;
    let endNode;
    let currentNode;
    let relPos2Start;
    let relPos2End;
    let startIdx, endIdx;
    let firstControl, lastControl;
    let numLeadingSpaces = 0;
    let numLeadingSpacesFirst = 0;

    for(sentence of sentences){
        // if(numLines>5){
        //     break;
        // }
        //console.log(`Annotated sentence: ${sentence}`);
        firstControl = sentence.match(/<<[O|C]\d+>>/); //first occurence of <<0 textNodeId>> or <<C textNodeId>>
        lastControl = sentence.match(/<<[O|C]\d+>>(?!.*<<[O|C]\d+>>)/); //last occurence of <<0 textNodeId>> or <<C textNodeId>>
        //console.log(`Controls: ${firstControl[0]}, ${lastControl[0]}`);


        if(firstControl && firstControl[0].includes('<<O')){ //case sentence contains a control and it's first is the control of start of node
            //console.log("First node is O");
            startNode = firstControl[0].match(/<<O(\d+)>>/)[1]; //First node Id of the sentence
            relPos2Start = 0; 
        } else {  //case sentence does not contain a control character or its first control character is the control of end of a node 
            //console.log("First node is either C or Null")
            startNode = currentNode;
            relPos2Start = relPos2End;
        }
        if(lastControl){ //case sentence contains a control
            if(lastControl[0].includes('<<C')){ //case last control is the control of end of node
                //console.log("Last node is C");
                endNode = (lastControl[0].match(/<<C(\d+)>>/)[1])+"+";
                relPos2End = 0;
            } else { // case last control is the control of start of node
                //console.log("Last node is O")//, relPos2Start);
                currentNode = lastControl[0].match(/<<O(\d+)>>/)[1];
                endNode = currentNode+"-";
                relPos2End = sentence.length - (lastControl.index + lastControl[0].length);
            }
        } else { // case sentence does not contain a control character, i.e start witihn a node and end within the same node
            //console.log("Last node is null", relPos2Start);
            relPos2End += sentence.length + 1; //+ because substring(start,end) is exclusive at end 
        }
        const origSentence = sentence.replace(/<<[C|O]\d+>>/g,'');
        if(origSentence === ''){
            //console.log("Empty sentence");
            continue;
        }
        //console.log(`Original Sentence: ${origSentence}`);
        //console.log(`${startNode} ${relPos2Start} ${endNode} ${relPos2End}`);
        //startIdx = textNodes2Offset[parseInt(startNode)].start + parseInt(relPos2Start) + numLeadingSpaces;
        startIdx = textNodes2Offset[parseInt(startNode)].start + parseInt(relPos2Start);
        if(endNode.includes('-')){
            //endIdx = textNodes2Offset[parseInt(endNode)].start + parseInt(relPos2End) + numLeadingSpaces;
            endIdx = textNodes2Offset[parseInt(endNode)].start + parseInt(relPos2End);
        }
        else{
            //endIdx = textNodes2Offset[parseInt(endNode)].end + parseInt(relPos2End) + numLeadingSpaces;
            endIdx = textNodes2Offset[parseInt(endNode)].end + parseInt(relPos2End);
        }
        //console.log(startIdx, endIdx);
        htmlSentence = htmlText.substring(startIdx, endIdx);
        numLeadingSpaces = htmlSentence.search(/\S|$/);
        //console.log(numLeadingSpaces);
        //console.log(`HTML of sentence: ${htmlText.substring(startIdx+numLeadingSpaces, endIdx+numLeadingSpaces)}`);
        let locList = [];
        const startNodeNum = parseInt(startNode), endNodeNum = parseInt(endNode);
        if(startNodeNum === endNodeNum){ //case no inner node 
            if(endNode.includes('-')){
                locList.push({start: textNodes2Offset[startNodeNum].start + parseInt(relPos2Start), end: textNodes2Offset[startNodeNum].start + parseInt(relPos2End)});
            } else{
                locList.push({start: textNodes2Offset[startNodeNum].start + parseInt(relPos2Start), end: textNodes2Offset[startNodeNum].end + parseInt(relPos2End)});
            }

        } else{
            locList.push({start: textNodes2Offset[startNodeNum].start + parseInt(relPos2Start), end: textNodes2Offset[startNodeNum].end});
            for(i = startNodeNum+1; i<endNodeNum; i++){
                const loc = {
                    start: textNodes2Offset[i].start,
                    end: textNodes2Offset[i].end
                };
                locList.push(loc);
            }
            if(endNode.includes('-')){
                locList.push({start: textNodes2Offset[endNodeNum].start, end: textNodes2Offset[endNodeNum].start + parseInt(relPos2End)});
            }
            else{
                locList.push({start: textNodes2Offset[endNodeNum].start, end: textNodes2Offset[endNodeNum].end + parseInt(relPos2End)});
            }
        }

        if(numLines>0){
            let new_startIdx = Math.max(sentenceStore[numLines-1].endIdx, startIdx);       
            startIdx = new_startIdx;
        }
        
        numLeadingSpacesFirst = htmlText.substring(locList[0].startIdx, locList[0].endIdx).search(/\S/);
        locList[0].start += numLeadingSpacesFirst;

        //add space at the end of the sentence if possible
        //check if the character after locList[locList.length-1].end is a space/newline, while it is, increment locList[locList.length-1].end

        //let endChar = htmlText.substring(locList[locList.length-1].end, locList[locList.length-1].end+1);
        
        //while(endChar === ' ' || endChar === '\n'){
        //    locList[locList.length-1].end++;
        //    endChar = htmlText.substring(locList[locList.length-1].end, locList[locList.length-1].end+1);
        //}
        
        //Removing elements where start and end are the same
        locList = locList.filter(loc => loc.start !== loc.end);


        const sentObj = {
            md5: md5(origSentence),
            id: numLines,
            text: origSentence,
            startIdx: startIdx+numLeadingSpaces,
            endIdx: endIdx+numLeadingSpaces,
            section: getSection(sectionMap, endIdx),
            locList: locList
        };

        sentenceStore.push(sentObj);
                

        //fdata.write(JSON.stringify(sentObj)+"\n");
        //sentences.write(sentObj.text+"\n");
        //console.log("\n\n");
        numLines++;
    }

    time_to_find_sub_indexes = performance.now();

    //fdata.end();
    //fsentences.end();
    //process.stdout.write(JSON.stringify(sentenceStore));

//console.log(reconst);

console.log('sentences');
console.log(`Time to xpath: ${time_to_xpath - start_time} ms`);
console.log(`Time to find nodes: ${time_to_find_nodes - time_to_xpath} ms`);
console.log(`Time to tokenize: ${time_to_tokenize - time_to_find_nodes} ms`);
console.log(`Time to find sub indexes: ${time_to_find_sub_indexes - time_to_tokenize} ms`);
console.log(`End of sentences`);

return sentenceStore ;
}

async function extractLinks(dom, document, sectionMap, sentenceStore){//(dom, outDir, article, sentenceStore){
    // let dom = new JSDOM(htmlText, { includeNodeLocations: true });
    // htmlText = dom.serialize();
    // dom = new JSDOM(htmlText, { includeNodeLocations: true });
    
    const xpathAnchor = `//div[@id='mw-content-text']//a[
    not(img) and
    not(ancestor-or-self::noscript) and
    not(ancestor-or-self::*/@class='mw-headline') and
    not(ancestor-or-self::style) and 
    not(ancestor-or-self::cite) and
    not(ancestor-or-self::script) and
    not(ancestor-or-self::table) and
    contains(@href, '/wiki/') and
    not(ancestor::div[
        contains(@class, "thumb") or 
        contains(@role, "navigation") or 
        contains(@class, "navbox") or 
        contains(@class, "toc") or 
        contains(@class, "reflist") or
        contains(@class, "printfooter") or
        contains(@class, "soslink") or
        contains(@style, "float:")]) and
    ${XPATH_CONDITIONS.NOT_STARTS_WITH_NON_NS_0}
    ]`;

    start_time = performance.now();

    expression = document.createExpression(xpathAnchor, null);
    const anchorNodes = expression.evaluate(document, wgxpath.XPathResultType.ANY_TYPE);

    time_to_xpath = performance.now();

    //const flink = fs.createWriteStream(path.resolve(outDir,article.id+'_link2sent.tsv'));
    let anchorNode = anchorNodes.iterateNext();
    let linkStore = [], link, anchorStart, anchorEnd;

    let sentid_;

    while (anchorNode) {
        //console.log(anchorNode.textContent);
        //console.log(anchorNode.href);
        anchorStart = dom.nodeLocation(anchorNode).startOffset;
        anchorEnd = dom.nodeLocation(anchorNode).endOffset;
       link = anchorNode.href;
       text = anchorNode.textContent;
 
        //console.log("Anchor node from html: ",htmlText.substring(dom.nodeLocation(anchorNode).startOffset,dom.nodeLocation(anchorNode).endOffset));
        for(const sentObj of sentenceStore){
            if(anchorEnd >= sentObj.startIdx && anchorEnd <= sentObj.endIdx){
                sentid_ = sentObj.id;
            }
        }  
        
        const linkObj = {
            // link: anchorNode.href,
            link: link,
            startIdx: anchorStart,
            text: text,
            endIdx: anchorEnd,
            section: getSection(sectionMap, anchorEnd),
            sentid : sentid_
        };


        linkStore.push(linkObj);
        anchorNode = anchorNodes.iterateNext();
        sentid_ = null;
    }

    time_to_find_links = performance.now();

    //flink.end();
    console.log('links')
    console.log(`Time to xpath: ${time_to_xpath - start_time} ms`);
    console.log(`Time to find links: ${time_to_find_links - time_to_xpath} ms`);
    console.log(`End of links`);


    return linkStore;
}

async function parse(filePath, outPath){

    let start_time =  performance.now();
    const htmlText = fs.readFileSync(filePath, 'utf-8');

    let time_to_open  = performance.now();

    let dom = new JSDOM(htmlText, { includeNodeLocations: true, url: "file:" });
    
    let time_to_dom = performance.now();

    let document = dom.window.document;

    let time_to_document = performance.now();

    let sectionMap = await findSections(document, dom);

    let time_to_sections = performance.now();

    const sentenceStore = await extractSentences(htmlText, dom, document, sectionMap);

    let time_to_sentences = performance.now();

    const linkStore = await extractLinks(dom, document, sectionMap, sentenceStore);

    let time_to_links = performance.now();

    const sentences = JSON.stringify(sentenceStore);

    let time_to_sentences_json = performance.now();

    const links = JSON.stringify(linkStore);

    let time_to_links_json = performance.now();

    //Write as a jsonl in outPath
    const sentencesPath = outPath + '_sentences.jsonl';
    const linksPath = outPath + '_links.jsonl';
    fs.writeFileSync(sentencesPath, sentences)
    fs.writeFileSync(linksPath, links)

    let time_to_write = performance.now();

    console.log(`Time to open file: ${time_to_open - start_time} ms`);
    console.log(`Time to create dom: ${time_to_dom - time_to_open} ms`);
    console.log(`Time to create document: ${time_to_document - time_to_dom} ms`);
    console.log(`Time to find sections: ${time_to_sections - time_to_document} ms`);
    console.log(`Time to extract sentences: ${time_to_sentences - time_to_sections} ms`);
    console.log(`Time to extract links: ${time_to_links - time_to_sentences} ms`);
    console.log(`Time to write sentences json: ${time_to_sentences_json - time_to_links} ms`);
    console.log(`Time to write links json: ${time_to_links_json - time_to_sentences_json} ms`);
    console.log(`Time to write to files: ${time_to_write - time_to_links_json} ms`);

}

module.exports.parse = parse;