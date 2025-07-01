import {HTMLSentenceMapping} from "./types";

export function scopedKey(pageKey: string, suffix: string) {
    return `${pageKey}-${suffix}`;
}

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

/**
 * Logistic normalisation on the raw score, scaled so values near `min`
 * map close to 0 and values near `max` map close to 1.
 *
 * The scaling constant k is chosen from the observed range so that the
 * sigmoid spans almost the entire 0-1 i    nterval across the data.
 */
export function normalizeSentencesLogistic(
    sentences: HTMLSentenceMapping[],
    min: number,
    max: number,
): HTMLSentenceMapping[] {
    const range = max - min;
    const mid   = (max + min) / 2;
    // k chosen so that ±range/2 maps to roughly 0.002–0.998
    const k     = range !== 0 ? 12 / range : 1;

    return sentences.map(s => ({
        ...s,
        score: range > 0
            ? 1 / (1 + Math.exp(-k * (s.score - mid)))
            : 1,
    }));
}

/**
 * Z-score each value and feed it through a standard logistic sigmoid.
 * Emphasises distance from the mean rather than absolute extremes.
 */
export function normalizeSentencesZScoreSigmoid(
    sentences: HTMLSentenceMapping[],
): HTMLSentenceMapping[] {
    if (sentences.length === 0) return [];

    const mean = sentences.reduce((sum, s) => sum + s.score, 0) / sentences.length;
    const sd   = Math.sqrt(
        sentences.reduce((sum, s) => sum + (s.score - mean) ** 2, 0) /
        sentences.length,
    ) || 1;                         // guard against sd = 0

    return sentences.map(s => ({
        ...s,
        score: 1 / (1 + Math.exp(-(s.score - mean) / sd)),
    }));
}