// A WeakMap for storing each paragraph's original HTML
let originalHTMLMap = new WeakMap<HTMLElement, string>();

// Type definition for Sentence
type HTMLSentenceMapping = {
  id: number;
  pTagId: number;
  relStartOffset: number;
  relEndOffset: number;
  score: number;
};

type TextNode = {
  node: Text;
  start: number;
  end: number;
};

let currentHeatMap: HTMLSentenceMapping[] = [];
const currentPageKey = location.href;
chrome.storage.local.set({ [currentPageKey]: false });

// give a unique id to each p tag in the content
function giveIdsToPTags() {
  const contentContainer = document.getElementById("mw-content-text");
  if (!contentContainer) {
    console.error("Content container not found");
    return;
  }

  const pTags = contentContainer.querySelectorAll("p");
  pTags.forEach((pTag, index) => {
    pTag.id = `p-${index}`;
  });
}
giveIdsToPTags();




// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener(
  (message: { action: string }, sender, sendResponse): void => {
    if (message.action === "highlight") {
      const start = performance.now();
      chrome.runtime.sendMessage(
        {
          action: "getHeatMap",
          srcRevId: 1,
          srcTitle: "a",
          targetRevId: 2,
          targetTitle: "b",
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

      chrome.storage.local.set({ [currentPageKey]: true });
      console.log("Highlighting applied in", performance.now() - start, "ms");
    } else if (message.action === "remove") {
      console.log("Removing highlighting");
      removeHighlighting();
      chrome.storage.local.set({ [currentPageKey]: false });
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
    const pTag = document.getElementById(`p-${sentence.pTagId}`);
    if (!pTag) {
      console.warn(`Could not find paragraph with ID: p-${sentence.pTagId}`);
      return;
    }

    const textNodes = getTextNodesIn(pTag);
    wrapRangeInContainer(sentence, textNodes);
  });
}

/**
 * Wraps a sentence range in a <span> with a highlight.
 */
function wrapRangeInContainer(
  sentence: HTMLSentenceMapping,
  textNodes: TextNode[]
): void {
  let startNodeInfo = null;
  let endNodeInfo = null;
  console.log(sentence);
  console.log(textNodes);

  for (const node of textNodes) {
    // If this node contains the start point
    if (startNodeInfo === null && 
        sentence.relStartOffset >= node.start && 
        sentence.relStartOffset < node.end) {
      startNodeInfo = {
        node: node.node,
        offset: sentence.relStartOffset - node.start
      };
      console.log("start ", startNodeInfo);
    }
    
    // If this node contains the end point
    if (endNodeInfo === null && 
        sentence.relEndOffset > node.start && 
        sentence.relEndOffset <= node.end) {
      endNodeInfo = {
        node: node.node,
        offset: sentence.relEndOffset - node.start
      };
      console.log("end ", endNodeInfo);
    }
    
    // Break early if we found both nodes
    if (startNodeInfo && endNodeInfo) {
      break;
    }
  }

  if (!startNodeInfo || !endNodeInfo) {
    console.warn(`Could not find text nodes for sentence ${sentence.id}`);
    return;
  }

  const range = document.createRange();
  range.setStart(startNodeInfo.node, startNodeInfo.offset);
  range.setEnd(endNodeInfo.node, endNodeInfo.offset);
  
  // Create the span that will wrap the sentence
  const span = document.createElement("span");
  span.className = "sentence-span";
  span.id = `sentence-${sentence.id}`;
  span.style.backgroundColor = getHeatColor(sentence.score);
  
  // Store the original HTML of the parent element
  const parentElement = startNodeInfo.node.parentElement;
  if (parentElement && !originalHTMLMap.has(parentElement)) {
    originalHTMLMap.set(parentElement, parentElement.innerHTML);
  }

  // Wrap the sentence in the span
  const extracted = range.extractContents();
  span.appendChild(extracted);
  range.insertNode(span);
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
function getTextNodesIn(element: HTMLElement): TextNode[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const nodes: TextNode[] = [];
  let globalOffset = 0;
  let currentNode: Text | null;

  while ((currentNode = walker.nextNode() as Text | null)) {
    const text = currentNode.textContent || "";
    const trimmedText = text.trim();
    if (trimmedText.length === 0) continue;

    const start = globalOffset;
    const end = globalOffset + text.length;
    nodes.push({ node: currentNode, start, end });
    globalOffset = end;
  }
  return nodes;
}

/**
 * Generates a heat-based HSL red color.
 */
function getHeatColor(heat: number): string {
  const norm = (heat - 0.5) / 0.5;
  return `hsl(0, ${70 + norm * 20}%, ${95 - norm * 30}%)`;
}