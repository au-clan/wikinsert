const fs = require('fs');

function overlayHeatMap(coloreStore, file_path, outpath){
    
    const htmlText = fs.readFileSync(file_path, 'utf8');
    let coloredhtmlText ;
    coloredhtmlText = "";

    let color, start, end, special, type ;
    let last_end = -1;
    let sent_span;

    for (const loc of coloreStore){

        color = loc.color;
        start = loc.start;
        end = loc.end;
        

        special = loc.special;
        type = loc.missing_category;
        if (special & type == "missing_mention") {
            sent_span = `<span style="border-top: 1px solid red; padding: 1px; border-bottom: 1px solid red; padding: 2px; background-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3);">${htmlText.substring(start, end)}</span>`;
            if (loc.last) {
                sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">--{${loc.link_text}}</span>`;
            }
                //border the span with a red border and set background to color
            //if (loc.underlined) {
            //    sent_span = `<span style="border-top: 1px solid red; padding: 1px; border-bottom: 1px solid red; padding: 2px; text-decoration: underline; color: red; background-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3);">${htmlText.substring(start, end)}</span>`;
            //}
            //else {
            //    sent_span = `<span style="border-top: 1px solid red; padding: 1px; border-bottom: 1px solid red; padding: 2px; background-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3);">${htmlText.substring(start, end)}</span>`;
            //}
        }
        else {
            sent_span = `<span style="background-color: rgb(${color[0]}, ${color[1]}, ${color[2]}, 0.3)">${htmlText.substring(start, end)}</span>`;
        }

        if (special & type == "missing_mention_with_sentence_modification" & loc.last){
            sent_span += `<span style="color: rgb(255, 0, 0)">[${loc.new_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">${loc.new_sentence_parts[1]}]</span>`;
        }
        
        if (special & type == "missing_sentence") {
            sent_span += `<span style="color: rgb(255, 0, 0)">[[${loc.link_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">${loc.link_sentence_parts[1]}]]</span>`;
        }

        if (special & type == "missing_span") {
            sent_span += `<span style="color: rgb(255, 0, 0)">[[[${loc.link_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;"> ${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">${loc.link_sentence_parts[1]}]]]</span>`;
        }
        
    
        coloredhtmlText += htmlText.substring(last_end, start) + sent_span;

        last_end = end;

}
    
    coloredhtmlText += htmlText.substring(last_end, htmlText.length);

    fs.writeFileSync(outpath, coloredhtmlText);    

    return 
}

module.exports.overlayHeatMap = overlayHeatMap;