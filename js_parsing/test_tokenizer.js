var tokenizer = require('sbd');
const { spawn } = require('child_process');
var text = "México[nota 1]​ ([ˈmexiko]ⓘ), cuyo nombre oficial es Estados Unidos Mexicanos,[13]​ es un país soberano ubicado en la parte meridional de América del Norte; su capital y ciudad más poblada es la Ciudad de México.[14]​ De acuerdo con la constitución vigente, su forma de gobierno consiste en una república representativa, democrática, laica y federal, compuesta por 32 entidades federativas (31 estados y la capital).[15]​[16]​[17]​"
var sentences = tokenizer.sentences(text);
console.log(sentences);
console.log("=============");

var natural = require('natural');
tokenizer = new natural.AggressiveTokenizer();
console.log(tokenizer.tokenize(text));

console.log("=============");
function runPythonScript(text, callback) {
    const pythonProcess = spawn('python', ['nltk_tokenize.py', text]);

    let data = '';
    pythonProcess.stdout.on('data', (chunk) => {
        data += chunk;
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return callback(new Error(`Python script exited with code ${code}`));
        }
        try {
            const result = JSON.parse(data);
            callback(null, result);
        } catch (error) {
            callback(error);
        }
    });
}

// Call the Python script and handle the result
runPythonScript(text, (error, result) => {
    if (error) {
        console.error('Error:', error);
    } else {
        console.log("nltk_tokenize results:");
        console.log(result);
    }
});
