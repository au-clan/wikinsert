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
    // Choose k so that values at min and max map to [ε, 1-ε]
    const epsilon = 0.05; // adjust between 0 < ε < 0.5 for desired endpoint closeness
    const k       = range !== 0
        ? (2 / range) * Math.log((1 - epsilon) / epsilon)
        : 1;

    return sentences.map(s => ({
        ...s,
        score: range > 0
            ? 1 / (1 + Math.exp(-k * (s.score - mid)))
            : 1,
    }));
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
  const epsilon = 0.0; // adjust between 0 < ε < 0.5 for desired endpoint closeness
  const k = (2 / rangeZ) * Math.log((1 - epsilon) / epsilon);

  // 4) apply logistic with that k
  return sentences.map((s, i) => {
    const z = zScores[i];
    const raw = 1 / (1 + Math.exp(-k * z));
    return { ...s, score: raw };
  });
}

export function normalizeSentencesRobust(
  sentences: HTMLSentenceMapping[],
): HTMLSentenceMapping[] {
  if (sentences.length === 0) return [];

  // Extract and sort scores
  const scores = sentences
    .map(s => s.score)
    .sort((a, b) => a - b);

  // Compute Q1 and Q3
  const q1 = scores[Math.floor((scores.length - 1) * 0.25)];
  const q3 = scores[Math.floor((scores.length - 1) * 0.75)];

  // Prevent division by zero
  const iqr = q3 - q1 || 1;

  return sentences.map(s => {
    // Linearly scale relative to [q1, q3]
    const raw = (s.score - q1) / iqr;
    // Clip into [0,1]
    const clipped = Math.min(Math.max(raw, 0), 1);
    return { ...s, score: clipped };
  });
}