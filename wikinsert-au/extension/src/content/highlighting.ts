import {getHeatColor} from "./coloring";
import {
    currentHeatMap,
    currentPageKey,
    HTMLSentenceMapping,
    setCurrentHeatMap,
    srcLang,
    srcRevId,
    srcTitle,
    TextNode
} from "./content";
import {xpathText} from "./xpath";

export function initHighlightListeners() {

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
                                setCurrentHeatMap(response);
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
}

export function storeOriginalParagraphHTML(container: HTMLElement) {
    chrome.storage.session.get("originalHTMLMap", (result) => {
        if (result.originalHTMLMap) {
            const originalHTMLMap = result.originalHTMLMap as WeakMap<HTMLElement, string>;
            container
                .querySelectorAll<HTMLParagraphElement>("p")
                .forEach((p) => {
                    if (!originalHTMLMap.has(p)) {
                        originalHTMLMap.set(p, p.innerHTML);
                    }
                });
        }
    });
}

export function highlightSentences(sentences: HTMLSentenceMapping[]): void {
    chrome.storage.session.set({
        heatScoreMin: Math.min(...sentences.map((s) => s.score)),
        heatScoreMax: Math.max(...sentences.map((s) => s.score)),
    });

    chrome.storage.local.get("density", (result) => {
        const density = result.density as number;
        const filteredSentences = filterTopDensitySentences(sentences, density);


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
    textNodes: TextNode[]
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
                span.style.backgroundColor = getHeatColor(score, heatScoreMin, heatScoreMax);
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
export function removeHighlighting(): void {
    const container = document.getElementById("mw-content-text");
    if (!container) {
        console.error("Content container not found");
        return;
    }

    chrome.storage.session.get("originalHTMLMap", (result) => {
        const originalHTMLMap = result.originalHTMLMap as WeakMap<HTMLElement, string>;
        container.querySelectorAll<HTMLParagraphElement>("p").forEach((paragraph) => {
            if (originalHTMLMap.has(paragraph)) {
                paragraph.innerHTML = originalHTMLMap.get(paragraph)!;
            }
        });

        // Fallback: Ensure all spans are removed in case original HTML restoration fails
        document.querySelectorAll(".sentence-span").forEach((span) => {
            span.replaceWith(...span.childNodes);
        });
        chrome.storage.session.remove("originalHTMLMap");
    });
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

function filterTopDensitySentences(sentences: HTMLSentenceMapping[], densityPercentage: number): HTMLSentenceMapping[] {
    const sortedByScore = sentences.slice().sort((a, b) => b.score - a.score);
    const cutoffIndex = Math.ceil(sortedByScore.length * (densityPercentage / 100));
    return sortedByScore.slice(0, cutoffIndex);
}