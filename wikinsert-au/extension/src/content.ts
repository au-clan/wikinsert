// A WeakMap for storing each paragraph's original HTML
let originalHTMLMap = new WeakMap<HTMLElement, string>();
// Type definition for Sentence
type HTMLSentenceMapping = {
  id: number;
  startOffset: number;
  endOffset: number;
  score: number;
};

type TextNode = {
  node: Text;
  start: number;
  end: number;
};

// Track dynamic score range for heatmap normalization
let heatScoreMin = Infinity;
let heatScoreMax = -Infinity;


const xpathText = `//div[@id='mw-content-text']//text()[
  not(ancestor-or-self::noscript) and
  not(ancestor-or-self::h2) and
  not(ancestor-or-self::h3) and
  not(ancestor-or-self::*/@class='mw-headline') and
  not(ancestor-or-self::*/@class='mw-headline mw-heading2') and
  not(ancestor-or-self::style) and 
  not(ancestor-or-self::cite) and
  not(ancestor-or-self::script) and
  not(ancestor-or-self::table) and
  not(ancestor-or-self::img) and
  not(ancestor-or-self::figure) and
  not(ancestor-or-self::sup) and
  not(ancestor-or-self::*/@class='mw-editsection') and
  not(ancestor-or-self::*/@class='mw-bandeau') and
  not(ancestor-or-self::*/@class='reflist') and
  not(ancestor-or-self::*/@class='map') and
  not(ancestor::div[
      contains(@class, "js-interprojects") or
      contains(@class, "galleryext") or
      contains(@class, "mw-headline") or
      contains(@class, "thumb") or 
      contains(@role, "navigation") or 
      contains(@role, "note") or
      contains(@class, "navbox") or 
      contains(@class, "toc") or 
      contains(@class, "reflist") or
      contains(@class, "printfooter") or
      contains(@class, "soslink") or
      contains(@style, "float:") or
      contains(@style, "display:none") or
      contains(@class, "bandeau") or
      contains(@class, "infobox") or
      contains(@class, "references") or
      contains(@class, "side-box") or
      contains(@class, "plainlinks") or
      contains(@class, "sisterbox") or
      contains(@class, "references")
  ])
]
`;
addWikinsertButtonToNavBar()

const currentPageKey = location.href.split('#')[0];
let currentHeatMap: HTMLSentenceMapping[] = [];

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
        currentHeatMap = result[`${currentPageKey}-heatmap`] as HTMLSentenceMapping[];
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

const srcTitle = document.getElementsByClassName("mw-page-title-main")[0]?.textContent || "hello";
const srcLang = location.hostname.split(".")[0];
// scrRevId is the oldid query parameter in the url
const srcRevId = new URLSearchParams(location.search).get("oldid") || "0";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
      sendResponse({title: srcTitle, lang: srcLang});
  }
});

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener(
  (message: { action: string }, sender, sendResponse): void => {
    if (message.action === "highlight") {
        //remove first
        removeHighlighting();
      const start = performance.now();
        chrome.storage.local.get([`${currentPageKey}-target`], (result) => {
            const targetTitle = result[`${currentPageKey}-target`];
            chrome.runtime.sendMessage(
                {
                    action: "getHeatMap",
                    srcRevId: srcRevId,
                    srcTitle: srcTitle,
                    targetTitle: targetTitle,
                    lang: srcLang,
                },
                (response: HTMLSentenceMapping[]) => {
                    if (response) {
                        console.log("Sentences received:", response);
                        currentHeatMap = response;
                        // store the heatmap in local storage
                        chrome.storage.local.set({[`${currentPageKey}-heatmap`]: currentHeatMap});
                        // Compute dynamic range of scores for normalization
                        highlightSentences(currentHeatMap);
                    } else {
                        console.warn("No sentences returned");
                    }
                }
            );
        });

        chrome.storage.local.set({[currentPageKey]: true});
      console.log("Highlighting applied in", performance.now() - start, "ms");
    } else if (message.action === "remove") {
      console.log("Removing highlighting");
      removeHighlighting();
        chrome.storage.local.set({[currentPageKey]: false});
        chrome.storage.local.remove(`${currentPageKey}-heatmap`);
    }
  }
);

/**
 *  * Cache the original <p> innerHTML for later restoration.
 */
function storeOriginalParagraphHTML(container: HTMLElement) {
    container
        .querySelectorAll<HTMLParagraphElement>("p")
        .forEach((p) => {
            if (!originalHTMLMap.has(p)) {
                originalHTMLMap.set(p, p.innerHTML);
            }
        });
}

/**
 * Highlights every sentence *once* by walking the text nodes only a single
 * time. Sentences are processed from the end of the article to the start so
 * that DOM mutations never invalidate the pre‑computed global offsets.
 */
function highlightSentences(sentences: HTMLSentenceMapping[]): void {
    heatScoreMin = Math.min(...sentences.map((s) => s.score));
    heatScoreMax = Math.max(...sentences.map((s) => s.score));
    chrome.storage.local.get("density", (result) => {
        const density = result.density as number;
        const filteredSentences = filterTopDensitySentences(sentences, density);

        const contentContainer = document.getElementById("mw-content-text");
        if (!contentContainer) {
            console.error("Content container not found");
            return;
        }

    // Remember the pristine HTML so removeHighlighting() can restore it fast.
    storeOriginalParagraphHTML(contentContainer);

    // Snapshot all eligible text nodes *before* we mutate the DOM.
    const textNodes = getTextNodesIn();

    // Work from back to front to keep the global‑offset mapping valid.
        const ordered = filteredSentences
            .slice()
            .sort((a, b) => b.startOffset - a.startOffset);

    ordered.forEach((sentence) => wrapRangeInContainer(sentence, textNodes));
    });
}


/**
 * Wraps a sentence range in a <span> with a highlight.
 */
function wrapRangeInContainer(
  sentence: HTMLSentenceMapping,
  textNodes: TextNode[]
): void {
  const { startOffset, endOffset, score, id } = sentence;

  for (const node of textNodes) {
    if (node.node.length === 0) {
      continue;
    }

    if (node.end <= startOffset) {
      continue;
    }
    if (node.start >= endOffset) {
      break;
    }

    const localStart = Math.max(startOffset, node.start);
    const localEnd = Math.min(endOffset, node.end);

    const startInNode = localStart - node.start;
    const endInNode = localEnd - node.start;


    if (startInNode < endInNode) {
      const range = document.createRange();
      range.setStart(node.node, startInNode);
      range.setEnd(node.node, endInNode);

      const span = document.createElement("span");
      span.className = "sentence-span";
      span.id = `sentence-${id}`;
      span.style.backgroundColor = getHeatColor(score);

      // Extract the matching text and wrap it in a span
      const extracted = range.extractContents();
      span.appendChild(extracted);
      range.insertNode(span);
    }
  }

}


/**
 * Removes highlighting by restoring each paragraph’s original HTML.
 */
function removeHighlighting(): void {
  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }

  container.querySelectorAll<HTMLParagraphElement>("p").forEach((paragraph) => {
    if (originalHTMLMap.has(paragraph)) {
      paragraph.innerHTML = originalHTMLMap.get(paragraph)!;
    }
  });

  // Fallback: Ensure all spans are removed in case original HTML restoration fails
  document.querySelectorAll(".sentence-span").forEach((span) => {
    span.replaceWith(...span.childNodes);
  });

  // Clear the stored original HTML
  originalHTMLMap = new WeakMap();
}

/**
 * Returns an array of text nodes with their global offsets.
 */
function getTextNodesIn(): TextNode[] {
  const nodes: TextNode[] = [];
  let expression = document.createExpression(xpathText, null);
  const textNodes = expression.evaluate(document, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
  let globalOffset = 0
  let currentNode = textNodes.iterateNext() as Text | null;

  while (currentNode) {
    const text = currentNode.textContent || "";
    if (text.trim() === "") {
      currentNode = textNodes.iterateNext() as Text | null;
      continue;
    }

    const start = globalOffset;
    const end = globalOffset + text.length;
      nodes.push({node: currentNode, start, end});
    globalOffset = end;
    currentNode = textNodes.iterateNext() as Text | null;
  }
  return nodes;
}

/**
 * Generates a heat-based HSL red color.
 */
function getHeatColor(heat: number): string {
    // Normalize heat value between 0 and 1
    const norm = heatScoreMax > heatScoreMin
        ? (heat - heatScoreMin) / (heatScoreMax - heatScoreMin)
        : 0;
    // Generate an HSL red color based on normalized score
  return `hsl(0, ${70 + norm * 20}%, ${95 - norm * 30}%)`;
}

/**
 *
 * function getHeatColor(heat: number): string {
 const norm = heatScoreMax > heatScoreMin
 ? (heat - heatScoreMin) / (heatScoreMax - heatScoreMin)
 : 0;

 // Hue gradually moves from Yellow (50°) → Red (0°)
 const hue = 50 - (50 * norm);

 // Saturation smoothly increases from 0% (white) to 100% (fully colored)
 const saturation = norm * 100;

 // Lightness gradually decreases from 95% (white/pale) to 50% (strong/darker color)
 const lightness = 95 - (45 * norm);

 return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
 }
 */

function addWikinsertButtonToNavBar() {
  const vectorMenuContentList = document.querySelector("#p-views .vector-menu-content-list")
  if (!vectorMenuContentList) {
    console.log("No vector menu to add wikinsert button to")
    return
  }

  const wikinsertVectorMenuItem = document.createElement("li")
  wikinsertVectorMenuItem.id = "ca-wikinsert"
  wikinsertVectorMenuItem.className = "vector-tab-noicon mw-list-item"

    const wikinsertLink = document.createElement("a")
  wikinsertLink.href = "#"

    const wikinsertSpan = document.createElement("span")
  wikinsertSpan.textContent = "Wikinsert"
    wikinsertLink!.onclick = (e) => {
        e.preventDefault()
        openPopup()
    }
  wikinsertLink.appendChild(wikinsertSpan)
  wikinsertVectorMenuItem.appendChild(wikinsertLink)

    vectorMenuContentList.prepend(wikinsertVectorMenuItem)
}

function openPopup() {
    chrome.runtime.sendMessage({action: "openPopup"})
}

// Handle storing the selected targetTitle from the popup
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
    if (message.action === "setTarget") {
        chrome.storage.local.set({[`${currentPageKey}-target`]: message.targetTitle});
    }
});


openPopup();
