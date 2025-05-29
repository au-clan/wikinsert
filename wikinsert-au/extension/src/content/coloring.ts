import { highlightSentences, removeHighlighting } from "./highlighting";

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

  return `rgba(${r}, ${g}, ${b}, 0.6)`;
}

export function createSpectrumReference() {
  const wrapper = document.createElement("div");
  wrapper.id = "heatmap-wrapper";
  wrapper.style.position = "fixed";
  wrapper.style.display = "flex";
  wrapper.style.top = "50%";
  wrapper.style.transform = "translateY(-50%)";
  wrapper.style.right = "0";
  wrapper.style.zIndex = "9999";

  const spectrum = document.createElement("div");
  spectrum.id = "heatmap-spectrum";
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
    <div style="font-weight: bold; text-align: center;">Relevance Heatmap</div>
    <div id="heatmap-spectrum-bars" style="display: flex; height: 3rem; width: 12rem; border: 1px solid #e5e7eb; border-radius: 0.25rem; overflow: hidden;"></div>
    <div style="display: flex; justify-content: space-between; width: 100%; font-size: 10px; padding: 0 0.25rem;">
      <span>Low (0)</span>
      <span>High (1)</span>
    </div>
  `;
  const barContainer = spectrum.querySelector("#heatmap-spectrum-bars") as HTMLElement;
  if (barContainer) {
    const barCount = 100;
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement("div");
      bar.style.flex = "1";
      bar.style.height = "100%";
      const normalized = i / (barCount - 1);
      bar.style.backgroundColor = getHeatColor(normalized, 0, 1);
      barContainer.appendChild(bar);
    }
  }
  wrapper.appendChild(spectrum);

    const sliderBox = document.createElement("div");
  sliderBox.id = "heatmap-slider-box";
  sliderBox.style.backgroundColor = "white";
  sliderBox.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
  sliderBox.style.borderTopLeftRadius = "0.5rem";
  sliderBox.style.borderBottomLeftRadius = "0.5rem";
  sliderBox.style.padding = "0.75rem";
  sliderBox.style.marginTop = "0.5rem";
  sliderBox.style.display = "flex";
  sliderBox.style.alignItems = "center";
  sliderBox.style.gap = "0.5rem";
  sliderBox.style.fontSize = "12px";
  sliderBox.style.color = "#1f2937";
  sliderBox.innerHTML = `
    <div id="slider-container" style="display:flex; align-items:center; gap:0.5rem; width:100%; padding:0.5rem 0; font-size:12px;">
      <input type="range" id="intensitySlider" min="0" max="1" step="0.01" value="0.5" style="flex:1;" />
      <span id="intensityValue">0.50</span>
    </div>
  `;
  wrapper.appendChild(sliderBox);

  document.body.appendChild(wrapper);

  // Add event listener to the slider
  const slider = document.getElementById("intensitySlider") as HTMLInputElement;
  const valueSpan = document.getElementById("intensityValue") as HTMLElement;


  slider.style.appearance = "none";
  slider.style.border = "1px solid #e5e7eb";
  slider.style.borderRadius = "0.25rem";
  const staticGradient = `linear-gradient(
    to right,
    ${getHeatColor(0, 0, 1)} 0%,
    ${getHeatColor(0.33, 0, 1)} 33%,
    ${getHeatColor(0.66, 0, 1)} 66%,
    ${getHeatColor(1, 0, 1)} 100%
  )`;
  slider.style.background = staticGradient;

  let highlightTimeout: number;

  chrome.storage.local.get("intensity", (res) => {
    const v = typeof res.intensity === "number" ? res.intensity : 0.5;
    slider.value = v.toString();
    valueSpan.textContent = v.toFixed(2);
  });
  slider.addEventListener("input", () => {
    const v = parseFloat(slider.value);
    valueSpan.textContent = v.toFixed(2);
    chrome.storage.local.set({ intensity: v });
    // Remove existing highlights immediately
    removeHighlighting();
    // Debounce reapplication of highlights
    if (highlightTimeout) {
      clearTimeout(highlightTimeout);
    }
    highlightTimeout = window.setTimeout(() => {
      chrome.storage.session.get(["pageInfo"], ({ pageInfo }) => {
        const pageKey = pageInfo.pageKey;
        chrome.storage.local.get([`${pageKey}-heatmap`], (result) => {
          const heatmap = result[`${pageKey}-heatmap`] || [];
          highlightSentences(heatmap);
        });
      });
    }, 25);
  });
  hideSpectrum();
}

export function showSpectrum() {
    const wrapper = document.getElementById("heatmap-wrapper");
  if (wrapper) {
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
  }
}

export function hideSpectrum() {
    const wrapper = document.getElementById("heatmap-wrapper");
  if (wrapper) {
    wrapper.style.display = "none";
  }
}