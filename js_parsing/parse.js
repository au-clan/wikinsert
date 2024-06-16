#!/usr/bin/env node
const {parse} = require('./html_processors');
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

for (let i = 0; i < Math.min(filePaths.length, outputPaths.length); i++) {
    await parse(filePaths[i], outputPaths[i]); // Use parse function from html_processors.js
    }

   