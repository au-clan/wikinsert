import {HTMLSentenceMapping, TextNode} from "../types";
import {originalHTMLMap} from "./content";
import {getHeatColor} from "./coloring";

import {xpathText} from "./xpath";
import {normalizeSentencesEmpiricalCDF, normalizeSentencesZScoreSigmoid, scopedKey} from "../utils";
import {hideFloatingDisplay, showFloatingDisplay} from "./page-addons";
import { buildMinimap, removeMinimap } from "./minimap";

let currentBins: number[] = [0, 0.15, 0.4, 0.75, 0.9, 1];


function smoothScrollTo(el: HTMLElement) {
    el.scrollIntoView({behavior: "smooth"});
}
const tooltip = document.createElement('div');
tooltip.className = 'custom-tooltip';
Object.assign(tooltip.style, {
    position: 'fixed',
    pointerEvents: 'none',
    padding: '4px 8px',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    borderRadius: '4px',
    fontSize: '12px',
    transition: 'opacity 0.2s',
    opacity: '0',
    zIndex: '9999',
});
document.body.appendChild(tooltip);


export function initHighlightListeners() {
    // Listen for messages from the extension popup
    chrome.runtime.onMessage.addListener(
        (message: { action: string }): void => {
            const currentPageKey = location.href.split("#")[0];
            const pageInfoKey = scopedKey(currentPageKey, "pageInfo");
            chrome.storage.session.get([pageInfoKey], (result) => {
                // currentPageKey is already defined above
                if (message.action === "highlight") {
                    removeHighlighting();
                    const start = performance.now();
                    chrome.storage.session.get([scopedKey(currentPageKey, "target")], (result) => {
                        const targetTitle = result[scopedKey(currentPageKey, "target")];
                        chrome.storage.session.get([pageInfoKey], (result) => {
                            const pageInfo = result[pageInfoKey] as { pageKey: string; title: string; lang: string; revId: string };
                            chrome.runtime.sendMessage(
                                {
                                    action: "getHeatMap",
                                    srcRevId: pageInfo.revId,
                                    srcTitle: pageInfo.title,
                                    targetTitle: targetTitle,
                                    lang: pageInfo.lang,
                                },
                                (response: HTMLSentenceMapping[]) => {
                                  if (response) {
                                    console.log("Sentences received:", response);
                                    const rawKey = scopedKey(currentPageKey, "rawHeatmap");
                                    // Store raw scores for later re-normalization
                                    chrome.storage.session.set({ [rawKey]: response }, () => {
                                      highlightSentences(true);
                                    });
                                  } else {
                                    console.warn("No sentences returned");
                                  }
                                },
                            );
                        });
                        chrome.storage.session.set({
                            [scopedKey(currentPageKey, "highlighted")]: true,
                        });
                        console.log(
                            "Highlighting applied in",
                            performance.now() - start,
                            "ms",
                        );
                    });
                } else if (message.action === "remove") {
                    hideFloatingDisplay();
                    removeHighlighting();
                    removeMinimap();
                    chrome.storage.session.set({
                        [scopedKey(currentPageKey, "highlighted")]: false,
                    });
                }
            });
        },
    );
}

function storeOriginalParagraphHTML(container: HTMLElement) {
    container.querySelectorAll<HTMLParagraphElement>("p").forEach((p) => {
        if (!originalHTMLMap.has(p)) {
            originalHTMLMap.set(p, p.innerHTML);
        }
    });
}

export function highlightSentences(withScrollTo: boolean): void {
  const pageKey = location.href.split('#')[0];
  const rawKey = scopedKey(pageKey, 'rawHeatmap');
  chrome.storage.session.get([rawKey], ({ [rawKey]: raw = [] }) => {
    if (!raw.length) {
      hideFloatingDisplay();
      removeMinimap();
      return;
    }
    chrome.storage.session.get([scopedKey(pageKey, 'scaleType')], ({ [scopedKey(pageKey, 'scaleType')]: type = 'smooth' }) => {
      const normalized = type === 'smooth'
        ? normalizeSentencesZScoreSigmoid(raw)
        : normalizeSentencesEmpiricalCDF(raw);
      chrome.storage.session.set({
        [scopedKey(pageKey, 'heatmap')]: normalized,
      }, () => {
        const intensityKey = scopedKey(pageKey, 'intensity');
        chrome.storage.session.get([intensityKey], ({ [intensityKey]: threshold = 0.5 }) => {
          const { filtered, top, bins } = type === 'smooth'
            ? filterByIntensitySmooth(normalized, threshold)
            : filterByIntensityRelative(normalized, threshold);
          currentBins = bins;
          chrome.storage.session.set({ [scopedKey(pageKey, 'dynamicBins')]: bins });
          removeHighlighting();
          const textNodes = getTextNodesIn();
          const ordered = filtered.slice().sort((a, b) => b.startOffset - a.startOffset);
          ordered.forEach((sentence) => wrapRangeInContainer(sentence, textNodes));

          if (top && withScrollTo) {
            requestAnimationFrame(() => {
                const span = document.getElementById(`sentence-${top!.id}`);
                if (!span) return;
                let anchor = document.getElementById("wikinsert-top-highlight");
                if (!anchor) {
                    anchor = document.createElement("a");
                    anchor.id = "wikinsert-top-highlight";
                    anchor.style.position = "absolute";
                    anchor.style.width = "0";
                    anchor.style.height = "0";
                }
                span.prepend(anchor);

                smoothScrollTo(anchor);
            });
        }
          showFloatingDisplay();
          buildMinimap(normalized);
        });
      });
    });
  });
}

/**
 * Wraps a sentence range in a <span> with a highlight.
 */
function wrapRangeInContainer(
    sentence: HTMLSentenceMapping,
    textNodes: TextNode[],
): void {
    const {startOffset, endOffset, score, id} = sentence;

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

        const sessionStart = Math.max(startOffset, node.start);
        const sessionEnd = Math.min(endOffset, node.end);

        const startInNode = sessionStart - node.start;
        const endInNode = sessionEnd - node.start;

        if (startInNode < endInNode) {
            const range = document.createRange();
            range.setStart(node.node, startInNode);
            range.setEnd(node.node, endInNode);

            const span = document.createElement("span");
            span.className = "sentence-span";
            span.id = `sentence-${id}`;
            span.style.backgroundColor = getHeatColor(
                    score,
                    0,
                    1,
                );
            span.addEventListener('mouseenter', () => {
                // Determine category based on dynamic bins
                const labels = ["Very Low", "Low", "Medium", "High", "Very High"];
                let categoryIndex = labels.length - 1;
                for (let i = 0; i < currentBins.length - 1; i++) {
                    if (score < currentBins[i + 1]) {
                    categoryIndex = i;
                    break;
                    }
                }
                const description = labels[categoryIndex];
                const scorePercentage = score * 100;
                tooltip.textContent = `${scorePercentage.toFixed(0)}% Relevance (${description})`;
                tooltip.style.opacity = '1';
            });
            span.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
            span.addEventListener('mousemove', (e) => {
                tooltip.style.top = `${e.clientY + 10}px`;
                tooltip.style.left = `${e.clientX + 10}px`;
            });

            const extracted = range.extractContents();
            const extractedText = extracted.textContent || '';
            // Skip highlighting whitespace-only fragments
            if (!/\S/.test(extractedText)) {
                // Reinsert the whitespace and skip wrapping
                range.insertNode(extracted);
                continue;
            }
            span.appendChild(extracted);
            range.insertNode(span);
        }
    }
}

/**
 * Removes highlighting by restoring each paragraph’s original HTML.
 */
export function removeHighlighting(): void {
    const container = document.getElementById("mw-content-text");
    if (!container) {
        console.error("Content container not found");
        return;  
    }
    storeOriginalParagraphHTML(container);

    container.querySelectorAll<HTMLParagraphElement>("p").forEach((paragraph) => {
        if (originalHTMLMap.has(paragraph)) {
            paragraph.innerHTML = originalHTMLMap.get(paragraph)!;
        }
    });

    document.querySelectorAll(".sentence-span").forEach((span) => {
        span.replaceWith(...span.childNodes);
    });
}

/**
 * Returns an array of text nodes with their global offsets.
 */
function getTextNodesIn(): TextNode[] {
    const nodes: TextNode[] = [];
    let expression = document.createExpression(xpathText, null);
    const textNodes = expression.evaluate(
        document,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
    );
    let globalOffset = 0;
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
 * Jenks natural breaks algorithm for 1D clustering.
 * Returns an array of breakpoints (length = numClasses + 1).
 */
function jenksBreaks(data: number[], numClasses: number): number[] {
    if (numClasses < 2) throw new Error("At least 2 classes required");
    if (data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;
    // matrices
    const mat1: number[][] = Array.from({length: n + 1}, () => Array(numClasses + 1).fill(0));
    const mat2: number[][] = Array.from({length: n + 1}, () => Array(numClasses + 1).fill(0));
    for (let i = 1; i <= numClasses; i++) {
        mat1[0][i] = 1;
        mat2[0][i] = 0;
        for (let j = 1; j <= n; j++) mat2[j][i] = Infinity;
    }
    for (let l = 1; l <= n; l++) {
        let s1 = 0, s2 = 0, w = 0;
        for (let m = 1; m <= l; m++) {
            const i3 = l - m + 1;
            const val = sorted[i3 - 1];
            s2 += val * val;
            s1 += val;
            w++;
            const v = s2 - (s1 * s1) / w;
            if (i3 !== 1) {
                for (let j = 2; j <= numClasses; j++) {
                    if (mat2[l][j] >= (v + mat2[i3 - 1][j - 1])) {
                        mat1[l][j] = i3;
                        mat2[l][j] = v + mat2[i3 - 1][j - 1];
                    }
                }
            }
        }
        mat1[l][1] = 1;
        mat2[l][1] = s2 - (s1 * s1) / w;
    }
    // Breaks
    const breaks = Array(numClasses + 1).fill(0);
    breaks[numClasses] = sorted[n - 1];
    breaks[0] = sorted[0];
    let k = n, countNum = numClasses;
    while (countNum > 1) {
        const id = mat1[k][countNum] - 1;
        breaks[countNum - 1] = sorted[id];
        k = id;
        countNum--;
    }
    return breaks;
}

export function filterByIntensitySmooth(
  sentences: HTMLSentenceMapping[],
  threshold: number
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping; bins: number[] } {
  // Only consider scores ≥ 0.4 for natural breaks
  const eligibleScores = sentences
    .map(s => s.score)
    .filter(v => v >= 0.4)
    .sort((a, b) => a - b);
  let bins: number[];
  if (eligibleScores.length >= 6) {
      bins = jenksBreaks(eligibleScores, 5);
      // Force domain from 0.4 to 1
      bins[0] = 0.4;
      bins[bins.length - 1] = 1;
  } else {
      // Fixed fallback breaks between 0.4 and 1
      bins = [0.4, 0.55, 0.65, 0.75, 0.85, 1];
  }
  const filtered: HTMLSentenceMapping[] = [];
  let top: HTMLSentenceMapping | undefined;
  for (const s of sentences) {
      const x = s.score;
      if (x < threshold) continue;
      filtered.push(s);
      if (!top || x > top.score) top = s;
  }
  return {filtered, top, bins};
}

export function filterByIntensityRelative(
  sentences: HTMLSentenceMapping[],
  threshold: number
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping; bins: number[] } {
  // Fixed relative-percentile breaks starting at 0.4
  const bins = [0.4, 0.55, 0.65, 0.75, 0.85, 1];
  const filtered: HTMLSentenceMapping[] = [];
  let top: HTMLSentenceMapping | undefined;
  for (const s of sentences) {
    if (s.score < threshold) continue;
    filtered.push(s);
    if (!top || s.score > top.score) top = s;
  }
  return { filtered, top, bins };
}
