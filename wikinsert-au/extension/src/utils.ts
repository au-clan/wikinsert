import {HTMLSentenceMapping} from "./types";

export function createSvgIcon(icon: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"  stroke="currentColor"><g>${icon}</g></svg>`;
}

export function openPopup() {
    chrome.runtime.sendMessage({action: "openPopup"});
}

export function normalizeSentencesMinMax(sentences: HTMLSentenceMapping[], min: number, max: number): HTMLSentenceMapping[] {
    const range = max - min;

    return sentences.map((sentence) => {
        const normalizedSentence = {...sentence};
        const norm = range > 0 ? Math.max(0, Math.min(1, (sentence.score - min) / range)) : 1;
        normalizedSentence.score = norm;
        return normalizedSentence;
    });
}
