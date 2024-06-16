#!/usr/bin/env node
const { parse, write_sentences_store } = require('./html_processors');
const { spawn } = require('child_process');
const path = require('path');
const args = process.argv.slice(2); // remove first two arguments (node executable path and script file path)
let filePaths = [];
let outputPaths = [];
let lang;
let reader = "";
const pythonScript = 'sbd.py';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-i') {
        // Next arguments are input paths
        reader = "in" ;
    } else if (args[i] === '-o') {
        // Next arguments are output paths
        reader = "out";
    } else if (args[i] === '-l') {
        reader = "lang"
    }
    else {
        if (reader === "in") {
            filePaths.push(args[i]);
        }
        else if (reader === "out") {
            outputPaths.push(args[i]);
        }
        else if (reader === "lang") {
            lang = args[i];
        }
}}

//console.log('filePaths:', filePaths);
//console.log('outputPaths:', outputPaths);

async function runPythonSentencizeScript(pythonScript, commonDir, lang) {
    return new Promise((resolve, reject) => {
        const process = spawn('python', [
            pythonScript,
            '--full_texts_dir', commonDir,
            '--lang', lang,
            '--output_dir', commonDir
        ]);

        let stderrOutput = ''; // To capture stderr output

        // Capture stderr output
        process.stderr.on('data', (data) => {
            stderrOutput += data.toString();
        });

        // Resolve or reject based on process close
        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.log(`Python process exited with code ${code}`);
                console.log(`Error output:\n${stderrOutput}`);
            }
        });
    });
}

async function processFiles(filePaths, outputPaths) {
    const commonDir = path.dirname(outputPaths[0]);
    for (let i = 0; i < Math.min(filePaths.length, outputPaths.length); i++) {
        await parse(filePaths[i], outputPaths[i]); // Use parse function from html_processors.js
        }
        
    await runPythonSentencizeScript(pythonScript, commonDir, lang);

    
    for (let i = 0; i < Math.min(filePaths.length, outputPaths.length); i++) {
        await write_sentences_store(filePaths[i], outputPaths[i]);
    }            
}


processFiles(filePaths, outputPaths)
   