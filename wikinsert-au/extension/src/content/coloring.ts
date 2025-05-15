export function getHeatColor(score: number, min: number, max: number) {
    // Normalize the score between 0 and 1
    const norm = max > min
        ? Math.max(0, Math.min(1, (score - min) / (max - min)))
        : 0;

    // Define RGB values for continuous gradient
    let r, g, b;

    r = 255;

    // Green channel: starts high (yellow) and gradually decreases to zero (red)
    // Using cubic easing to make the transition smoother
    g = Math.round(255 * (1 - Math.pow(norm, 1.5)));

    // Blue channel: very low to maintain vibrant colors
    // Slight presence at the beginning helps create pale yellow
    b = Math.round(230 * (1 - norm));

    // For very low values (norm < 0.1), make it closer to white
    if (norm < 0.1) {
        const whiteBlend = 1 - (norm * 10); // 1 at norm=0, 0 at norm=0.1
        r = Math.round(r * (1 - whiteBlend) + 255 * whiteBlend);
        g = Math.round(g * (1 - whiteBlend) + 255 * whiteBlend);
        b = Math.round(b * (1 - whiteBlend) + 255 * whiteBlend);
    }

    return `rgb(${r}, ${g}, ${b})`;
}