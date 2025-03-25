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

type PTagInfo = {
  pTag: HTMLParagraphElement | null;
  startOffset: number;
  endOffset: number;
}

let currentHeatMap: HTMLSentenceMapping[] = [];
const currentPageKey = location.href;
chrome.storage.local.set({[currentPageKey]: false});

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
    const pTag = getPTagForSentence(sentence, contentContainer);

    const textNodes = getTextNodesIn(pTag);
    wrapRangeInContainer(sentence, textNodes);
  });
}

/**
 * Returns the paragraph element that contains the given offset.
 */
function getPTagForSentence(sentence: HTMLSentenceMapping, container: HTMLElement): PTagInfo {
  const pTags = Array.from(container.getElementsByTagName("p"));
  let currentOffset = 0;

  for (let pTag of pTags) {
    const pTagStartOffset: number = currentOffset;
    console.log("pTagStartOffset", pTagStartOffset);
    const pTagEndOffset: number = currentOffset + (pTag.textContent?.length || 0);
    console.log("pTagEndOffset", pTagEndOffset);

    if (sentence.startOffset >= pTagStartOffset && sentence.endOffset <= pTagEndOffset) {
      return {pTag, startOffset: pTagStartOffset, endOffset: pTagEndOffset};
    }
    currentOffset = pTagEndOffset;
  }
  console.warn("Could not find paragraph for sentence", sentence);
  return {pTag: null, startOffset: 0, endOffset: 0};
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
      sentence.startOffset >= node.start &&
      sentence.startOffset < node.end) {
      startNodeInfo = {
        node: node.node,
        offset: sentence.startOffset - node.start
      };
      console.log("start ", startNodeInfo);
    }

    // If this node contains the end point
    if (endNodeInfo === null &&
      sentence.endOffset > node.start &&
      sentence.endOffset <= node.end) {
      endNodeInfo = {
        node: node.node,
        offset: sentence.endOffset - node.start
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
function getTextNodesIn(pTagInfo: PTagInfo): TextNode[] {
  const pTag = pTagInfo.pTag;
  const nodes: TextNode[] = [];
  if (!pTag) {
    console.error("No paragraph found containing sentence");
    return nodes;
  }
  const walker = document.createTreeWalker(pTag, NodeFilter.SHOW_TEXT, null);
  let globalOffset = pTagInfo.startOffset;
  let currentNode: Text | null;

  while ((currentNode = walker.nextNode() as Text | null)) {
    const text = currentNode.textContent || "";
    if (text.length === 0) {
      continue;
    }

    const start = globalOffset;
    const end = globalOffset + text.length;
    nodes.push({node: currentNode, start, end});
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