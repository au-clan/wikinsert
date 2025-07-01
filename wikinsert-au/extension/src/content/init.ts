import {HTMLSentenceMapping} from "../types";
import { scopedKey } from "../utils";
import {highlightSentences} from "./highlighting";

export function initStorage() {
    const currentPageKey = location.href.split("#")[0];
    chrome.storage.session.get(
        [scopedKey(currentPageKey, "pageInfo")],
        (res: Record<string, any>) => {
            const pageInfo = res[scopedKey(currentPageKey, "pageInfo")];
        const pageKey = pageInfo.pageKey;
        console.log("Initializing storage for page:", pageKey);
        const keys = [
            scopedKey(pageKey, "highlighted"),
            scopedKey(pageKey, "heatmap"),
            scopedKey(pageKey, "target"),
        ];
        chrome.storage.session.get(keys, (result: Record<string, any>) => {
            const updates: Record<string, any> = {};

            if (result[scopedKey(pageKey, "highlighted")] === undefined) {
                updates[scopedKey(pageKey, "highlighted")] = false;
            }

            if (result[scopedKey(pageKey, "heatmap")] === undefined) {
                updates[scopedKey(pageKey, "heatmap")] = [];
            }

            if (result[scopedKey(pageKey, "target")] === undefined) {
                updates[scopedKey(pageKey, "target")] = "";
            }

            if (Object.keys(updates).length > 0) {
                chrome.storage.session.set(updates);
            }

            const isEnabled = result[scopedKey(pageKey, "highlighted")] === true;
            const target = result[scopedKey(pageKey, "target")] || "";

            chrome.storage.session.get([scopedKey(pageKey, "heatmap")], (result) => {
                const currentHeatMap: HTMLSentenceMapping[] =
                    result[scopedKey(pageKey, "heatmap")] || [];
                if (isEnabled && currentHeatMap.length > 0 && target !== "") {
                    console.log("Restoring highlighting");
                    console.log("Current heatmap:", currentHeatMap);
                    highlightSentences(currentHeatMap, true);
                }
            });
        });
        }
    );
}
