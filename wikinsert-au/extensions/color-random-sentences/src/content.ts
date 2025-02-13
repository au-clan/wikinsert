// A WeakMap for storing each paragraph's original text
const originalTextMap = new WeakMap<HTMLElement, string>();

// Highlight all sentences inside paragraphs by wrapping them in spans with random colors
function highlightSentences(): void {
  let totalTimeForRegExp: number = 0;
  let totalTimeForSpan: number = 0;

  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }

  container.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
    // If we've never stored this paragraph's original text, do it now
    if (!originalTextMap.has(paragraph)) {
      originalTextMap.set(paragraph, paragraph.innerText);
    }

    // Extract all sentences
    const startRegExp = performance.now();
    const sentences = paragraph.innerText.match(/[^\.!\?]+[\.!\?]+/g);
    const endRegExp = performance.now();
    totalTimeForRegExp += endRegExp - startRegExp;

    if (sentences) {
      const startSpan = performance.now();
      paragraph.innerHTML = sentences
        .map(sentence => `<span style="background-color:${getRandomColor()}">${sentence}</span>`)
        .join(' ');
      const endSpan = performance.now();
      totalTimeForSpan += endSpan - startSpan;
    }
  });

  console.log('Total time for RegExp in milliseconds: ', totalTimeForRegExp);
  console.log('Total time for span in milliseconds: ', totalTimeForSpan);
}

// Remove highlighting by restoring the original text stored in the WeakMap
function removeHighlighting(): void {
  const container = document.getElementById("mw-content-text");
  if (!container) {
    console.error("Content container not found");
    return;
  }
  container.querySelectorAll<HTMLParagraphElement>('p').forEach((paragraph) => {
    const original = originalTextMap.get(paragraph);
    if (original) {
      // Restore paragraph’s original text
      paragraph.innerText = original;
      // If you'd like to re-highlight again without re-storing,
      // you might keep it in the WeakMap. But if you want to free memory,
      // you can remove it:
      // originalTextMap.delete(paragraph);
    }
  });
}



// Generates a random color (here using HSL)
function getRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 31) + 70; // between 70% and 100%
  const lightness = 85; // high lightness for a light background
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Listen for messages from extension popup
chrome.runtime.onMessage.addListener(
  (message: { action: string }, sender, sendResponse): void => {
    if (message.action === 'highlight') {
      console.log('Highlighting sentences time start');
      const start = performance.now();
      highlightSentences();
      const end = performance.now();
      console.log('Highlighting sentences time end in milliseconds: ', end - start);
    } else if (message.action === 'remove') {
      removeHighlighting();
    }
  }
);