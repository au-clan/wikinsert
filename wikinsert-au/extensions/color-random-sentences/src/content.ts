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

let currentHeatMap: HTMLSentenceMapping[] = [];
const currentPageKey = location.href;
chrome.storage.local.set({[currentPageKey]: false});

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
      const start = performance.now();
      chrome.runtime.sendMessage(
        {
          action: "getHeatMap",
          srcRevId: srcRevId,
          srcTitle: srcTitle,
          targetTitle: "salmon",
          lang: "en",
        },
        (response: HTMLSentenceMapping[]) => {
          if (response) {
            console.log("Sentences received:", response);
            currentHeatMap = response;
            highlightSentences(currentHeatMap);
          } else {
            console.warn("No sentences returned");
          }
        }
      );

      chrome.storage.local.set({[currentPageKey]: true});
      console.log("Highlighting applied in", performance.now() - start, "ms");
    } else if (message.action === "remove") {
      console.log("Removing highlighting");
      removeHighlighting();
      chrome.storage.local.set({[currentPageKey]: false});
    }
  }
);

/**
 * Highlights sentences using the Range object.
 */
function highlightSentences(sentences: HTMLSentenceMapping[]): void {
  const contentContainer = document.getElementById("mw-content-text");
  if (!contentContainer) {
    console.error("Content container not found");
    return;
  }
  sentences.forEach((sentence) => {
    wrapRangeInContainer(sentence);
  });
}

/**
 * Wraps a sentence range in a <span> with a highlight.
 */
function wrapRangeInContainer(
  sentence: HTMLSentenceMapping,
): void {
  const textNodes = getTextNodesIn();
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
    
    // if (startNodeInfo === null &&
    //   sentence.startOffset >= node.start &&
    //   sentence.startOffset < node.end) {
    //   startNodeInfo = {
    //     node: node.node,
    //     offset: sentence.startOffset - node.start
    //   };
    //   console.log("start ", startNodeInfo);
    //   console.log("node ", node.node.textContent);
    // }

    // // If this node contains the end point
    // if (endNodeInfo === null &&
    //   sentence.endOffset > node.start &&
    //   sentence.endOffset <= node.end) {
    //   endNodeInfo = {
    //     node: node.node,
    //     offset: sentence.endOffset - node.start
    //   };
    //   console.log("end ", endNodeInfo);
    //   console.log("node ", node.node.textContent);
    // }

    // // Break early if we found both nodes
    // if (startNodeInfo && endNodeInfo) {
    //   break;
    // }
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

  // if (!startNodeInfo || !endNodeInfo) {
  //   console.warn(`Could not find text nodes for sentence ${sentence.id}`);
  //   return;
  // }

  // const range = document.createRange();
  // range.setStart(startNodeInfo.node, startNodeInfo.offset);
  // range.setEnd(endNodeInfo.node, endNodeInfo.offset);

  // // Create the span that will wrap the sentence
  // const span = document.createElement("span");
  // span.className = "sentence-span";
  // span.id = `sentence-${sentence.id}`;
  // span.style.backgroundColor = getHeatColor(sentence.score);


  // // Wrap the sentence in the span
  // const extracted = range.extractContents();
  // span.appendChild(extracted);
  // range.insertNode(span);
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
  nodes.forEach((node) => {
    console.log(node.node.textContent, node.start, node.end);
  });
  return nodes;
}

/**
 * Generates a heat-based HSL red color.
 */
function getHeatColor(heat: number): string {
  const norm = (heat - 0.5) / 0.5;
  return `hsl(0, ${70 + norm * 20}%, ${95 - norm * 30}%)`;
}