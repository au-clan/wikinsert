import {HTMLSentenceMapping} from "../types";
import {highlightSentences} from "./highlighting";

export function initStorage() {
    chrome.storage.session.get(["pageInfo"], ({pageInfo}) => {
        const pageKey = pageInfo.pageKey;
        const keys = [
            `${pageKey}-highlighted`,
            `${pageKey}-heatmap`,
            `${pageKey}-target`,
            "density",
        ];
        chrome.storage.local.get(keys, (result: Record<string, any>) => {
            const updates: Record<string, any> = {};

            if (result[`${pageKey}-highlighted`] === undefined) {
                updates[`${pageKey}-highlighted`] = false;
            }

            if (result[`${pageKey}-heatmap`] === undefined) {
                updates[`${pageKey}-heatmap`] = [];
            }

            if (result[`${pageKey}-target`] === undefined) {
                updates[`${pageKey}-target`] = "";
            }

            if (result["density"] === undefined) {
                updates["density"] = 50; // Default density value
            }

            if (Object.keys(updates).length > 0) {
                chrome.storage.local.set(updates);
            }

            const isEnabled = result[`${pageKey}-highlighted`] === true;
            const target = result[`${pageKey}-target`] || "";

            chrome.storage.local.get([`${pageKey}-heatmap`], (result) => {
                const currentHeatMap: HTMLSentenceMapping[] =
                    result[`${pageKey}-heatmap`] || [];
                if (isEnabled && currentHeatMap.length > 0 && target !== "") {
                    console.log("Restoring highlighting");
                    console.log("Current heatmap:", currentHeatMap);
                    highlightSentences(currentHeatMap);
                }
            });
        });
    });
}
