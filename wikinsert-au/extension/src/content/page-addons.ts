import {openPopup} from "../utils";
import {getHeatColor} from "./coloring";
import {highlightSentences, removeHighlighting} from "./highlighting";

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
    sliderBox.innerHTML = `
  <div style="font-weight:600; margin-bottom:.25rem;">Highlight&nbsp;threshold</div>

  <!-- five radio buttons in a single row -->
  <fieldset id="intensityRadios"
            style="display:grid; grid-template-columns:repeat(5, 1fr); width:100%; border:0; padding:0; margin:0;">
    ${[
        {label: "Very&nbsp;Low", val: 0},
        {label: "", val: .15},
        {label: "Medium", val: .40},
        {label: "", val: .75},
        {label: "Very&nbsp;High", val: .90},
    ].map(({label, val}, i) => `
      <label style="
        display:flex; flex-direction:column; align-items:center;
        gap:4px; cursor:pointer; font-size:10px; user-select:none;
      ">
        <input type="radio" name="intensity"
               value="${val}" ${i === 2 ? "checked" : ""}
                style="appearance:none; width:1.1rem; height:1.1rem;
                      border-radius:50%; border:3px solid #e5e7eb;
                      margin-bottom:2px; cursor:pointer; transition:all 0.2s;
                      background:${radioBg(val)};">
        ${label ? `<span style="font-weight:500;">${label}</span>` : '<span style="height:14px;"></span>'}
      </label>
    `).join("")}
  </fieldset>`;
    wrapper.appendChild(sliderBox);
    const statsBox = document.createElement("div");
    statsBox.id = "sentence-stats";
    Object.assign(statsBox.style, {
        padding: "0.75rem",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        rowGap: "4px",
        columnGap: "4px",
        fontSize: "11px",
        opacity: ".9",
        textAlign: "center",
    });

    /* first row – coloured badges (number only) */
    statsBox.innerHTML = `
        <div style="display:flex; gap:5px; flex-direction:column; align-items:center;">
            <span id="stat-veryHigh-val"
                style="
                    display:inline-flex; align-items:center; justify-content:center;
                    width:2.5rem; height:1.25rem;
                    border-radius:0.625rem;
                    font-variant-numeric:tabular-nums;
                    background:rgba(255, 94, 94, 0.6); color:#111827;">
            0
            </span>
            <span style="font-size:10px;">Very&nbsp;High</span>
        </div>
        <div style="display:flex; gap:5px; flex-direction:column; align-items:center;">
            <span id="stat-high-val"
                style="
                    display:inline-flex; align-items:center; justify-content:center;
                    width:2.5rem; height:1.25rem;
                    border-radius:0.625rem;
                    font-variant-numeric:tabular-nums;
                    background:rgba(255, 142, 66, 0.6); color:#111827;">
            0
            </span>
            <span style="font-size:10px;">High</span>
        </div>
        <div style="display:flex; gap:5px; flex-direction:column; align-items:center;">
            <span id="stat-medium-val"
                style="
                    display:inline-flex; align-items:center; justify-content:center;
                    width:2.5rem; height:1.25rem;
                    border-radius:0.625rem;
                    font-variant-numeric:tabular-nums;
                    background:rgba(255, 255, 0, 0.6); color:#111827;">
            0
            </span>
            <span style="font-size:10px;">Medium</span>
        </div>`;
    wrapper.appendChild(statsBox);

    document.body.appendChild(wrapper);

    /* slider behaviour */
    const radios = Array.from(
        sliderBox.querySelectorAll<HTMLInputElement>("input[name='intensity']")
    );

    /* initialise from storage */
    chrome.storage.local.get("intensity", (r) => {
        const v = typeof r.intensity === "number" ? r.intensity : 0.5;
        const match = radios.find(r => Number(r.value) === v);
        (match ?? radios[2]).checked = true;      // default to “Medium”
    });

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
    radios.forEach(radio => {
        radio.addEventListener("change", () => {
            const v = Number((radio as HTMLInputElement).value);

            chrome.storage.local.set({intensity: v});
            updateRadioStyles();

            /* debounce like before */
            removeHighlighting();
            clearTimeout((window as any).__intDebounce);
            (window as any).__intDebounce = setTimeout(() => {
                chrome.storage.session.get("pageInfo", ({pageInfo}) => {
                    const key = pageInfo?.pageKey;
                    if (!key) return hideFloatingDisplay();

                    chrome.storage.local.get([`${key}-heatmap`], res =>
                        highlightSentences(res[`${key}-heatmap`] || [], false)
                    );
                });
            }, 25);
        });
    });
    const paintStats = (stats?: { medium: number; high: number; veryHigh: number }) => {
        const box = document.getElementById("sentence-stats") as HTMLElement;
        if (!box) return;

        if (stats) {
            box.style.display = "grid";
            (document.getElementById("stat-veryHigh-val") as HTMLElement).textContent = String(stats.veryHigh);
            (document.getElementById("stat-high-val") as HTMLElement).textContent = String(stats.high);
            (document.getElementById("stat-medium-val") as HTMLElement).textContent = String(stats.medium);
        } else {
            box.style.display = "none";
        }
    };
    chrome.storage.session.get("sentenceStats", ({sentenceStats}) =>
        paintStats(sentenceStats)
    );

    /* auto-sync target info */
    chrome.storage.session.get("pageInfo", ({pageInfo}) => {
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
            chrome.storage.local.get(watched, (r) =>
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
            if (area === "local" && watched.some(k => k in chg)) fill();
            if (area === "session" && "sentenceStats" in chg) {
                paintStats(chg.sentenceStats.newValue);
            }
        });
    });
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
