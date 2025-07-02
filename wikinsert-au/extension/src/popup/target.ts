import { scopedKey } from "../utils";

export function initTargetDisplay(pageKey: string) {
    // Check if a target is selected initally
    chrome.storage.session.get([scopedKey(pageKey, "target")], (result) => {
        const targetTitle = result[scopedKey(pageKey, "target")];
        if (targetTitle) {
            updateTargetDisplay(targetTitle);
        } else {
            updateTargetDisplay();
        }
    });

    // Check if the target is changed, listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "session") {
            const targetChange = changes[scopedKey(pageKey, "target")];
            const targetTitle = targetChange ? targetChange.newValue : undefined;
            updateTargetDisplay(targetTitle);
        }
    });

    initClearBtn(pageKey);
}

export function updateTargetDisplay(targetTitle?: string) {
    if (typeof targetTitle === "undefined") {
        const targetStatusEl = document.getElementById("targetStatus") as HTMLDivElement | null;
        if (targetStatusEl && !targetStatusEl.classList.contains("hidden")) {
            return; // keep existing display
        }
    }
    const searchInput = document.getElementById(
        "searchInput",
    ) as HTMLInputElement | null;
    const selectedTargetName = document.getElementById(
        "selectedTargetName",
    ) as HTMLSpanElement | null;
    const clearTargetBtn = document.getElementById(
        "clearTargetBtn",
    ) as HTMLButtonElement | null;
    const targetStatus = document.getElementById(
        "targetStatus",
    ) as HTMLDivElement | null;
    const noTargetMessage = document.getElementById(
        "noTargetMessage",
    ) as HTMLDivElement | null;

    if (
        !selectedTargetName ||
        !clearTargetBtn ||
        !targetStatus ||
        !noTargetMessage ||
        !searchInput
    ) {
        console.error("One or more elements not found");
        return;
    }
    searchInput.value = "";
    if (targetTitle) {
        selectedTargetName.textContent = `Inserting "${targetTitle}"`;
        targetStatus.classList.remove("hidden");
        noTargetMessage.classList.add("hidden");
    } else {
        selectedTargetName.textContent = "";
        targetStatus.classList.add("hidden");
        noTargetMessage.classList.remove("hidden");
    }
}

function initClearBtn(pageKey: string) {
    const clearTargetBtn = document.getElementById(
        "clearTargetBtn",
    ) as HTMLButtonElement | null;

    if (!clearTargetBtn) {
        console.error("Clear target button not found");
        return;
    }

    clearTargetBtn.addEventListener("click", () => {
        chrome.storage.session.remove([scopedKey(pageKey, "target")], () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id!, {action: "remove"});
            });
            updateTargetDisplay("");
        });
    });
}
