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

// /**
//  * Generates a heat-based HSL red color.
//  */
// function getHeatColorMono(heat: number): string {
//   // Normalize heat value between 0 and 1
//   const norm = heatScoreMax > heatScoreMin
//     ? (heat - heatScoreMin) / (heatScoreMax - heatScoreMin)
//     : 0;
//   // Generate an HSL red color based on normalized score

//   // Using a hue of 10 (a gentle orange-red), moderate saturation, and controlled lightness
//   const hue = 0; // subtle orange-red
//   const saturation = 55 + (norm * 30); // from 50% (pale) to 80% (strong but readable)
//   const lightness = 90 - (norm * 40); // from 90% (very pale) to 50% (clearly visible but readable)

//   return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
// }

// function getHeatColor(score: number) {
//   const min = heatScoreMin;
//   const max = heatScoreMax;
//   // Normalize the score between 0 and 1
//   const normalizedScore = Math.max(0, Math.min(1, (score - min) / (max - min)));

//   // Define the color stops for a more continuous, Wikipedia-friendly gradient
//   // Starting with almost white (very pale yellow)
//   const colors = [
//     { pos: 0.0, r: 255, g: 255, b: 230 },  // Very pale yellow (almost white)
//     { pos: 0.3, r: 255, g: 245, b: 170 },  // Pale yellow
//     { pos: 0.5, r: 255, g: 220, b: 120 },  // Light yellow-orange
//     { pos: 0.7, r: 255, g: 180, b: 80 },   // Orange
//     { pos: 0.85, r: 255, g: 120, b: 50 },  // Deep orange
//     { pos: 1.0, r: 255, g: 60, b: 40 }     // Red
//   ];

//   // Find the two color stops that our normalized score falls between
//   let colorIndex = 0;
//   for (let i = 1; i < colors.length; i++) {
//     if (normalizedScore <= colors[i].pos) {
//       break;
//     }
//     colorIndex = i;
//   }

//   // If we're at the last stop or exactly at a color stop, return that color
//   if (colorIndex === colors.length - 1 || normalizedScore === colors[colorIndex].pos) {
//     const color = colors[colorIndex];
//     return `#${decToHex(color.r)}${decToHex(color.g)}${decToHex(color.b)}`;
//   }

//   // Otherwise, interpolate between the two adjacent colors
//   const lowerColor = colors[colorIndex];
//   const upperColor = colors[colorIndex + 1];

//   // Calculate how far between the two stops our normalized score is
//   const range = upperColor.pos - lowerColor.pos;
//   const rangePct = (normalizedScore - lowerColor.pos) / range;

//   // Interpolate between the two colors
//   const r = Math.floor(lowerColor.r + (upperColor.r - lowerColor.r) * rangePct);
//   const g = Math.floor(lowerColor.g + (upperColor.g - lowerColor.g) * rangePct);
//   const b = Math.floor(lowerColor.b + (upperColor.b - lowerColor.b) * rangePct);

//   // Convert to hex and return
//   return `#${decToHex(r)}${decToHex(g)}${decToHex(b)}`;
// }

// // Helper function to convert decimal to 2-digit hex
// function decToHex(dec: number) {
//   const hex = dec.toString(16);
//   return hex.length === 1 ? "0" + hex : hex;
// }


// /**
//  *
//  * function getHeatColor(heat: number): string {
//  const norm = heatScoreMax > heatScoreMin
//  ? (heat - heatScoreMin) / (heatScoreMax - heatScoreMin)
//  : 0;

//  // Hue gradually moves from Yellow (50°) → Red (0°)
//  const hue = 50 - (50 * norm);

//  // Saturation smoothly increases from 0% (white) to 100% (fully colored)
//  const saturation = norm * 100;

//  // Lightness gradually decreases from 95% (white/pale) to 50% (strong/darker color)
//  const lightness = 95 - (45 * norm);

//  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
//  }
//  */