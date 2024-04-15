function getHeatmapColor(value){
    const color = [[0,0,1], [0,1,0], [1,1,0], [1,0,0]];
    let idx1 = 0, idx2 = 0, fract_between = 0.0;
    if(value <= 0) {
        idx1 = 0; idx2 = 0;
    } else if(value >= 1) {
        idx1 = 3; idx2 = 3;
    } else {
        value *= 3;
        idx1 = parseInt(Math.floor(value)); idx2 = idx1 + 1;
        fract_between = value - parseFloat(idx1);
    }
    red   = (color[idx2][0] - color[idx1][0])*fract_between + color[idx1][0];
    green = (color[idx2][1] - color[idx1][1])*fract_between + color[idx1][1];
    blue  = (color[idx2][2] - color[idx1][2])*fract_between + color[idx1][2];
    return {r:parseInt(red*255), g:parseInt(green*255), b:parseInt(blue*255)};
}

async function overlayHeatMap(sentenceStore, htmlText){
    const reverseSentenceStore = sentenceStore.sort((a, b) => (a.startIdx >= b.endIdx) ? -1 : 1);
    for(const sentObj of reverseSentenceStore){
        // console.log(`${sentObj.startIdx} ${sentObj.endIdx}`);
        // console.log(sentObj.locList);
        // console.log(`Original sentence: ${sentObj.text}`);
        // console.log(`HTML of sentence: ${htmlText.substring(sentObj.startIdx, sentObj.endIdx)}`);
        let color;
        if(sentObj.prob === -1){
            color = {r: 255, g: 255, b: 255};
        }
        else{
            color = getHeatmapColor(sentObj.prob);
        }
        // const r = Math.floor(Math.random()*255), g = Math.floor(Math.random()*255), b =  Math.floor(Math.random()*255);
        for(const loc of sentObj.locList.reverse()){
            htmlText = htmlText.substring(0, loc.start) +
            `<span style="background-color: rgb(${color.r}, ${color.g}, ${color.b}, 0.2)"> ${htmlText.substring(loc.start, loc.end)} </span>` +
            htmlText.substring(loc.end);
        }
    }
    return htmlText;
}
module.exports.getHeatmapColor = getHeatmapColor;
module.exports.overlayHeatMap = overlayHeatMap;