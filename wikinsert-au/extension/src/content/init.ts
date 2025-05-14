import {currentHeatMap, currentPageKey, HTMLSentenceMapping, setCurrentHeatMap} from "./content";
import {highlightSentences} from "./highlighting";

const keys = [
    currentPageKey,
    `${currentPageKey}-heatmap`,
    `${currentPageKey}-target`,
    "density",
];

interface StorageResult {
    [key: string]: any;
}

chrome.storage.local.get(keys, (result: StorageResult) => {
    const updates: StorageResult = {};

    if (result[currentPageKey] === undefined) {
        updates[currentPageKey] = false;
    }

    if (result[`${currentPageKey}-heatmap`] === undefined) {
        updates[`${currentPageKey}-heatmap`] = [];
    } else {
        setCurrentHeatMap(result[`${currentPageKey}-heatmap`] as HTMLSentenceMapping[])
    }

    if (result[`${currentPageKey}-target`] === undefined) {
        updates[`${currentPageKey}-target`] = "";
    }

    if (result["density"] === undefined) {
        updates["density"] = 50; // Default density value
    }

    if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
    }

    const isEnabled = result[currentPageKey] === true;
    const target = result[`${currentPageKey}-target`] || "";

    if (isEnabled && currentHeatMap.length > 0 && target !== "") {
        console.log("Restoring highlighting");
        console.log("Current heatmap:", currentHeatMap);
        highlightSentences(currentHeatMap);
    }
});