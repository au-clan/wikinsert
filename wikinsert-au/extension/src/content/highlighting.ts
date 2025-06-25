import {HTMLSentenceMapping, TextNode} from "../types";
import {originalHTMLMap} from "./content";
import {getHeatColor} from "./coloring";

import {xpathText} from "./xpath";
import {normalizeSentencesMinMax} from "../utils";
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
            chrome.storage.session.get(["pageInfo"], (result) => {
                const currentPageKey = result.pageInfo.pageKey;
                if (message.action === "highlight") {
                    removeHighlighting();
                    const start = performance.now();
                    chrome.storage.local.get([`${currentPageKey}-target`], (result) => {
                        const targetTitle = result[`${currentPageKey}-target`];
                        chrome.storage.session.get(["pageInfo"], (result) => {
                            chrome.runtime.sendMessage(
                                {
                                    action: "getHeatMap",
                                    srcRevId: result.pageInfo.revId,
                                    srcTitle: result.pageInfo.title,
                                    targetTitle: targetTitle,
                                    lang: result.pageInfo.lang,
                                },
                                (response: HTMLSentenceMapping[]) => {
                                    if (response) {
                                        console.log("Sentences received:", response);
                                        const normalizedSentences = normalizeSentencesMinMax(
                                            response,
                                            Math.min(...response.map((s) => s.score)),
                                            Math.max(...response.map((s) => s.score)),
                                        );
                                        chrome.storage.local.set({
                                            [`${currentPageKey}-heatmap`]: normalizedSentences,
                                        });

                                        highlightSentences(normalizedSentences, true);
                                    } else {
                                        console.warn("No sentences returned");
                                    }
                                },
                            );
                        });
                        chrome.storage.local.set({
                            [`${currentPageKey}-highlighted`]: true,
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
                    chrome.storage.local.set({
                        [`${currentPageKey}-highlighted`]: false,
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
    const relative = false;
    if (!relative) {
        chrome.storage.session.set({
            heatScoreMin: Math.min(...sentences.map((s) => s.score)),
            heatScoreMax: Math.max(...sentences.map((s) => s.score)),
        });
    }

    chrome.storage.local.get("intensity", (result) => {
        const intensity = result.intensity as number;
        const {filtered: filteredSentences, top: topSentence} = filterByIntensity(sentences, intensity);
        if (relative) {
            chrome.storage.session.set({
                heatScoreMin: Math.min(...filteredSentences.map((s) => s.score)),
                heatScoreMax: Math.max(...filteredSentences.map((s) => s.score)),
            });
        }

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
    chrome.storage.session.get(["pageInfo"], (result) => {
        const currentPageKey = result.pageInfo.pageKey;
        chrome.storage.local.get([`${currentPageKey}-heatmap`], (result) => {
            const heatmap = result[`${currentPageKey}-heatmap`];
            const sentences = heatmap as HTMLSentenceMapping[] || [];
            if (heatmap && heatmap.length > 0) {
                buildMinimap(sentences)
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
            chrome.storage.session.get(["heatScoreMin", "heatScoreMax"], (result) => {
                const heatScoreMin = result.heatScoreMin as number;
                const heatScoreMax = result.heatScoreMax as number;
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

function filterByIntensity(
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
