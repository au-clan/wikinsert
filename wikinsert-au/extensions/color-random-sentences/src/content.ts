import { split } from "sentence-splitter";

// A WeakMap for storing each paragraph's original HTML
const originalHTMLMap = new WeakMap<HTMLElement, string>();

// An object to store sentence data (text & score) by id
const sentenceData: { [id: string]: { text: string, score: number } } = {};

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

/**
 * Given a container (which is not in the live DOM), a start and end offset (global)
 * and a sentence id, wraps the content in that range in a <span> (preserving inner HTML).
 */
function wrapRangeInContainer(container: HTMLElement, start: number, end: number, sentenceId: number): void {
  const textNodes = getTextNodesIn(container);
  const startPos = getNodeForOffset(textNodes, start);
  const endPos = getNodeForOffset(textNodes, end);
  if (!startPos || !endPos) return;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  // Create the span that will wrap the sentence
  const span = document.createElement("span");
  span.className = "sentence-span";
  span.id = "sentence-" + sentenceId;
  // For now we assign a random background color; later, this might come from a score.
  span.style.backgroundColor = getRandomColor();

  // Store the sentence text and an initial score (0 in this case)
  sentenceData[span.id] = { text: range.toString(), score: 0 };

  // Wrap the contents: extract the range’s content and insert it into the span.
  const extracted = range.extractContents();
  span.appendChild(extracted);
  range.insertNode(span);
}

/**
 * Processes all sentences inside each paragraph of the target container,
 * wrapping each sentence (as determined by a regex) in a span ONLY if its score
 * meets or exceeds the provided threshold.
 *
 * @param scoreThreshold - The minimum score needed to highlight a sentence.
 *                         For manual testing you might set this to 0.5 (50% highlighted),
 *                         but in production you may set it to 0.2.
 */
function highlightSentences(scoreThreshold: number = 0.5): void {
  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }

  container.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
    // Save original HTML (so that highlighting can be removed later)
    if (!originalHTMLMap.has(paragraph)) {
      originalHTMLMap.set(paragraph, paragraph.innerHTML);
    }

    // Create a temporary container to work on a clone of the original HTML
    const original = originalHTMLMap.get(paragraph);
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = original || paragraph.innerHTML;

    // Get the full text content (this is the same text that a user sees)
    const fullText = tempContainer.innerText;

    // Use sentence-splitter to get sentence tokens
    const tokens = split(fullText);
    const sentences = tokens
      .filter(token => token.type === 'Sentence')
      .map(token => ({
        text: token.raw,
        start: token.range[0],
        end: token.range[1]
      }));


    // Process sentences in reverse order so that DOM modifications do not affect earlier offsets.
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const score = Math.random();
      sentenceData["sentence-" + (i + 1)] = { text: sentence.text, score };

      // Use (i + 1) as the sentence id (or use a different incremental counter if needed)
      if (score >= scoreThreshold) {
        const textNodes = getTextNodesIn(tempContainer);
        let newStart = sentence.start;
        for (const entry of textNodes) {
          if (entry.end <= newStart) continue;
          if (entry.start >= sentence.end) break;
          if (
            entry.start === newStart &&
            entry.node.parentElement &&
            entry.node.parentElement.tagName.toLowerCase() === "sup" &&
            entry.node.parentElement.classList.contains("reference")
          ) {
            newStart = entry.end;
          } else {
            break;
          }
        }
        if (newStart < sentence.end) {
          wrapRangeInContainer(tempContainer, newStart, sentence.end, i + 1);
        }
      }
    }

    // Replace the paragraph's content with the processed HTML from the temp container
    paragraph.innerHTML = tempContainer.innerHTML;
  });
}

/**
 * Remove highlighting by restoring each paragraph’s original HTML.
 */
function removeHighlighting(): void {
  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }
  container.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
    const original = originalHTMLMap.get(paragraph);
    if (original) {
      paragraph.innerHTML = original;
    }
  });
}

/**
 * Generates a random color using HSL. (You can later change this to a score-based color.)
 */
function getRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 31) + 70; // between 70% and 100%
  const lightness = 85; // high lightness for a light background
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener(
  (message: { action: string }, sender, sendResponse): void => {
    if (message.action === 'highlight') {
      console.log('Highlighting sentences start');
      const start = performance.now();
      highlightSentences(0);
      const end = performance.now();
      console.log('Highlighting sentences took (ms): ', end - start);
    } else if (message.action === 'remove') {
      removeHighlighting();
    }
  }
);