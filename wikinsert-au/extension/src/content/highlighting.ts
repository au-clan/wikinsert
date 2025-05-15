import {HTMLSentenceMapping, TextNode} from "../types";
import {originalHTMLMap} from "./content";
import {getHeatColor} from "./coloring";
import {xpathText} from "./xpath";

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
                                        chrome.storage.local.set({
                                            [`${currentPageKey}-heatmap`]: response,
                                        });
                                        highlightSentences(response);
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

export function highlightSentences(sentences: HTMLSentenceMapping[]): void {
    const relative = true;
    if (!relative) {
        chrome.storage.session.set({
            heatScoreMin: Math.min(...sentences.map((s) => s.score)),
            heatScoreMax: Math.max(...sentences.map((s) => s.score)),
        });
    }

    chrome.storage.local.get("density", (result) => {
        const density = result.density as number;
        const filteredSentences = filterTopDensitySentences(sentences, density);
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
                    heatScoreMin,
                    heatScoreMax,
                );
            });

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

function filterTopDensitySentences(
    sentences: HTMLSentenceMapping[],
    densityPercentage: number,
): HTMLSentenceMapping[] {
    const sortedByScore = sentences.slice().sort((a, b) => b.score - a.score);
    const cutoffIndex = Math.ceil(
        sortedByScore.length * (densityPercentage / 100),
    );
    return sortedByScore.slice(0, cutoffIndex);
}
