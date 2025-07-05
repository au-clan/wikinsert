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

/**
 * Empirical CDF normalization: map each sentence's score to its empirical CDF in [0,1].
 */
export function normalizeSentencesEmpiricalCDF(
  sentences: HTMLSentenceMapping[],
): HTMLSentenceMapping[] {
  const n = sentences.length;
  if (n === 0) return [];
  if (n === 1) return [{ ...sentences[0], score: 1 }];
  const scores = sentences.map(s => s.score);
  const sorted = [...scores].sort((a, b) => a - b);
  return sentences.map(s => {
    const countLE = sorted.filter(v => v <= s.score).length;
    const cdf = (countLE - 1) / (n - 1);
    return { ...s, score: cdf };
  });
}

export function normalizeSentencesZScoreSigmoid(
  sentences: HTMLSentenceMapping[],
): HTMLSentenceMapping[] {
  const n = sentences.length;
  if (n === 0) return [];

  // 1) compute mean & standard deviation
  const mean = sentences.reduce((sum, s) => sum + s.score, 0) / n;
  const sd = Math.sqrt(
    sentences.reduce((sum, s) => sum + (s.score - mean) ** 2, 0) / n,
  ) || 1;  // guard against zero-variance

  // 2) compute each z-score, and find min/max
  const zScores = sentences.map(s => (s.score - mean) / sd);
  const minZ = Math.min(...zScores);
  const maxZ = Math.max(...zScores);
  const rangeZ = maxZ - minZ || 1;

  // 3) choose k so that sigmoid(minZ) ≈ ε and sigmoid(maxZ) ≈ 1–ε
  const epsilon = 0.008; // adjust between 0 < ε < 0.5 for desired endpoint closeness
  const k = (2 / rangeZ) * Math.log((1 - epsilon) / epsilon);

  // 4) apply logistic with that k
  return sentences.map((s, i) => {
    const z = zScores[i];
    const raw = 1 / (1 + Math.exp(-k * z));
    return { ...s, score: raw };
  });
}