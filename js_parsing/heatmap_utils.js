
function overlayHeatMap(coloreStore, htmlText){
    for (const colorObj of coloreStore){
        const color = getHeatmapColor(colorObj.count);
        for(const loc of colorObj.locList){
            if (loc.special) {
                if (loc.type == "missing_mention") {
                    //border the span
                    htmlText = htmlText.substring(0, loc.start) +
                    `<span style="border: 2px solid rgb(${color.r}, ${color.g}, ${color.b})"> ${htmlText.substring(loc.start, loc.end)} </span>` +
                    htmlText.substring(loc.end); 
                } else {
                    //simply put a red mark at the end in addition to the regular colouring
                    htmlText = htmlText.substring(0, loc.start) +
                    `<span style="background-color: rgb(${color.r}, ${color.g}, ${color.b}, 0.2)"> ${htmlText.substring(loc.start, loc.end)} </span>` +
                    htmlText.substring(loc.end) + `<span style="color: red">[M]</span>`;
                }

            } else {
            htmlText = htmlText.substring(0, loc.start) +
            `<span style="background-color: rgb(${color.r}, ${color.g}, ${color.b}, 0.2)"> ${htmlText.substring(loc.start, loc.end)} </span>` +
            htmlText.substring(loc.end); 
            }
        }
    }

    return htmlText;
}
module.exports.getHeatmapColor = getHeatmapColor;
module.exports.overlayHeatMap = overlayHeatMap;