const baseApiUrl = "http://localhost:8080";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getHeatMap") {
    console.log("Received getHeatMap message:", message);
    const { srcRevId, srcTitle, targetRevId, targetTitle, lang } = message;

    const params = new URLSearchParams({
      src_rev_id: String(srcRevId),
      src_title: srcTitle,
      target_rev_id: String(targetRevId),
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