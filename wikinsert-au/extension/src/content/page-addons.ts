import {openPopup, scopedKey} from "../utils";
import {getHeatColor} from "./coloring";
import {highlightSentences, removeHighlighting} from "./highlighting";
import { HTMLSentenceMapping } from "../types";

/* ────────── navigation tab ────────── */

export function addWikinsertButtonToNavBar(): void {
    const menu = document.querySelector("#p-views .vector-menu-content-list");
    if (!menu) return;

    const li = document.createElement("li");
    li.id = "ca-wikinsert";
    li.className = "vector-tab-noicon mw-list-item";

    const a = document.createElement("a");
    a.href = "#";
    a.onclick = e => {
        e.preventDefault();
        openPopup();
    };

    const span = document.createElement("span");
    span.textContent = "Wikinsert";

    a.appendChild(span);
    li.appendChild(a);
    menu.prepend(li);
}

/* ────────── floating info card ────────── */

const FLOATING_INFO_ID = "floating-info-wrapper";

export function floatingInfoDisplay(): void {
    const currentPageKey = location.href.split('#')[0];
    const intensityKey = scopedKey(currentPageKey, "intensity");

    const wrapper = document.createElement("div");
    wrapper.id = FLOATING_INFO_ID;
    Object.assign(wrapper.style, {
        position: "fixed",
        top: "50%", right: "1rem",
        transform: "translateY(-50%)",
        zIndex: "9999",
        display: "flex",
        flexDirection: "column",
        maxWidth: "min(16rem, calc(100vw - 2rem))",
        background: "#fff",
        boxShadow: "0 2px 12px rgba(0,0,0,.15)",
        borderRadius: ".5rem",
        fontSize: "12px",
        color: "#1f2937",
    });

    /* 1. target header */
    const header = document.createElement("div");
    header.id = "target-info";
    header.style.padding = "0.75rem";
    header.style.borderBottom = "1px solid #e5e7eb";
    header.innerHTML = `
  <div id="target-title" style="font-size:14px; font-weight:600; line-height:1.25;"></div>
  <div id="target-desc"
       style="font-size:11px; opacity:.75; margin:.15rem 0; line-height:1.3;"></div>`;
    wrapper.appendChild(header);

    /* 2. intensity slider (now the only control block) */
    const sliderBox = document.createElement("div");
    sliderBox.id = "intensity-container";
    sliderBox.style.padding = "0.75rem";
    sliderBox.style.borderBottom = "1px solid #e5e7eb";

    // Function to generate radio buttons HTML from bins array
    const generateRadiosHtml = (bins: number[]) => {
        // labels for the 5 radios
        const labels = ["Very&nbsp;Low", "", "Medium", "", "Very&nbsp;High"];
        return `
  <div style="font-weight:600; margin-bottom:.25rem;">Highlight&nbsp;threshold</div>

  <!-- five radio buttons in a single row -->
  <fieldset id="intensityRadios"
            style="display:grid; grid-template-columns:repeat(5, 1fr); width:100%; border:0; padding:0; margin:0;">
    ${bins.slice(0, 5).map((val, i) => `
      <label style="
        display:flex; flex-direction:column; align-items:center;
        gap:4px; cursor:pointer; font-size:10px; user-select:none;
      ">
        <input type="radio" name="intensity"
               value="${val.toFixed(3)}" ${i === 2 ? "checked" : ""}
                style="appearance:none; width:1.1rem; height:1.1rem;
                      border-radius:50%; border:3px solid #e5e7eb;
                      margin-bottom:2px; cursor:pointer; transition:all 0.2s;
                      background:${radioBg(val)};">
        ${labels[i] ? `<span style="font-weight:500;">${labels[i]}</span>` : '<span style="height:14px;"></span>'}
      </label>
    `).join("")}
  </fieldset>`;
    };

    // Initially set static HTML, then try to replace with dynamic bins if available
//     sliderBox.innerHTML = `
//   <div style="font-weight:600; margin-bottom:.25rem;">Highlight&nbsp;threshold</div>

//   <!-- five radio buttons in a single row -->
//   <fieldset id="intensityRadios"
//             style="display:grid; grid-template-columns:repeat(5, 1fr); width:100%; border:0; padding:0; margin:0;">
//     ${[
//         {label: "Very&nbsp;Low", val: 0},
//         {label: "", val: .15},
//         {label: "Medium", val: .40},
//         {label: "", val: .75},
//         {label: "Very&nbsp;High", val: .90},
//     ].map(({label, val}, i) => `
//       <label style="
//         display:flex; flex-direction:column; align-items:center;
//         gap:4px; cursor:pointer; font-size:10px; user-select:none;
//       ">
//         <input type="radio" name="intensity"
//                value="${val}" ${i === 2 ? "checked" : ""}
//                 style="appearance:none; width:1.1rem; height:1.1rem;
//                       border-radius:50%; border:3px solid #e5e7eb;
//                       margin-bottom:2px; cursor:pointer; transition:all 0.2s;
//                       background:${radioBg(val)};">
//         ${label ? `<span style="font-weight:500;">${label}</span>` : '<span style="height:14px;"></span>'}
//       </label>
//     `).join("")}
//   </fieldset>`;
  
    wrapper.appendChild(sliderBox);

    document.body.appendChild(wrapper);

    /* helper to attach event listeners and update styles for radios */
    const updateRadioStyles = () => {
        radios.forEach(radio => {
            const input = radio as HTMLInputElement;
            if (input.checked) {
                input.style.borderColor = "#3366cc";
                input.style.borderWidth = input.checked ? "2.5px" : "2px";
                input.style.boxShadow = "0 0 0 2px rgba(51, 102, 204, 0.2)";
            } else {
                input.style.borderColor = "#e5e7eb";
                input.style.borderWidth = "2px";
                input.style.boxShadow = "none";
            }
        });
    };

    /* store & re-highlight on change */
    const attachListeners = () => {
        radios.forEach(radio => {
            radio.addEventListener("change", () => {
                const v = Number((radio as HTMLInputElement).value);

                chrome.storage.session.set({ [intensityKey]: v });
                updateRadioStyles();

                /* debounce like before */
                removeHighlighting();
                clearTimeout((window as any).__intDebounce);
                (window as any).__intDebounce = setTimeout(() => {
                    // retrieve the scoped heatmap for this page
                    const heatmapKey = scopedKey(currentPageKey, "heatmap");
                    chrome.storage.session.get([heatmapKey], (res) => {
                        const heatmap = (res[heatmapKey] as HTMLSentenceMapping[]) || [];
                        if (heatmap.length === 0) {
                            hideFloatingDisplay();
                        } else {
                            highlightSentences(heatmap, false);
                        }
                    });
                }, 25);
            });
        });
    };

    // Initially create radios array with empty radios, will be replaced on updateSlider call
    const radios: HTMLInputElement[] = Array.from(
        sliderBox.querySelectorAll<HTMLInputElement>("input[name='intensity']")
    );
    /* helper to update slider HTML and reattach listeners */
    const updateSlider = (bins: number[]) => {
        sliderBox.innerHTML = generateRadiosHtml(bins);
        radios.length = 0; // clear old radios array
        const newRadios = Array.from(
            sliderBox.querySelectorAll<HTMLInputElement>("input[name='intensity']")
        );
        radios.push(...newRadios);
        attachListeners();
        updateRadioStyles();

        /* initialise from storage */
        chrome.storage.session.get([intensityKey], (r) => {
            const v = typeof r[intensityKey] === "number" ? r[intensityKey] : 0.5;
            const match = radios.find(r => Number(r.value) === v);
            (match ?? radios[Math.min(2, radios.length - 1)]).checked = true;  // fallback within bounds
            updateRadioStyles();
        });
    };


    /* initialise from storage */
    chrome.storage.session.get([intensityKey], (r) => {
        if (!radios.length) return;                 // nothing to toggle yet
        const v = typeof r[intensityKey] === "number" ? r[intensityKey] : 0.5;
        const match = radios.find(r => Number(r.value) === v);
        (match ?? radios[Math.min(2, radios.length - 1)]).checked = true;
        updateRadioStyles();
    });

    attachListeners();
    updateRadioStyles();


    /* auto-sync target info */
    chrome.storage.session.get(
      [scopedKey(currentPageKey, "pageInfo")],
      (res) => {
        const pageInfo = res[scopedKey(currentPageKey, "pageInfo")];
        console.log("Page info:", pageInfo);
        const key = pageInfo.pageKey;
        if (!key) {
            console.warn("No page key found in session storage.");
            hideFloatingDisplay();
        }
        const watched = [
            `${key}-target`,
            `${key}-targetDescription`,
            `${key}-targetUrl`,
        ];

        const fill = () =>
            chrome.storage.session.get(watched, (r) =>
                paintHeader(
                    r[watched[0]] || "",
                    r[watched[1]] || "",
                    r[watched[2]] || "",
                )
            );

        const paintHeader = (title: string, desc: string, url: string) => {
            (document.getElementById("target-title") as HTMLElement).textContent = title || "—";

            const descEl = document.getElementById("target-desc") as HTMLElement;

            if (url) {
                /* description + inline “See article” link */
                const safeDesc = desc ? `${desc}.` : "";
                descEl.innerHTML = `${safeDesc}
            <a href="${url}"
                target="_blank" rel="noopener noreferrer"
                style="color:#3366cc;">See&nbsp;article</a>`;
            } else {
                /* just plain text */
                descEl.textContent = desc;
            }
        };

        fill();
        chrome.storage.onChanged.addListener((chg, area) => {
            if (area === "session" && watched.some(k => k in chg)) fill();
            if (area === "session" && scopedKey(currentPageKey, "dynamicBins") in chg) {
                const bins = chg[scopedKey(currentPageKey, "dynamicBins")].newValue as number[];
                if (Array.isArray(bins) && bins.length === 6) {
                    updateSlider(bins);
                }
            }
        });
    });

    // Try to load dynamicBins from session and update sliderBox innerHTML if available
    chrome.storage.session.get(
      [scopedKey(currentPageKey, "dynamicBins")],
      (res) => {
        const bins = res[scopedKey(currentPageKey, "dynamicBins")] as number[];
        if (Array.isArray(bins) && bins.length === 6) {
            updateSlider(bins);
        }
      }
    );

    updateRadioStyles();  // initial style update
    hideFloatingDisplay();   // start collapsed
}

/* helper: same RGB as getHeatColor, but always α = 0.6 */
const radioBg = (v: number) => {
    const [r, g, b] = getHeatColor(v, 0, 1)
        .match(/\d+/g)!.slice(0, 3);          // grab “r, g, b”
    return `rgba(${r}, ${g}, ${b}, 0.6)`;   // hard-coded alpha
};

/* ────────── helpers used elsewhere ────────── */

export function showFloatingDisplay(): void {
    const w = document.getElementById(FLOATING_INFO_ID);
    if (w) w.style.display = "flex";
}

export function hideFloatingDisplay(): void {
    const w = document.getElementById(FLOATING_INFO_ID);
    if (w) w.style.display = "none";
}
