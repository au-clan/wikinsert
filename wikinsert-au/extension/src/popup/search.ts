import {cdxIconLinkExternal} from "@wikimedia/codex-icons";
import {FilteredArticle} from "./popup";
import {createSvgIcon} from "../utils";
import {updateTargetDisplay} from "./target";
import { scopedKey } from "../utils";

export function initSearch(
    pageKey: string,
    wikiLangCode: string,
    srcTitle: string,
) {
  const searchForm = document.getElementById(
      "searchForm",
  ) as HTMLFormElement | null;
  const searchInput = document.getElementById(
      "searchInput",
  ) as HTMLInputElement | null;
  const searchDropdown = document.getElementById(
      "searchDropdown",
  ) as HTMLUListElement | null;
  const searchDropdownWrapper = document.getElementById(
      "searchDropdownWrapper",
  ) as HTMLElement | null;
  const searchButton = document.getElementById(
      "searchButton",
  ) as HTMLButtonElement | null;

  if (
      !searchForm ||
      !searchInput ||
      !searchDropdown ||
      !searchDropdownWrapper
  ) {
    console.error("Search form, input, dropdown, or wrapper element not found");
    return;
  }

  if (!searchButton) {
    console.error("Search button not found");
  } else {
    searchButton.addEventListener("click", () => {
      performSearch(searchInput.value, srcTitle, wikiLangCode);
    });
  }

  function debounce<T extends (...args: any[]) => void>(
      func: T,
      wait: number,
  ): T {
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
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const highlightedOption = document.querySelector(
          ".cdx-menu-item.highlighted",
      ) as HTMLElement;
      if (highlightedOption) {
        highlightedOption.click();
      } else {
        performSearch(searchInput.value, srcTitle, wikiLangCode);
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      navigateDropdown(e.key === "ArrowDown");
    }
  });

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const heatmapKey = scopedKey(pageKey, "heatmap");
      chrome.storage.session.get([heatmapKey], (result) => {
        const heatmap = result[heatmapKey] as any[];
        if (!heatmap || heatmap.length === 0) {
          return;
        }

        const formData = new FormData(searchForm);
        const searchValue = formData.get("entity") as string;

        const targetKey = scopedKey(pageKey, "target");
        chrome.storage.session.set({[targetKey]: searchValue}, () => {
          updateTargetDisplay(searchValue);
        });

        // send message to highlight the selected target
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          const activeTab = tabs[0];
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, {action: "highlight"});
          }
        });

        // clear the search input on
        searchInput.innerHTML = "";
        searchInput.value = "";
        searchDropdown.innerHTML = "";
        searchDropdownWrapper.classList.add("hidden");
      });
    });
  } else {
    console.error("Search form element not found");
  }
}

export async function performSearch(
    query: string,
    srcTitle: string,
    lang: string,
): Promise<void> {
  const searchForm = document.getElementById(
      "searchForm",
  ) as HTMLFormElement | null;
  const searchInput = document.getElementById(
      "searchInput",
  ) as HTMLInputElement | null;
  const searchDropdown = document.getElementById(
      "searchDropdown",
  ) as HTMLUListElement | null;
  const searchDropdownWrapper = document.getElementById(
      "searchDropdownWrapper",
  ) as HTMLElement | null;
  if (
      !searchForm ||
      !searchInput ||
      !searchDropdown ||
      !searchDropdownWrapper
  ) {
    console.error("Search form, input, dropdown, or wrapper element not found");
    return;
  }
  if (!query.trim()) {
    searchDropdown.innerHTML = "";
    searchDropdownWrapper.classList.add("hidden");
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
          console.error("Error fetching Wikipedia data:", response.error);
          searchDropdown.innerHTML = `<li class="cdx-menu-item"><span class="p-2 text-sm text-red-500">Error fetching results.</span></li>`;
          searchDropdownWrapper.classList.remove("hidden");
          return;
        }

        try {
          const articles = response.results as FilteredArticle[]; // This is our array of FilteredArticle
          renderArticles(articles, searchDropdown, searchInput, searchForm);
          searchDropdownWrapper.classList.remove("hidden");
        } catch (error) {
          console.error("Error fetching Wikipedia data:", error);
          searchDropdown.innerHTML = `<li class="cdx-menu-item"><span class="p-2 text-sm text-red-500">Error fetching results.</span></li>`;
          searchDropdownWrapper.classList.remove("hidden");
        }
      },
  );
}

export function navigateDropdown(moveDown: boolean) {
  const items = document.querySelectorAll(".cdx-menu-item");
  if (!items.length) return;
  // filter out the no-result item
  const filteredItems = Array.from(items).filter(
      (item) => item.id !== "no-result",
  );
  if (filteredItems.length === 0) return;

  let index = Array.from(items).findIndex((item) =>
      item.classList.contains("highlighted"),
  );

  if (index >= 0) items[index].classList.remove("highlighted");
  index = moveDown
      ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
  items[index].classList.add("highlighted");
  items[index].scrollIntoView({block: "nearest"});
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
    container.innerHTML = `<li id="no-result" class="cdx-menu-item"><span class="p-2 text-sm opacity-70">No results found.</span></li>`;
    return;
  }

  articles.forEach((article) => {
    const title = article.title;
    const description = article.description || "";
    const articleUrl = `https://${encodeURIComponent(article.lang)}.wikipedia.org/w/index.php?title=${encodeURIComponent(article.title)}`;
    let imageUrl = "";

    if (article.thumbnail?.source) {
      imageUrl = article.thumbnail.source.startsWith("http")
          ? article.thumbnail.source
          : "https:" + article.thumbnail.source;
    }

    // Build Codex‑styled <li>
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.className =
        "cdx-menu-item cdx-menu-item--enabled cdx-menu-item--has-description " +
        "cdx-menu-item--hide-description-overflow cursor-pointer flex items-center " +
        "justify-between border-b border-gray-200 last:border-b-0 px-2";

    const anchor = document.createElement("a");
    anchor.href = articleUrl;
    anchor.className = "cdx-menu-item__content flex-1 overflow-hidden";
    anchor.setAttribute("target", "_blank");
    // Thumbnail
    const thumb = document.createElement("span");
    thumb.className = "cdx-thumbnail cdx-menu-item__thumbnail";
    thumb.innerHTML = imageUrl
        ? `<span class="cdx-no-invert cdx-thumbnail__image" style="background-image:url('${imageUrl}');"></span>`
        : `<span class="cdx-thumbnail__placeholder"><span class="cdx-thumbnail__placeholder__icon"></span></span>`;

    // Text block
    const text = document.createElement("span");
    text.className = "cdx-menu-item__text truncate";
    text.innerHTML = `
            <span class="cdx-search-result-title"><bdi>${title}</bdi></span>
            <span class="cdx-menu-item__text__description"><bdi>${description}</bdi></span>
        `;

    anchor.appendChild(thumb);
    anchor.appendChild(text);
    li.appendChild(anchor);

    // Small icon to open quickly in a new tab
    const iconSpan = document.createElement("span");
    iconSpan.className =
        "w-4 h-4 cdx-icon ml-2 mr-1 shrink-0 opacity-70 hover:opacity-100";
    iconSpan.title = "Open in new tab (Ctrl/⌘‑click)";
    iconSpan.innerHTML = createSvgIcon(cdxIconLinkExternal.ltr.toString());
    iconSpan.addEventListener("click", (ev) => {
      ev.stopPropagation();
      window.open(articleUrl, "_blank");
    });
    li.appendChild(iconSpan);

    // Interaction
    li.addEventListener("click", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        e.stopPropagation(); // Prevent also selecting the item
        window.open(articleUrl, "_blank");
      } else {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          const activeTab = tabs[0]?.id;
          if (activeTab) {
            chrome.tabs.sendMessage(activeTab, {
              action: "setTarget",
              targetTitle: title,
              targetDescription: description,
              targetUrl: articleUrl,
            });
          }
        });
        searchInput.value = title;
        console.log("Selected item:", title);
        const wrapper = document.getElementById("searchDropdownWrapper");
        if (wrapper) wrapper.classList.add("hidden");
        searchForm.requestSubmit();
      }
    });

    container.appendChild(li);

    if (container.firstChild) {
      (container.firstChild as HTMLElement).classList.add("highlighted");
    }
  });
}
