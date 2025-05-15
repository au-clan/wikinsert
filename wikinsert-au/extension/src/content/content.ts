import {openPopup} from "../utils";
import {initHighlightListeners} from "./highlighting";
import {initStorage} from "./init";
import {addWikinsertButtonToNavBar} from "./page-addons";


export const originalHTMLMap = new WeakMap<HTMLElement, string>();

const heatScoreMin = Infinity;
const heatScoreMax = -Infinity;

chrome.storage.session.set({
    heatScoreMin: heatScoreMin,
    heatScoreMax: heatScoreMax,
});

const currentPageKey = location.href.split('#')[0];
const srcTitle = document.getElementsByClassName("mw-page-title-main")[0]?.textContent || "";
const srcLang = location.hostname.split(".")[0];
const srcRevId = new URLSearchParams(location.search).get("oldid") || "";
const pageInfo = {
    pageKey: currentPageKey,
    title: srcTitle,
    lang: srcLang,
    revId: srcRevId,
};
chrome.storage.session.set({pageInfo});


chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message.action === "setTarget") {
        chrome.storage.local.set({[`${currentPageKey}-target`]: message.targetTitle}); 
    }
});

initStorage();

initHighlightListeners();

// Add the Wikinsert button to the navigation bar
addWikinsertButtonToNavBar()

// Open the popup when the page is loaded
openPopup();
