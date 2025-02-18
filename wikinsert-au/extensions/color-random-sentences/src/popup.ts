document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleColor") as HTMLInputElement | null;
  if (!toggle) {
    console.error("Toggle element not found");
    return;
  }

  // 1) Get the active tab's URL and read the stored highlight state
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.url) {
      const urlKey = activeTab.url;
      chrome.storage.local.get([urlKey], (result) => {
        toggle.checked = (result[urlKey] === true);
      });

      // 2) On toggle, send highlight/remove
      toggle.addEventListener("change", () => {
        if (!activeTab.id) return;
        const action = toggle.checked ? "highlight" : "remove";
        chrome.tabs.sendMessage(activeTab.id, { action });
      });
    }
  });
});