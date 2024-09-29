const fs = require('fs');
const { overlayHeatMap } = require('./heatmap_utils.js');

const colorStore = process.argv[2];
const rawHtmlFilePath = process.argv[3];
const outputPath = process.argv[4];

// Assuming colorStore is a JSON string; otherwise, you will need to parse it properly
const colorStoreObject = JSON.parse(colorStore);

console.log(outputPath)
overlayHeatMap(colorStoreObject, rawHtmlFilePath, outputPath);
