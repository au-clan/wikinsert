import {split} from "sentence-splitter";

// A WeakMap for storing each paragraph's original HTML
const originalHTMLMap = new WeakMap<HTMLElement, string>();

// An object to store sentence data (text & score) by id
const sentenceData: { [id: string]: { text: string, score: number } } = {};

// A counter to assign unique ids to each sentence span
let numberOfSentences = 0;

// Split the sentences of each paragraph in the content container
splitSentences();

const currentPageKey = location.href;

chrome.storage.local.set({ [currentPageKey]: false });

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener(
  (message: { action: string }, sender, sendResponse): void => {
    if (message.action === 'highlight') {
      const start = performance.now();
      applyColoring();
      chrome.storage.local.set({ [currentPageKey]: true });
      console.log("Coloring applied in", performance.now() - start, "ms");
    } else if (message.action === 'remove') {
      removeColoring();
      chrome.storage.local.set({ [currentPageKey]: false });
    }
  }
);


/**
 * Given a container (which is not in the live DOM), a start and end offset (global)
 * and a sentence id, wraps the content in that range in a <span> (preserving inner HTML).
 */
function wrapRangeInContainer(container: HTMLElement, start: number, end: number): void {
  const textNodes = getTextNodesIn(container);
  const startPos = getNodeForOffset(textNodes, start);
  const endPos = getNodeForOffset(textNodes, end);
  if (!startPos || !endPos) return;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const span = document.createElement("span");
  span.className = "sentence-span";
  span.id = "sentence-" + numberOfSentences++;

  sentenceData[span.id] = { text: range.toString(), score: Math.random() };
  chrome.runtime.sendMessage(
      {action: "getScore"},
      (response: { score: number }) => {
        if (response && typeof response.score === "number") {
          sentenceData[span.id].score = response.score;
        } else {
          console.warn("No score returned for sentence:", span.id);
        }
      }
  );
  const extracted = range.extractContents();
  span.appendChild(extracted);
  range.insertNode(span);
}

/**
 * Applies (or re-applies) coloring to all sentence spans.
 * Here we simply iterate over all spans with class "sentence-span"
 * and set a background color (e.g. based on the stored random score).
 */
function applyColoring(threshold: number = 0.5): void {
  const spans = document.querySelectorAll<HTMLSpanElement>(".sentence-span");
  spans.forEach((span) => {
    const id = span.id;
    const data = sentenceData[id];
    if (data) {
      if (data.score >= threshold) {
        span.style.backgroundColor = getRandomColor(data.score);
      } 
    }
  });
}

/**
 * Removes coloring from all sentence spans (leaving the sentence spans in place).
 */
function removeColoring(): void {
  const spans = document.querySelectorAll<HTMLSpanElement>(".sentence-span");
  spans.forEach((span) => {
    span.style.backgroundColor = "";
  });
}

/**
 * Generates an HSL red color based on the "heat" value.
 * Heat is expected to be between 0.5 (lightest red) and 1 (darker red).
 * 
 * Normalization:
 * - heat = 0.5 → norm = 0 → hsl(0, 70%, 95%)
 * - heat = 1   → norm = 1 → hsl(0, 90%, 65%)
 *
 * @param heat - A number between 0.5 and 1.
 */
function getRandomColor(heat: number): string {
  const norm = (heat - 0.5) / 0.5;
  const hue = 0;
  const saturation = 70 + norm * (90 - 70); 
  const lightness = 95 - norm * (95 - 65);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Splits the sentences of each paragraph in the #mw-content-text container once,
 * wrapping each sentence in a span with a unique id.
 *
 * This function is run only once per page load.
 */
function splitSentences(): void {
  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }
  container.querySelectorAll<HTMLParagraphElement>("p").forEach((paragraph) => {
    if (!originalHTMLMap.has(paragraph)) {
      originalHTMLMap.set(paragraph, paragraph.innerHTML);
    }
    const original = originalHTMLMap.get(paragraph);
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = original || paragraph.innerHTML;

    let fullText = tempContainer.innerText;
    fullText = fullText.replace(/\[(\d+|[a-zA-Z])\]/g, (match) => " ".repeat(match.length));

    const tokens = split(fullText);
    const sentences = tokens
      .filter((token) => token.type === "Sentence")
      .map((token) => ({
        text: token.raw,
        start: token.range[0],
        end: token.range[1],
      }));

    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      wrapRangeInContainer(tempContainer, sentence.start, sentence.end);
    }
    
    paragraph.innerHTML = tempContainer.innerHTML;
  });
}

/**
 * Given a DOM element, returns an array of its text nodes together with
 * the starting and ending offset of each text node in the element’s overall text.
 */
function getTextNodesIn(element: HTMLElement): { node: Text, start: number, end: number }[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  const nodes: { node: Text, start: number, end: number }[] = [];
  let globalOffset = 0;
  let currentNode: Text | null;
  while ((currentNode = walker.nextNode() as Text | null)) {
    const text = currentNode.textContent || "";
    const start = globalOffset;
    const end = globalOffset + text.length;
    nodes.push({ node: currentNode, start, end });
    globalOffset = end;
  }
  return nodes;
}

/**
 * Given a list of text nodes (with their global offsets) and a desired global offset,
 * returns the corresponding text node and the local offset within that node.
 */
function getNodeForOffset(
  textNodes: { node: Text, start: number, end: number }[],
  offset: number
): { node: Text, offset: number } | null {
  for (const entry of textNodes) {
    if (entry.start <= offset && offset <= entry.end) {
      return { node: entry.node, offset: offset - entry.start };
    }
  }
  return null;
}