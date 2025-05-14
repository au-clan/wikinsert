export function initTargetDisplay(pageKey: string) {
    // Check if a target is selected
    chrome.storage.local.get([`${pageKey}-target`], (result) => {
        const targetTitle = result[`${pageKey}-target`];
        if (targetTitle) {
            updateTargetDisplay(targetTitle);
        } else {
            updateTargetDisplay();
        }
    });

    initClearBtn(pageKey);
}

export function updateTargetDisplay(targetTitle?: string) {
    const selectedTargetName = document.getElementById("selectedTargetName") as HTMLSpanElement | null;
    const clearTargetBtn = document.getElementById("clearTargetBtn") as HTMLButtonElement | null;
    const targetStatus = document.getElementById("targetStatus") as HTMLDivElement | null;
    const noTargetMessage = document.getElementById("noTargetMessage") as HTMLDivElement | null;

    if (!selectedTargetName || !clearTargetBtn || !targetStatus || !noTargetMessage) {
        console.error("One or more elements not found");
        return;
    }
    if (!selectedTargetName || !targetStatus || !noTargetMessage) {
        console.error("One or more essential elements for updating target display not found");
        return;
    }

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
    const clearTargetBtn = document.getElementById("clearTargetBtn") as HTMLButtonElement | null;

    if (!clearTargetBtn) {
        console.error("Clear target button not found");
        return;
    }

    clearTargetBtn.addEventListener("click", () => {
        chrome.storage.local.remove([`${pageKey}-target`, `${pageKey}-heatmap`], () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id!, {action: "remove"});
            });
            updateTargetDisplay();
        });
    });
}