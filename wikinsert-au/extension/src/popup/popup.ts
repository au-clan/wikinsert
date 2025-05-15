import {initSearch} from "./search";
import {initMenu} from "./menu";
import {initTargetDisplay} from "./target";
import {initToggleInput} from "./toggle";

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.session.get("pageInfo", (result) => {
        if (result.pageInfo) {
            const {pageKey: storedPageKey, lang, title} = result.pageInfo;
            // Initialize the target display
            initTargetDisplay(storedPageKey);

            // Initialize the toggle input
            initToggleInput(storedPageKey);

            // Initialize the menu
            initMenu();

            // Initialize the search form
            initSearch(storedPageKey, lang, title);
        } else {
            console.error("Page info not found in session storage");
        }
    });
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
