import {initSearch} from "./search";
import {initMenu} from "./menu";
import {initTargetDisplay} from "./target";
import {initToggleInput} from "./toggle";
import { scopedKey } from "../utils";

document.addEventListener("DOMContentLoaded", () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) {
        console.error("Cannot determine active tab URL");
        return;
      }
      // Strip off any hash
      const pageKey = tab.url.split("#")[0];
      chrome.storage.session.get(
        [scopedKey(pageKey, "pageInfo")],
        (result) => {
            const pageInfo = result[scopedKey(pageKey, "pageInfo")];
            if (pageInfo) {
                const { pageKey: storedPageKey, lang, title } = pageInfo;
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
        }
    );
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
