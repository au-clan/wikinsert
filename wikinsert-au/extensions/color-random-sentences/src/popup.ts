document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleColor") as HTMLInputElement | null;
  let wikiLangCode = "en";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      const url = new URL(tabs[0].url);
      wikiLangCode = url.hostname.split(".")[0];
    }
  });


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


      toggle.addEventListener("change", () => {
        if (!activeTab.id) return;
        const action = toggle.checked ? "highlight" : "remove";
        chrome.tabs.sendMessage(activeTab.id, { action });
      });
    }
  });

  // 3) Handle the search form submission
  const searchForm = document.getElementById("searchForm") as HTMLFormElement | null;
  const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
  const searchDropdown = document.getElementById("searchDropdown") as HTMLDivElement;
  if (!searchForm || !searchInput || !searchDropdown) {
    console.error("Search form, input, or dropdown element not found");
    return;
  }

  function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return function (...args: any[]) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    } as T;
  }

  async function performSearch(query: string): Promise<void> {
    const searchForm = document.getElementById("searchForm") as HTMLFormElement | null;
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    const searchDropdown = document.getElementById("searchDropdown") as HTMLDivElement;
    if (!searchForm || !searchInput || !searchDropdown) {
      console.error("Search form, input, or dropdown element not found");
      return;
    }
    if (!query.trim()) {
      searchDropdown.innerHTML = "";
      searchDropdown.classList.add("hidden");
      return;
    }

    const endpoint = `https://${encodeURIComponent(wikiLangCode)}.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      const results = data.pages || [];

      searchDropdown.innerHTML = "";


      if (results.length === 0) {
        searchDropdown.innerHTML = `<div class="p-2 text-sm opacity-70">No results found.</div>`;
      } else {
        results.forEach((result: any) => {
          const title = result.title;
          const description = result.description || "";
          const articleUrl = `https://${encodeURIComponent(wikiLangCode)}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
          
          let imageUrl = "";
          if (result.thumbnail && result.thumbnail.url) {imageUrl = result.thumbnail.url.startsWith("http")? result.thumbnail.url: "https:" + result.thumbnail.url;}

          const resultItem = document.createElement("div");
          resultItem.className =
          "block p-2 border-b last:border-b-0 bg-primary text-primary-content hover:bg-neutral hover:text-neutral-content cursor-pointer flex justify-between items-center";

          const textPart = `
            <div class="flex items-center space-x-3">
              ${
                imageUrl
                  ? `<img src="${imageUrl}" alt="${title}" class="bg-white w-12 h-12 object-cover rounded" />`
                  : ""
              }
              <div>
                <div class="font-bold text-lg">${title}</div>
                <div class="text-sm">${description}</div>
              </div>
            </div>
          `;

          const buttonPart = `
            <button type="button" class="btn btn-xs ml-2 openTabBtn">Open</button>
          `;

          resultItem.innerHTML = textPart + buttonPart;
          resultItem.addEventListener("click", (e) => {
            if ((e.target as HTMLElement).classList.contains("openTabBtn")) {
              e.stopPropagation(); // Prevent also selecting the item
              window.open(articleUrl, "_blank");
            } else {
              searchInput.value = title;
              console.log("Selected item:", title);

              searchDropdown.classList.add("hidden");

              searchForm.requestSubmit();
            }
          });
          
          searchDropdown.appendChild(resultItem);
        });
        
      }
      searchDropdown.classList.remove("hidden");
    } catch (error) {
      console.error("Error fetching Wikipedia data:", error);
      searchDropdown.innerHTML = `<div class="p-2 text-sm text-red-500">Error fetching results.</div>`;
      searchDropdown.classList.remove("hidden");
    }
  }

  const debouncedSearch = debounce((event: Event) => {
    const query = (event.target as HTMLInputElement).value;
    performSearch(query);
  }, 300);
  searchInput.addEventListener("input", debouncedSearch);

  // Also perform search on pressing Enter (optional since live search is enabled)
  searchInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      performSearch(searchInput.value);
    }
  });

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(searchForm);
      const searchValue = formData.get("entity") as string;
      console.log("User search input:", searchValue);
      // Future logic to send the search value to your script can be added here
    });
  } else {
    console.error("Search form element not found");
  }
});