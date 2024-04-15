// const jsdom = require("jsdom");
// const jsdom = require("jsdom-no-css");
const wgxpath = require('wgxpath');
const fs = require('fs');
const path = require('path'); 
const tokenizer = require('sbd');
const md5 = require('md5');
const S = require('string');
const { JSDOM } = require('jsdom');
//const wgxpath = require('wicked-good-xpath')

const HTML_CHAR_ENTITIES = {
    '38': '&amp;',
    '60': '&lt;',
    '62': '&gt;',
    '160': '&nbsp;'
};
const XPATH_CONDITIONS = {
    NOT_STARTS_WITH_NON_NS_0: "not(starts-with(@href, '/wiki/Talk:')) and\n    not(starts-with(@href, '/wiki/talk:')) and\n    not(starts-with(@href, '/wiki/User:')) and\n    not(starts-with(@href, '/wiki/user:')) and\n    not(starts-with(@href, '/wiki/User talk:')) and\n    not(starts-with(@href, '/wiki/user talk:')) and\n    not(starts-with(@href, '/wiki/Wikipedia:')) and\n    not(starts-with(@href, '/wiki/wikipedia:')) and\n    not(starts-with(@href, '/wiki/Wikipedia talk:')) and\n    not(starts-with(@href, '/wiki/wikipedia talk:')) and\n    not(starts-with(@href, '/wiki/File:')) and\n    not(starts-with(@href, '/wiki/file:')) and\n    not(starts-with(@href, '/wiki/File talk:')) and\n    not(starts-with(@href, '/wiki/file talk:')) and\n    not(starts-with(@href, '/wiki/MediaWiki:')) and\n    not(starts-with(@href, '/wiki/mediawiki:')) and\n    not(starts-with(@href, '/wiki/MediaWiki talk:')) and\n    not(starts-with(@href, '/wiki/mediawiki talk:')) and\n    not(starts-with(@href, '/wiki/Template:')) and\n    not(starts-with(@href, '/wiki/template:')) and\n    not(starts-with(@href, '/wiki/Template talk:')) and\n    not(starts-with(@href, '/wiki/template talk:')) and\n    not(starts-with(@href, '/wiki/Help:')) and\n    not(starts-with(@href, '/wiki/help:')) and\n    not(starts-with(@href, '/wiki/Help talk:')) and\n    not(starts-with(@href, '/wiki/help talk:')) and\n    not(starts-with(@href, '/wiki/Category:')) and\n    not(starts-with(@href, '/wiki/category:')) and\n    not(starts-with(@href, '/wiki/Category talk:')) and\n    not(starts-with(@href, '/wiki/category talk:')) and\n    not(starts-with(@href, '/wiki/Portal:')) and\n    not(starts-with(@href, '/wiki/portal:')) and\n    not(starts-with(@href, '/wiki/Portal talk:')) and\n    not(starts-with(@href, '/wiki/portal talk:')) and\n    not(starts-with(@href, '/wiki/Draft:')) and\n    not(starts-with(@href, '/wiki/draft:')) and\n    not(starts-with(@href, '/wiki/Draft talk:')) and\n    not(starts-with(@href, '/wiki/draft talk:')) and\n    not(starts-with(@href, '/wiki/TimedText:')) and\n    not(starts-with(@href, '/wiki/timedtext:')) and\n    not(starts-with(@href, '/wiki/TimedText talk:')) and\n    not(starts-with(@href, '/wiki/timedtext talk:')) and\n    not(starts-with(@href, '/wiki/Module:')) and\n    not(starts-with(@href, '/wiki/module:')) and\n    not(starts-with(@href, '/wiki/Module talk:')) and\n    not(starts-with(@href, '/wiki/module talk:')) and\n    not(starts-with(@href, '/wiki/Book:')) and\n    not(starts-with(@href, '/wiki/book:')) and\n    not(starts-with(@href, '/wiki/Book talk:')) and\n    not(starts-with(@href, '/wiki/book talk:')) and\n    not(starts-with(@href, '/wiki/Education Program:')) and\n    not(starts-with(@href, '/wiki/education program:')) and\n    not(starts-with(@href, '/wiki/Education Program talk:')) and\n    not(starts-with(@href, '/wiki/education program talk:')) and\n    not(starts-with(@href, '/wiki/Gadget:')) and\n    not(starts-with(@href, '/wiki/gadget:')) and\n    not(starts-with(@href, '/wiki/Gadget talk:')) and\n    not(starts-with(@href, '/wiki/gadget talk:')) and\n    not(starts-with(@href, '/wiki/Gadget definition:')) and\n    not(starts-with(@href, '/wiki/gadget definition:')) and\n    not(starts-with(@href, '/wiki/Gadget definition talk:')) and\n    not(starts-with(@href, '/wiki/gadget definition talk:')) and\n    not(starts-with(@href, '/wiki/Special:')) and\n    not(starts-with(@href, '/wiki/special:')) and\n    not(starts-with(@href, '/wiki/Media')) and\n    not(starts-with(@href, '/wiki/media')) and\n    not(starts-with(@href, '/wiki/Image')) and\n    not(starts-with(@href, '/wiki/image'))"
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

function findSections(document,dom) {
    
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
    sectionNodes2Offset.push({'start':0, 'section':'lead'});

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
function extractSentences(htmlText, dom, document, sectionMap){ //extractSentences(dom, htmlText, outDir, article) {
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

    let expression = document.createExpression(xpathAllText, null);
    const textNodes = expression.evaluate(document, wgxpath.XPathResultType.ANY_TYPE);
    //console.log(JSDOM.fragment(htmlText).textContent);

    //const fdata = fs.createWriteStream(path.resolve(outDir,article.id+'_sentences.json'));
    //const fsentences = fs.createWriteStream(path.resolve(outDir,article.id+'_sentences.txt'));
    let textNode = textNodes.iterateNext();
    let allText = "";
    let textNodeId = 0;
    let textNodes2Offset = [];

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

    sentences = tokenizer.sentences(allText, {"newline_boundaries":true});
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

    for(sentence of sentences){
        // if(numLines>5){
        //     break;
        // }
        //console.log(`Annotated sentence: ${sentence}`);
        firstControl = sentence.match(/<<[O|C]\d+>>/);
        lastControl = sentence.match(/<<[O|C]\d+>>(?!.*<<[O|C]\d+>>)/);
        //console.log(firstControl[0], lastControl[0]);
        if(firstControl && firstControl[0].includes('<<O')){
            //console.log("First node is O");
            startNode = firstControl[0].match(/<<O(\d+)>>/)[1];
            relPos2Start = 0;
        } else {
            //console.log("First node is either C or Null")
            startNode = currentNode;
            relPos2Start = relPos2End;
        }
        if(lastControl){
            if(lastControl[0].includes('<<C')){
                //console.log("Last node is C");
                endNode = (lastControl[0].match(/<<C(\d+)>>/)[1])+"+";
                relPos2End = 0;
            } else { // control character is O
                //console.log("Last node is O", relPos2Start);
                currentNode = lastControl[0].match(/<<O(\d+)>>/)[1];
                endNode = currentNode+"-";
                relPos2End = sentence.length - (lastControl.index + lastControl[0].length);
            }
        } else { // control character is NULL
            //console.log("Last node is null", relPos2Start);
            relPos2End += sentence.length;
        }
        const origSentence = sentence.replace(/<<[C|O]\d+>>/g,'');
        if(origSentence === ''){
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
        if(startNodeNum === endNodeNum){
            if(endNode.includes('-')){
                locList.push({start: textNodes2Offset[startNodeNum].start + parseInt(relPos2Start), end: textNodes2Offset[endNodeNum].start + parseInt(relPos2End)});
            } else{
                locList.push({start: textNodes2Offset[startNodeNum].start + parseInt(relPos2Start), end: textNodes2Offset[endNodeNum].end + parseInt(relPos2End)});
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
        const sentObj = {
            md5: md5(origSentence),
            id: numLines,
            text: origSentence,
            startIdx: startIdx+numLeadingSpaces,
            endIdx: endIdx+numLeadingSpaces,
            section: getSection(sectionMap, endIdx),
            locList: locList
        };
        if(numLines>0){
            sentObj.startIdx = Math.max(sentenceStore[numLines-1].endIdx, sentObj.startIdx);
        }
        sentenceStore.push(sentObj);
        //fdata.write(JSON.stringify(sentObj)+"\n");
        //sentences.write(sentObj.text+"\n");
        //console.log("\n\n");
        numLines++;
    }
    //fdata.end();
    //fsentences.end();
    //process.stdout.write(JSON.stringify(sentenceStore));
return sentenceStore ;
}

function extractLinks(htmlText, dom, document, sectionMap, sentenceStore){//(dom, outDir, article, sentenceStore){
    // let dom = new JSDOM(htmlText, { includeNodeLocations: true });
    // htmlText = dom.serialize();
    // dom = new JSDOM(htmlText, { includeNodeLocations: true });
    
    const xpathAnchor = `//div[@id='mw-content-text']//a[
    not(img) and
    not(ancestor-or-self::table) and
    starts-with(@href, '/wiki/') and
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

    expression = document.createExpression(xpathAnchor, null);
    const anchorNodes = expression.evaluate(document, wgxpath.XPathResultType.ANY_TYPE);

   

    //const flink = fs.createWriteStream(path.resolve(outDir,article.id+'_link2sent.tsv'));
    let anchorNode = anchorNodes.iterateNext();
    let linkStore = [], link, anchorStart, anchorEnd;

    let sentid;

    while (anchorNode) {
        //console.log(anchorNode.textContent);
        //console.log(anchorNode.href);
        anchorStart = dom.nodeLocation(anchorNode).startOffset;
        anchorEnd = dom.nodeLocation(anchorNode).endOffset;
       link = anchorNode.href;
       text = anchorNode.textContent;
 
        //console.log("Anchor node from html: ",htmlText.substring(dom.nodeLocation(anchorNode).startOffset,dom.nodeLocation(anchorNode).endOffset));
        for(const sentObj of sentenceStore){
            if(anchorStart >= sentObj.startIdx && anchorEnd <= sentObj.endIdx){
                sentid = sentObj.id;
            }
        }  
        
        const linkObj = {
            // link: anchorNode.href,
            link: link,
            startIdx: anchorStart,
            text: text,
            endIdx: anchorEnd,
            section: getSection(sectionMap, anchorEnd),
            sentid : sentid
        };

        sentid = null;

        linkStore.push(linkObj);
        anchorNode = anchorNodes.iterateNext();

    }

    //flink.end();

    return linkStore;
}

function parse(filePath){

    const htmlText = fs.readFileSync(filePath, 'utf-8');

    let dom = new JSDOM(htmlText, { includeNodeLocations: true });
    let document = dom.window.document;
    let sectionMap = findSections(document, dom);

    const sentenceStore = extractSentences(htmlText, dom, document, sectionMap);

    const linkStore = extractLinks(htmlText, dom, document, sectionMap, sentenceStore);

    const sentences = JSON.stringify(sentenceStore);
    const links = JSON.stringify(linkStore);

    return {sentences, links};
}

module.exports.parse = parse;