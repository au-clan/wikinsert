const fs = require('fs');

function overlayHeatMap(coloreStore, style, file_path, outpath){
    
    const htmlText = fs.readFileSync(file_path, 'utf8');
    let coloredhtmlText ;
    let color, start, end, special, type ;
    let last_end = 0;
    for (const loc of coloreStore){

        color = loc.color;
        start = loc.start;
        end = loc.end;
        special = loc.special;
        type = loc.type;
        if (special & type == "missing_mention") {
                //border the span with a red border and set background to color
                sent_span = `<span style="border: 3px solid red; padding: 2px;> <span style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]}, 0.3)"> ${htmlText.substring(start, end)} </span> </span>`;
            }
        else {
            sent_span = `<span style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]}, 0.3)"> ${htmlText.substring(start, end)} </span>`;
        }
        
        if (loc.special & loc.type != "missing_mention") {
            //simply put a red mark at the end in addition to the regular colouring
            sent_span += `<span style="background-color: rgb(255, 0, 0, 0.7)"> ... </span>`;
        }
        
        coloredhtmlText = coloredhtmlText + htmlText.substring(last_end, start) + sent_span;

        last_end = end;
    
    }

    coloredhtmlText = coloredhtmlText + htmlText.substring(last_end, htmlText.length);

    fs.writeFileSync(outpath, coloredhtmlText);    

    return 
}

module.exports.overlayHeatMap = overlayHeatMap;