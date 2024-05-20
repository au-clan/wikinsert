#!/usr/bin/env node

const fs = require('fs');
const { JSDOM } = require('jsdom');
const { parse } = require('./html_processors');
const wgxpath = require('wgxpath');
const path = require('path'); 
const tokenizer = require('sbd');
const md5 = require('md5');
const S = require('string');
const { stderr } = require('process');

const args = process.argv.slice(2); // remove first two arguments (node executable path and script file path)
let filePaths = [];
let outputPaths = [];

let reader = "";

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-i') {
        // Next arguments are input paths
        reader = "in" ;
    } else if (args[i] === '-o') {
        // Next arguments are output paths
        reader = "out";
    }
    else {
        if (reader === "in") {
            filePaths.push(args[i]);
        }
        else if (reader === "out") {
            outputPaths.push(args[i]);
        }
}}

//console.log('filePaths:', filePaths);
//console.log('outputPaths:', outputPaths);

async function processFiles(filePaths, outputPaths) {
    const results = [];
    let startTime;
    let endTime;
    for (let i = 0; i < Math.min(filePaths.length, outputPaths.length); i++) {
        startTime = performance.now();
        try {
            const result = await parse(filePaths[i], outputPaths[i]); // Use parse function from html_processors.js
            results.push(result);
            endTime = performance.now();
            if ((i % 20 === 0) && (i > 0)) {
            //console.log(`Time taken to process ${i} files: ${endTime - startTime} ms \n`);
            }
            else {
                //console.log(`Time taken to process ${i} files: ${endTime - startTime} ms \n`);
            }
        } catch (error) {
            //console.error(`Error parsing ${filePaths[i]}: ${error}`);
        }
        
    }
    return results;
}

processFiles(filePaths, outputPaths)
    .then(results => {
        //console.log('All files processed successfully.');
    })
    .catch(error => {
        //console.error('Error processing files:', error);
    });