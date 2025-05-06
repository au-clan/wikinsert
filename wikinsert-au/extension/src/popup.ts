document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleColor") as HTMLInputElement | null;
    let wikiLangCode = "";
    let srcTitle = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
              tabs[0].id,
              {action: "getPageInfo"},
              (response) => {
                  const {title, lang} = response;
                  console.log("Received page info:", response);
                  wikiLangCode = lang;
                  srcTitle = title;
              }
          );
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

    const debouncedSearch = debounce((event: Event) => {
        const query = (event.target as HTMLInputElement).value;
        performSearch(query, srcTitle, wikiLangCode);
    }, 300);
    searchInput.addEventListener("input", debouncedSearch);

    // Also perform search on pressing Enter (optional since live search is enabled)
    searchInput.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            performSearch(searchInput.value, srcTitle, wikiLangCode);
        }
    });

    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(searchForm);
            const searchValue = formData.get("entity") as string;
            const toggle = document.getElementById("highlightToggle")
            toggle?.classList.remove("hidden")
            console.log("User search input:", searchValue);
            // Future logic to send the search value to your script can be added here
        });
    } else {
        console.error("Search form element not found");
    }
});

export interface Thumbnail {
    source: string;
    width: number;
    height: number;
}
export interface FilteredArticle {
    title: string;
    lang: string;
    description?: string;
    thumbnail?: Thumbnail;
    revid?: string;
}

async function performSearch(query: string, srcTitle: string, lang: string): Promise<void> {
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

    chrome.runtime.sendMessage(
        {
            action: "performFilteredSearchOnTargets",
            sourceTitle: srcTitle, // the page we are on
            query: query,
            lang: lang,
        },
        (response) => {
            if (!response?.success) {
                // Handle error
                return;
            }

            try {
                const articles = response.results as FilteredArticle[]; // This is our array of FilteredArticle
                renderArticles(articles, searchDropdown, searchInput, searchForm);
                searchDropdown.classList.remove("hidden");
            } catch (error) {
                console.error("Error fetching Wikipedia data:", error);
                searchDropdown.innerHTML = `<div class="p-2 text-sm text-red-500">Error fetching results.</div>`;
                searchDropdown.classList.remove("hidden");
            }
        }
    );
}

/**
 * Renders a list of articles in the dropdown container
 * @param articles The array of articles to render
 * @param container The DOM element to render the articles into
 * @param searchInput The search input element for updating selected values
 * @param searchForm The search form for submitting when an article is selected
 */
function renderArticles(
    articles: FilteredArticle[],
    container: HTMLElement,
    searchInput: HTMLInputElement,
    searchForm: HTMLFormElement,
): void {
    container.innerHTML = "";

    if (articles.length === 0) {
        container.innerHTML = `<div class="p-2 text-sm opacity-70">No results found.</div>`;
        return;
    }

    articles.forEach((article) => {
        const title = article.title;
        const description = article.description || "";
        // the article URL might be changed to local file or with revision id
        const articleUrl = `https://${encodeURIComponent(article.lang)}.wikipedia.org/w/index.php?title=${encodeURIComponent(article.title)}}`;

        let imageUrl = "";
        if (article.thumbnail) {
            imageUrl = article.thumbnail.source.startsWith("http")
                ? article.thumbnail.source
                : "https:" + article.thumbnail.source;
        }

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
                container.classList.add("hidden");
                searchForm.requestSubmit();
            }
        });

        container.appendChild(resultItem);
    });
}