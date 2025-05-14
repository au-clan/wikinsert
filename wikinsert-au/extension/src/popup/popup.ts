import {initSearch} from "./search";
import {initMenu} from "./menu";
import {initTargetDisplay} from "./target";
import {initToggleInput} from "./toggle";


document.addEventListener("DOMContentLoaded", () => {
    let wikiLangCode = "";
    let srcTitle = "";
    let pageKey = "";

    // get the page info from the active tab
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
            pageKey = activeTab.url.split("#")[0]
            chrome.tabs.sendMessage(
                activeTab.id!,
                {action: "getPageInfo"},
                (response) => {
                    wikiLangCode = response.lang;
                    srcTitle = response.title;
                }
            );
        }
    });

    // Initialize the target display
    initTargetDisplay(pageKey);


    // Initialize the toggle input
    initToggleInput(pageKey);

    // Initialize the menu
    initMenu();

    // Initialize the search form
    initSearch(pageKey, wikiLangCode, srcTitle);

});

export interface Thumbnail {
    source: string;
    width: number;
    height: number;
}

export interface FilteredArticle {
    title: string;
    lang: string;
    description?: string;
    thumbnail?: Thumbnail;
    revid?: string;
}


