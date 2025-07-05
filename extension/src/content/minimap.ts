import {HTMLSentenceMapping} from "../types";
import {getHeatColor} from "./coloring";

let container: HTMLDivElement | null = null;
let indicator: HTMLDivElement | null = null;

/** Build (or rebuild) the minimap for the current article. */
export function buildMinimap(sentences: HTMLSentenceMapping[]) {
    removeMinimap();


    // ────────────────── outer frame ──────────────────
    container = document.createElement("div");
    container.id = "wikinsert-minimap";
    Object.assign(container.style, {
        width: "110px",
        height: "31vh",
        marginTop: "0.5rem",
        background: "#fff",
        border: "1px solid #d0d0d0",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative",
        zIndex: "9999",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
    });
    const outerWrapper = document.getElementById("wikinsert-outer-wrapper");
    if (outerWrapper) {
        outerWrapper.appendChild(container);
    } else {
        document.body.appendChild(container);
    }

        /* ─────── background “text” texture ───────
       A very cheap vertical stripe pattern that hints at
       sentence/line rhythm so empty regions are visible. */
    const texture = document.createElement("div");
    Object.assign(texture.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "0",
        background:
            "repeating-linear-gradient(" +
            "to bottom," +
            "rgba(0,0,0,0.1) 0 1px," +    // 1‑pixel dark stripe
            "transparent 1px 3px" +         // 2‑pixel gap
            ")",
        pointerEvents: "none",
    });
    container.appendChild(texture);


    // ────────────────── draw the heat bars ──────────────────
    const content = document.getElementById("mw-content-text")!;
    const articleHeight = content.scrollHeight;       // full article height in px

    sentences.forEach(s => {
        const span = document.getElementById(`sentence-${s.id}`) as HTMLElement | null;
        if (!span) return;

        const relTopPx = span.offsetTop;              // relative to content container
        const relHeightPx = span.offsetHeight || 14;  // 14 = typical line height fallback

        const bar = document.createElement("div");
        const topPct  = (relTopPx     / articleHeight) * 100;
        const heightPct = (relHeightPx / articleHeight) * 100;

        Object.assign(bar.style, {
            position: "absolute",
            left: "0",
            width: "100%",
            top: `${topPct}%`,
            height: `${heightPct < 0.2 ? 0.2 : heightPct}%`, // never disappear entirely
            background: getHeatColor(s.score, 0, 1),
            zIndex: "1",
        });

        container!.appendChild(bar);
    });

    // ────────────────── viewport indicator ──────────────────
    indicator = document.createElement("div");
    indicator.id = "wikinsert-minimap-indicator";
    Object.assign(indicator.style, {
        position: "absolute",
        left: "0",
        width: "100%",
        background: "rgba(0,0,0,0.15)",
        pointerEvents: "none",
        zIndex: "2",
    });
    container.appendChild(indicator);

    const updateIndicator = () => {
        const y      = window.scrollY - content.offsetTop;
        const topPct = (y / articleHeight) * 100;
        const hPct   = (window.innerHeight / articleHeight) * 100;
        indicator!.style.top    = `${topPct}%`;
        indicator!.style.height = `${hPct}%`;
    };
    updateIndicator();
    window.addEventListener("scroll", () => requestAnimationFrame(updateIndicator));

    // ────────────────── click-to-scroll behaviour ──────────────────
    container.addEventListener("click", (ev) => {
        const bbox   = container!.getBoundingClientRect();
        const ratio  = (ev as MouseEvent).clientY - bbox.top;
        const target = (ratio / bbox.height) * articleHeight;
        window.scrollTo({ top: target + content.offsetTop, behavior: "smooth" });
    });
}

/** Remove minimap and listeners. */
export function removeMinimap() {
    const old = document.getElementById("wikinsert-minimap");
    if (old) {
        old.remove();
        container = null;
        indicator = null;
    }
}