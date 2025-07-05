import {openPopup, scopedKey} from "../utils";
import {addWikinsertButtonToNavBar, floatingInfoDisplay} from "./page-addons";
import {initHighlightListeners} from "./highlighting";
import {initStorage} from "./init";

export const originalHTMLMap = new WeakMap<HTMLElement, string>();

const currentPageKey = location.href.split("#")[0];

const srcTitle =
    document.getElementsByClassName("mw-page-title-main")[0]?.textContent || "";
const srcLang = location.hostname.split(".")[0];
const srcRevId = new URLSearchParams(location.search).get("oldid") || "";
const pageInfo = {
  pageKey: currentPageKey,
  title: srcTitle,
  lang: srcLang,
  revId: srcRevId,
};
chrome.storage.session.set({
  [scopedKey(currentPageKey, "pageInfo")]: pageInfo,
});

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  if (message.action === "setTarget") {
    chrome.storage.session.set({
      [scopedKey(currentPageKey, "target")]: message.targetTitle || "",
      [scopedKey(currentPageKey, "targetDescription")]: message.targetDescription || "",
      [scopedKey(currentPageKey, "targetUrl")]: message.targetUrl || "",
    });
  }
});

initStorage();

initHighlightListeners();

// Add the Wikinsert button to the navigation bar
addWikinsertButtonToNavBar();

// Open the popup when the page is loaded
openPopup();

floatingInfoDisplay();