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
  <div id="target-title" style="font-weight:600; line-height:1.2;"></div>
  <div id="target-desc"
       style="font-size:11px; opacity:.75; margin:.15rem 0; line-height:1.3;"></div>`;
    wrapper.appendChild(header);

    /* 2. intensity slider (now the only control block) */
    const sliderBox = document.createElement("div");
    sliderBox.id = "intensity-container";
    sliderBox.style.padding = "0.75rem";
    sliderBox.innerHTML = `
  <div style="font-weight:600; margin-bottom:.25rem;">Highlight&nbsp;threshold</div>

  <!-- five radio buttons in a single row -->
  <fieldset id="intensityRadios"
            style="display:flex; justify-content:space-between; width:100%; border:0; padding:0; margin:0;">
    ${[
        {label: "Low", val: 0},
        {label: "", val: .25},
        {label: "Medium", val: .50},
        {label: "", val: .75},
        {label: "High", val: 1},
    ].map(({label, val}, i) => `
      <label style="
        flex:1; display:flex; flex-direction:column; align-items:center;
        gap:4px; cursor:pointer; font-size:10px; user-select:none;
      ">
        <input type="radio" name="intensity"
               value="${val}" ${i === 2 ? "checked" : ""}
                style="appearance:none; width:1.1rem; height:1.1rem;
                      border-radius:50%; border:3px solid #e5e7eb;
                      margin-bottom:2px; cursor:pointer; transition:all 0.2s;
                      background:${getHeatColor(val, 0, 1)};">
        ${label ? `<span style="font-weight:500;">${label}</span>` : '<span style="height:14px;"></span>'}
      </label>
    `).join("")}
  </fieldset>`;
    wrapper.appendChild(sliderBox);

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
            if (area !== "local") return;
            if (watched.some(k => k in chg)) fill();
        });
    });
    updateRadioStyles();  // initial style update
    hideFloatingDisplay();   // start collapsed
}

/* ────────── helpers used elsewhere ────────── */

export function showFloatingDisplay(): void {
    const w = document.getElementById(FLOATING_INFO_ID);
    if (w) w.style.display = "flex";
}

export function hideFloatingDisplay(): void {
    const w = document.getElementById(FLOATING_INFO_ID);
    if (w) w.style.display = "none";
}