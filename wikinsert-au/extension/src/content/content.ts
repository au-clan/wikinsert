import {openPopup} from "../utils";
import {addWikinsertButtonToNavBar} from "./page-addons";

// A WeakMap for storing each paragraph's original HTML
let originalHTMLMap = new WeakMap<HTMLElement, string>();
chrome.storage.session.set({originalHTMLMap});

// Type definition for Sentence
export type HTMLSentenceMapping = {
    id: number;
    startOffset: number;
    endOffset: number;
    score: number;
};

export type TextNode = {
    node: Text;
    start: number;
    end: number;
};

let heatScoreMin = Infinity;
let heatScoreMax = -Infinity;

chrome.storage.session.set({
    heatScoreMin: heatScoreMin,
    heatScoreMax: heatScoreMax,
});


export const currentPageKey = location.href.split('#')[0];
export let currentHeatMap: HTMLSentenceMapping[] = [];

export function setCurrentHeatMap(heatmap: HTMLSentenceMapping[]) {
    currentHeatMap = heatmap;
}

export const srcTitle = document.getElementsByClassName("mw-page-title-main")[0]?.textContent || "";
export const srcLang = location.hostname.split(".")[0];
export const srcRevId = new URLSearchParams(location.search).get("oldid") || "";


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getPageInfo") {
        sendResponse({title: srcTitle, lang: srcLang});
    }
});

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message.action === "setTarget") {
        chrome.storage.local.set({[`${currentPageKey}-target`]: message.targetTitle});
    }
});

// Add the Wikinsert button to the navigation bar
addWikinsertButtonToNavBar()

// Open the popup when the page is loaded
openPopup();
