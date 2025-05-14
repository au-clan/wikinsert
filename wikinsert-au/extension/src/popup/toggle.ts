export function initToggleInput(pageKey: string) {
    const toggleInput = document.getElementById("toggleInput") as HTMLInputElement | null;

    if (!toggleInput) {
        console.error("Toggle input not found");
        return;
    }

    // first state
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
            chrome.storage.local.get([pageKey], (result) => {
                toggleInput.checked = result[pageKey] === true;
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
        if (namespace === 'local' && changes[pageKey]) {
            toggleInput.checked = changes[pageKey].newValue === true;
        }
    });
}