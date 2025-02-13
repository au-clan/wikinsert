document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleColor") as HTMLInputElement | null;

  if (!toggle) {
    console.error("Toggle element not found");
    return;
  }

  toggle.addEventListener("change", (event: Event) => {
    const target = event.target as HTMLInputElement;
    const action: "highlight" | "remove" = target.checked ? "highlight" : "remove";
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id !== undefined) {
        chrome.tabs.sendMessage(activeTab.id, { action });
      }
    });
  });
});
