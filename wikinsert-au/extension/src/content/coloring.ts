export function getHeatColor(score: number, min: number, max: number) {
  // Normalize the score between 0 and 1
  const norm =
      max > min ? Math.max(0, Math.min(1, (score - min) / (max - min))) : 0;

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
    const whiteBlend = 1 - norm * 10; // 1 at norm=0, 0 at norm=0.1
    r = Math.round(r * (1 - whiteBlend) + 255 * whiteBlend);
    g = Math.round(g * (1 - whiteBlend) + 255 * whiteBlend);
    b = Math.round(b * (1 - whiteBlend) + 255 * whiteBlend);
  }

  return `rgb(${r}, ${g}, ${b})`;
}

export function createSpectrumReference() {
  const spectrum = document.createElement("div");
  spectrum.id = "heatmap-spectrum";
  spectrum.style.position = "fixed";
  spectrum.style.top = "50%";
  spectrum.style.transform = "translateY(-50%)";
  spectrum.style.right = "0";
  spectrum.style.zIndex = "9999";
  spectrum.style.backgroundColor = "white";
  spectrum.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
  spectrum.style.borderTopLeftRadius = "0.5rem";
  spectrum.style.borderBottomLeftRadius = "0.5rem";
  spectrum.style.padding = "0.75rem";
  spectrum.style.display = "flex";
  spectrum.style.flexDirection = "column";
  spectrum.style.alignItems = "center";
  spectrum.style.gap = "0.5rem";
  spectrum.style.fontSize = "12px";
  spectrum.style.color = "#1f2937";

  spectrum.innerHTML = `
    <div style="font-weight: bold; text-align: center;">Heatmap Intensity</div>
    <div id="heatmap-spectrum-bars" style="display: flex; height: 3rem; width: 12rem; border: 1px solid #e5e7eb; border-radius: 0.25rem; overflow: hidden;"></div>
    <div style="display: flex; justify-content: space-between; width: 100%; font-size: 10px; padding: 0 0.25rem;">
      <span>Low</span>
      <span>High</span>
    </div>
  `;
  const barContainer = spectrum.querySelector("#heatmap-spectrum-bars") as HTMLElement;
  if (barContainer) {
    const barCount = 10;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement("div");
      bar.style.flex = "1";
      bar.style.height = "100%";
      const normalized = i / (barCount - 1);
      bar.style.backgroundColor = getHeatColor(normalized, 0, 1);
      barContainer.appendChild(bar);
    }
  }
  spectrum.style.display = "none";
  document.body.appendChild(spectrum);
}

export function showSpectrum() {
  const spectrum = document.getElementById("heatmap-spectrum");
  if (spectrum) {
    spectrum.style.display = "flex";
  }
}

export function hideSpectrum() {
  const spectrum = document.getElementById("heatmap-spectrum");
  if (spectrum) {
    spectrum.style.display = "none";
  }
}