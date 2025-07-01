import {HTMLSentenceMapping, TextNode} from "../types";
import {originalHTMLMap} from "./content";
import {getHeatColor} from "./coloring";

import {xpathText} from "./xpath";
import {normalizeSentencesLogistic, normalizeSentencesMinMax, scopedKey} from "../utils";
import {hideFloatingDisplay, showFloatingDisplay} from "./page-addons";
import { buildMinimap, removeMinimap } from "./minimap";


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
        (message: { action: string }, sender, sendResponse): void => {
            const currentPageKey = location.href.split("#")[0];
            const pageInfoKey = scopedKey(currentPageKey, "pageInfo");
            chrome.storage.session.get([pageInfoKey], (result) => {
                const pageInfo = result[pageInfoKey] as { pageKey: string; title: string; lang: string; revId: string };
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
                                        const normalizedSentences = normalizeSentencesMinMax(
                                            response,
                                            Math.min(...response.map((s) => s.score)),
                                            Math.max(...response.map((s) => s.score)),
                                        );
                                        chrome.storage.session.set({
                                            [scopedKey(currentPageKey, "heatmap")]: normalizedSentences,
                                        });

                                        highlightSentences(normalizedSentences, true);
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

export function highlightSentences(sentences: HTMLSentenceMapping[], withScrollTo: boolean): void {
    const currentPageKey = location.href.split('#')[0];
    const intensityKey = scopedKey(currentPageKey, "intensity");
    const relative = false;
    if (!relative) {
        chrome.storage.session.set({
            [scopedKey(currentPageKey, "heatScoreMin")]: Math.min(...sentences.map((s) => s.score)),
            [scopedKey(currentPageKey, "heatScoreMax")]: Math.max(...sentences.map((s) => s.score)),
        });
    }

    chrome.storage.session.get([intensityKey], (result) => {
        const intensity = typeof result[intensityKey] === "number" ? result[intensityKey] : 0.5;
        const {filtered: filteredSentences, top: topSentence, bins} = filterByIntensity(sentences, intensity);
        console.log(bins);
        if (relative) {
            chrome.storage.session.set({
                [scopedKey(currentPageKey, "heatScoreMin")]: Math.min(...filteredSentences.map((s) => s.score)),
                [scopedKey(currentPageKey, "heatScoreMax")]: Math.max(...filteredSentences.map((s) => s.score)),
            });
        }
        chrome.storage.session.set({
            [scopedKey(currentPageKey, "dynamicBins")]: bins
        });

        const contentContainer = document.getElementById("mw-content-text");
        if (!contentContainer) {
            console.error("Content container not found");
            return;
        }

        storeOriginalParagraphHTML(contentContainer);

        const textNodes = getTextNodesIn();

        const ordered = filteredSentences
            .slice()
            .sort((a, b) => b.startOffset - a.startOffset);

        ordered.forEach((sentence) => wrapRangeInContainer(sentence, textNodes));

        if (topSentence && withScrollTo) {
            requestAnimationFrame(() => {
                const span = document.getElementById(`sentence-${topSentence!.id}`);
                if (!span) return;

                /* add / reuse an anchor so a hash link still works */
                let anchor = document.getElementById("wikinsert-top-highlight");
                if (!anchor) {
                    anchor = document.createElement("a");
                    anchor.id = "wikinsert-top-highlight";
                    anchor.style.position = "absolute";   // keeps it invisible
                    anchor.style.width = "0";
                    anchor.style.height = "0";
                }
                span.prepend(anchor);

                smoothScrollTo(anchor);
            });
        }
    });


    // show spectrum if heatmap is not empty
    const pageInfoKey = scopedKey(currentPageKey, "pageInfo");
    chrome.storage.session.get([pageInfoKey], (result) => {
        const pageInfo = result[pageInfoKey] as { pageKey: string; title: string; lang: string; revId: string };
        const heatmapKey = scopedKey(currentPageKey, "heatmap");
        chrome.storage.session.get([heatmapKey], (result) => {
            const heatmap = result[heatmapKey] as HTMLSentenceMapping[] || [];
            if (heatmap && heatmap.length > 0) {
                buildMinimap(heatmap)
                showFloatingDisplay();
            } else {
                hideFloatingDisplay();
                removeMinimap();
            }
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

    const currentPageKey = location.href.split('#')[0];
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
            chrome.storage.session.get([
                scopedKey(currentPageKey, "heatScoreMin"),
                scopedKey(currentPageKey, "heatScoreMax")
            ], (result) => {
                const heatScoreMin = result[scopedKey(currentPageKey, "heatScoreMin")] as number;
                const heatScoreMax = result[scopedKey(currentPageKey, "heatScoreMax")] as number;
                span.style.backgroundColor = getHeatColor(
                    score,
                    0,
                    1,
                );
                span.addEventListener('mouseenter', () => {
                    const description = score >= 0.9 ? "Very High" : (score >= 0.75 ? "High" : (score >= 0.4 ? "Medium" : (score >= 0.15 ? "Low" : "Very Low")));
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

function filterByIntensity(
    sentences: HTMLSentenceMapping[],
    threshold: number,
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping; bins: number[] } {
    const currentPageKey = location.href.split('#')[0];
    const scores = sentences.map(s => s.score).sort((a, b) => a - b);
    let bins: number[];
    if (scores.length >= 6) {
        bins = jenksBreaks(scores, 5);
        // Clamp to [0,1]
        bins[0] = 0;
        bins[bins.length - 1] = 1;
    } else {
        bins = [0, 0.15, 0.4, 0.75, 0.9, 1];
    }
    const counts = {medium: 0, high: 0, veryHigh: 0};
    const filtered: HTMLSentenceMapping[] = [];
    let top: HTMLSentenceMapping | undefined;
    for (const s of sentences) {
        const x = s.score;
        if (x >= bins[4]) counts.veryHigh++;
        else if (x >= bins[3]) counts.high++;
        else if (x >= bins[2]) counts.medium++;
        if (x < threshold) continue;
        filtered.push(s);
        if (!top || x > top.score) top = s;
    }
    chrome.storage.session.set({
        [scopedKey(currentPageKey, "sentenceStats")]: {medium: counts.medium, high: counts.high, veryHigh: counts.veryHigh}
    });
    return {filtered, top, bins};
}
function filterByIntensity3(
    sentences: HTMLSentenceMapping[],
    threshold: number,
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping; bins: number[] } {
    const scores = sentences.map(s => s.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);

    const bins = [
        0,
        Math.max(0, mean - 1.5 * sd),
        Math.max(0, mean - 0.5 * sd),
        Math.min(1, mean + 0.5 * sd),
        Math.min(1, mean + 1.5 * sd),
        1,
    ];

    const counts = {medium: 0, high: 0, veryHigh: 0 };
    const filtered: HTMLSentenceMapping[] = [];
    let top: HTMLSentenceMapping | undefined;

    for (const s of sentences) {
        const x = s.score;
        if (x >= bins[4]) counts.veryHigh++;
        else if (x >= bins[3]) counts.high++;
        else if (x >= bins[2]) counts.medium++;

        if (x < threshold) continue;
        filtered.push(s);
        if (!top || x > top.score) top = s;
    }

    chrome.storage.session.set({sentenceStats: {medium: counts.medium, high: counts.high, veryHigh: counts.veryHigh}});
    return {filtered, top, bins};
}

function filterByIntensity1(
    sentences: HTMLSentenceMapping[],
    threshold: number,
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping } {
    const filtered: HTMLSentenceMapping[] = [];
    let top: HTMLSentenceMapping | undefined;
    let medium = 0, high = 0, veryHigh = 0;

    for (const s of sentences) {
        if (s.score >= 0.90) veryHigh++;
        else if (s.score >= 0.75) high++;
        else if (s.score >= 0.40) medium++;

        if (s.score < threshold) continue;
        filtered.push(s);
        if (!top) top = s;
        if (s.score >= 0.90 && (!top || top.score < 0.90)) top = s;
    }

    chrome.storage.session.set({sentenceStats: {medium, high, veryHigh}});

    return {filtered, top};
}

function filterByIntensity2(
    sentences: HTMLSentenceMapping[],
    threshold: number,
): { filtered: HTMLSentenceMapping[]; top?: HTMLSentenceMapping } {
    const filtered: HTMLSentenceMapping[] = [];
    let top: HTMLSentenceMapping | undefined;
    let medium = 0, high = 0, veryHigh = 0;

    const scores = sentences.map(s => s.score).sort((a, b) => a - b);
    const getQuantile = (q: number) => scores[Math.floor(q * scores.length)] || 0;

    const q40 = getQuantile(0.4);
    const q70 = getQuantile(0.7);
    const q90 = getQuantile(0.9);
    console.log(`Quantiles: 40%=${q40}, 70%=${q70}, 90%=${q90}`);

    for (const s of sentences) {
        if (s.score >= q90) veryHigh++;
        else if (s.score >= q70) high++;
        else if (s.score >= q40) medium++;

        if (s.score < threshold) continue;
        filtered.push(s);
        if (!top) top = s;
        if (s.score >= q90 && (!top || top.score < q90)) top = s;
    }

    chrome.storage.session.set({sentenceStats: {medium, high, veryHigh}});

    return {filtered, top};
}
