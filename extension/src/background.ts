const baseApiUrl = "http://odin.st.lab.au.dk:8081/";
chrome.storage.session.setAccessLevel({
  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getHeatMap") {
    console.log("Received getHeatMap message:", message);
    const {srcRevId, srcTitle, targetTitle, lang} = message;

    const params = new URLSearchParams({
      src_rev_id: String(srcRevId),
      src_title: srcTitle,
      target_title: targetTitle,
      lang: lang,
    });

    const url = `${baseApiUrl}/heatmap?${params.toString()}`;

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Sentences received:", data);
        sendResponse(data);
      })
      .catch((error) => {
        console.error("Error fetching /heatmap:", error);
        sendResponse({ sentences: [] });
      });

    return true;
  }
});

// background.ts
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  if (message.action === "performFilteredSearchOnTargets") {
    const {sourceTitle, query, lang = "en"} = message;

    const url =
        `${baseApiUrl}/searchTargets?` +
        `source_title=${encodeURIComponent(sourceTitle)}` +
        `&q=${encodeURIComponent(query)}` +
        `&lang=${encodeURIComponent(lang)}`;

    fetch(url)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // data is now your FilteredArticle[] from the Ktor server
          sendResponse({success: true, results: data});
        })
        .catch((err) => {
          console.error("Error in searching for articles:", err);
          sendResponse({success: false, error: String(err)});
        });

    // Indicate that we'll respond asynchronously
    return true;
  }
});

chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  if (message.action === "openPopup") {
    chrome.action.openPopup();
    console.log("Popup opened");
    return;
  }
});
