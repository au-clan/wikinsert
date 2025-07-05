import { scopedKey } from "../utils";
export function initToggleInput(pageKey: string) {
    const toggleInput = document.getElementById(
        "toggleInput",
    ) as HTMLInputElement | null;

    if (!toggleInput) {
        console.error("Toggle input not found");
        return;
    }

    // first state
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
            const highlightedKey = scopedKey(pageKey, "highlighted");
            chrome.storage.session.get([highlightedKey], (result) => {
                toggleInput.checked = result[highlightedKey] === true;
            });

            toggleInput.addEventListener("change", () => {
                if (!activeTab.id) return;
                const action = toggleInput.checked ? "highlight" : "remove";
                chrome.tabs.sendMessage(activeTab.id, {action});
            });
        }
    });

    // listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "session") {
            const highlightedKey = scopedKey(pageKey, "highlighted");
            if (changes[highlightedKey]) {
                toggleInput.checked = changes[highlightedKey].newValue === true;
            }
        }
    });
}
