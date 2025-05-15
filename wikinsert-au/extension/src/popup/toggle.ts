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
            chrome.storage.local.get([`${pageKey}-highlighted`], (result) => {
                toggleInput.checked = result[`${pageKey}-highlighted`] === true;
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
        if (namespace === "local" && changes[`${pageKey}-highlighted`]) {
            toggleInput.checked = changes[`${pageKey}-highlighted`].newValue === true;
        }
    });
}
