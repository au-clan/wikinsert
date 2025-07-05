export function getHeatColor(score: number, min: number, max: number) {
  let r, g, b;
  // Map norm to a WCAG‑AAA‑compliant heat spectrum: white → yellow → saturated red (#FF5E5E)
  r = 255;
  if (score <= 0.5) {
    const t = score / 0.5;  // 0 at low, 1 at mid
    g = 255;
    b = Math.round(255 * (1 - t)); // 255 → 0
  } else {
    const t = (score - 0.5) / 0.5; // 0 at mid, 1 at high
    g = Math.round(255 + (94 - 255) * t); // 255 → 94
    b = Math.round(0 + (94 - 0) * t); // 0   → 94
  }

  // For very low values (norm < 0.1), make it closer to white
  if (score < 0.1) {
    const whiteBlend = 1 - score * 10; // 1 at norm=0, 0 at norm=0.1
    r = Math.round(r * (1 - whiteBlend) + 255 * whiteBlend);
    g = Math.round(g * (1 - whiteBlend) + 255 * whiteBlend);
    b = Math.round(b * (1 - whiteBlend) + 255 * whiteBlend);
  }
    const alpha = Math.min(Math.max((score + 0.3) / 4, 0), 1);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}