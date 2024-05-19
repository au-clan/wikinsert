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
        
        if (special & (type == "missing_mention" || type == "missing_mention_in_moved_sentence")) {
            sent_span = `<span style="border-top: 1px solid red; padding: 1px; border-bottom: 1px solid red; padding: 2px; background-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]});">${htmlText.substring(start, end)}</span>`;
            if (loc.last) {
                sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">--{${loc.link_text}}</span>`;
            }

        }
        else 
            {
            if (type != "marker"){
                sent_span = `<span style="background-color: rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})">${htmlText.substring(start, end)}</span>`;
                sent_span += `<span style="color: rgb(255,0,0)">${special},${loc.last},${loc.end_sentence},${loc.end}</span>`
                if (special & loc.last & loc.end_sentence > end) {
                    sent_span += `<span style="color: rgb(255,0,0)">[marked1]</span>`
                    sent_span += htmlText.substring(end, loc.end_sentence);
                    sent_span += `<span style="color: rgb(255,0,0)">[marked2]</span>`
                }
            }
            else {
                sent_span = `<span style="color: rgb(255,0,0)">[sentence_moved_here]</span>`
            }
        }

    
        if (special & (type == "missing_mention_with_sentence_modifications" || type == "missing_mention_in_moved_sentence_with_modifications") & loc.last){
            sent_span += `<span style="color: rgb(255, 0, 0)">[updated-sentence]</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.new_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.new_sentence_parts[1]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">[updated-sentence]</span>`;
        }
        
        if (special & type == "missing_sentence") {
            sent_span += `<span style="color: rgb(255, 0, 0)">[added-sentence]</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.link_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;">${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.link_sentence_parts[1]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">[added-sentence]</span>`;
        }

        if (special & type == "missing_span") {
            sent_span += `<span style="color: rgb(255, 0, 0)">[added-span]</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.link_sentence_parts[0]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0); text-decoration: underline;"> ${loc.link_text}</span>`;
            sent_span += `<span style="color: rgb(0, 0, 0)">${loc.link_sentence_parts[1]}</span>`;
            sent_span += `<span style="color: rgb(255, 0, 0)">[added-span]</span>`;
        }
        
        coloredhtmlText += htmlText.substring(last_end, start) + sent_span;

        if (special & loc.last & loc.end_sentence > end) {
            last_end = loc.end_sentence;
        }
        else {
            last_end = end;
        }

}
    
    coloredhtmlText += htmlText.substring(last_end, htmlText.length);


    fs.writeFileSync(outpath, coloredhtmlText);    

    return 
}

module.exports.overlayHeatMap = overlayHeatMap;