import {cdxIconCancel, cdxIconConfigure, cdxIconLinkExternal, cdxIconSubtract} from '@wikimedia/codex-icons';
import {createSvgIcon} from './utils';


document.addEventListener("DOMContentLoaded", () => {
    const toggleContainer = document.getElementById("toggleContainer");
    const toggleInput = document.getElementById("toggleInput") as HTMLInputElement | null;
    const selectedTargetName = document.getElementById("selectedTargetName") as HTMLSpanElement | null;
    const clearTargetBtn = document.getElementById("clearTargetBtn") as HTMLButtonElement | null;
    const targetStatus = document.getElementById("targetStatus") as HTMLDivElement | null;
    const noTargetMessage = document.getElementById("noTargetMessage") as HTMLDivElement | null;

    let wikiLangCode = "";
    let srcTitle = "";
    let pageKey = "";

    if (!selectedTargetName || !clearTargetBtn || !targetStatus || !noTargetMessage || !toggleContainer || !toggleInput) {
        console.error("One or more elements not found");
        return;
    }

    function showSelectedTarget(targetTitle: string) {
        if (!selectedTargetName || !clearTargetBtn || !targetStatus || !noTargetMessage || !toggleContainer) {
            console.error("One or more elements not found");
            return;
        }
        selectedTargetName.textContent = `Inserting "${targetTitle}"`;
        targetStatus.classList.remove("hidden");
        noTargetMessage.classList.add("hidden");
    }

    function showNoSelectedTarget() {
        if (!selectedTargetName || !clearTargetBtn || !targetStatus || !noTargetMessage || !toggleContainer) {
            console.error("One or more elements not found");
            return;
        }
        selectedTargetName.textContent = "";
        targetStatus.classList.add("hidden");
        noTargetMessage.classList.remove("hidden");
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
            pageKey = activeTab.url.split("#")[0]
            chrome.tabs.sendMessage(
                activeTab.id!,
                { action: "getPageInfo" },
                (response) => {
                    wikiLangCode = response.lang;
                    srcTitle = response.title;

                    console.log("Received page info:", response);

                    // Check if a target is selected
                    chrome.storage.local.get([`${pageKey}-target`], (result) => {
                        const targetTitle = result[`${pageKey}-target`];
                        if (targetTitle) {
                            showSelectedTarget(targetTitle);
                        } else {
                            showNoSelectedTarget();
                        }
                    });

                }
            );
        }
    });


    // Listen for changes to the toggle state
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[pageKey]) {
            toggleInput.checked = changes[pageKey].newValue === true;
        }
    });
    // Handle the clear target button click
    clearTargetBtn.addEventListener("click", () => {
        chrome.storage.local.remove([`${pageKey}-target`, `${pageKey}-heatmap`], () => {
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id!, {action: "remove"});
            });
            showNoSelectedTarget();
        });
    });

    if (!toggleInput) {
        console.error("Toggle input not found");
        return;
    }

    // 1) Get the active tab's URL and read the stored highlight state
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
            // Initially set the toggle state
            chrome.storage.local.get([pageKey], (result) => {
                toggleInput.checked = result[pageKey] === true;
            });

            toggleInput.addEventListener("change", () => {
                if (!activeTab.id) return;
                const action = toggleInput.checked ? "highlight" : "remove";
                chrome.tabs.sendMessage(activeTab.id, { action });
            });
        }
    });

    /* ----- menu buttons ----- */
    const settingsBtn = document.getElementById("settings");
    const closeBtn = document.getElementById("minimize");
    if (!settingsBtn || !closeBtn) {
        console.error("Settings or close button not found");
        return;
    }
    settingsBtn.innerHTML = createSvgIcon(cdxIconConfigure);
    closeBtn.innerHTML = createSvgIcon(cdxIconSubtract);

    closeBtn?.addEventListener("click", () => {
        window.close();                       // closes the popup
    });

    const cancelBtn = document.getElementById("cancel");
    if (cancelBtn) {
        cancelBtn.innerHTML = createSvgIcon(cdxIconCancel);
    }

    // 3) Handle the search form submission
    const searchForm = document.getElementById("searchForm") as HTMLFormElement | null;
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    const searchDropdown = document.getElementById("searchDropdown") as HTMLUListElement | null;
    const searchDropdownWrapper = document.getElementById("searchDropdownWrapper") as HTMLElement | null;

    if (!searchForm || !searchInput || !searchDropdown || !searchDropdownWrapper) {
        console.error("Search form, input, dropdown, or wrapper element not found");
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
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            performSearch(searchInput.value, srcTitle, wikiLangCode);
        }
    });

    if (searchForm) {
        searchForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(searchForm);
            const searchValue = formData.get("entity") as string;
            const targetTitle = (document.getElementById("searchInput") as HTMLInputElement).value;

            chrome.storage.local.set({[`${pageKey}-target`]: targetTitle}, () => {
                showSelectedTarget(targetTitle);
            });

            // send message to highlight the selected target
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab?.id) {
                    chrome.tabs.sendMessage(activeTab.id, {action: "highlight"});
                }
            });


            // clear the search input on 
            searchInput.value = "";
            searchDropdown.innerHTML = "";
            searchDropdownWrapper.classList.add("hidden");
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
    const searchDropdown = document.getElementById("searchDropdown") as HTMLUListElement;
    const searchDropdownWrapper = document.getElementById("searchDropdownWrapper") as HTMLElement;
    if (!searchDropdownWrapper) {
        console.error("Wrapper element not found");
        return;
    }
    if (!searchForm || !searchInput || !searchDropdown || !searchDropdownWrapper) {
        console.error("Search form, input, dropdown, or wrapper element not found");
    }
    if (!searchForm || !searchInput || !searchDropdown) {
        console.error("Search form, input, or dropdown element not found");
        return;
    }
    if (!query.trim()) {
        searchDropdown.innerHTML = "";
        searchDropdownWrapper.classList.add("hidden");
        return;
    }
    console.log("Performing search with query:", query);
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
                searchDropdownWrapper.classList.remove("hidden");
            } catch (error) {
                console.error("Error fetching Wikipedia data:", error);
                searchDropdown.innerHTML = `<li class="cdx-menu-item"><span class="p-2 text-sm text-red-500">Error fetching results.</span></li>`;
                searchDropdownWrapper.classList.remove("hidden");
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
        container.innerHTML =
            `<li class="cdx-menu-item"><span class="p-2 text-sm opacity-70">No results found.</span></li>`;
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
        iconSpan.className = 'w-4 h-4 cdx-icon ml-2 mr-1 shrink-0 opacity-70 hover:opacity-100';
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
            const me = e as MouseEvent;
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation(); // Prevent also selecting the item
                window.open(articleUrl, "_blank");
            } else {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const activeTab = tabs[0]?.id;
                    if (activeTab) {
                        chrome.tabs.sendMessage(activeTab, {
                            action: "setTarget",
                            targetTitle: title,
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
    });
}

