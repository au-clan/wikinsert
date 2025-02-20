chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getScore") {
        // Asynchronous call to your Ktor server:
        fetch("http://localhost:8080/heatmap")
            .then((res) => res.text())
            .then((scoreAsString) => {
                const score = parseFloat(scoreAsString);
                sendResponse({score});
            })
            .catch((error) => {
                console.error("Error fetching /heatmap:", error);
                sendResponse({score: 0.75}); // fallback score
            });
        // Return true to keep the message channel open for sendResponse
        return true;
    }
});