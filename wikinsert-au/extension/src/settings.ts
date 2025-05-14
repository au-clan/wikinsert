import {createSvgIcon} from "./utils";
import {cdxIconArrowPrevious} from "@wikimedia/codex-icons";

document.addEventListener("DOMContentLoaded", () => {
    const densitySlider = document.getElementById("densitySlider") as HTMLInputElement
    const currentValueSpan = document.getElementById("densityValue") as HTMLSpanElement
    const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement
    const previousBtn = document.getElementById("previousBtn");
    if (!previousBtn) {
        console.error("Settings or close button not found");
        return;
    }
    previousBtn.innerHTML = createSvgIcon(cdxIconArrowPrevious.ltr.toString())

    // first state
    chrome.storage.local.get('density', (result) => {
        let densityValue = result.density
        if (!densityValue) {
            console.log(result)
            densityValue = 50
            chrome.storage.local.set({density: densityValue})
        }
        currentValueSpan.textContent = `Highlighting top ${densityValue}%`
        densitySlider.value = densityValue
    });


    // listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.density) {
            const densityValue = changes.density.newValue;
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                const activeTab = tabs[0];
                if (activeTab?.id) {
                    chrome.tabs.sendMessage(activeTab.id, {action: "highlight", density: densityValue});
                }
            });
        }
    });

    densitySlider.addEventListener("input", () => {
        currentValueSpan.textContent =
            `Highlighting top ${densitySlider.value}%`
    })

    saveBtn.addEventListener("click", () => {
        chrome.storage.local.set({density: densitySlider.value})
    })

})