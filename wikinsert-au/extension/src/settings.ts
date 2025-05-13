import { createSvgIcon } from "./utils";
import { cdxIconArrowPrevious } from "@wikimedia/codex-icons";

const densitySlider = document.getElementById("densitySlider") as HTMLInputElement
const currentValueSpan = document.getElementById("densityValue") as HTMLSpanElement
const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement

document.addEventListener("DOMContentLoaded", () => {
    const previousBtn = document.getElementById("previousBtn");
    if (!previousBtn) {
        console.error("Settings or close button not found");
        return;
    }
    previousBtn.innerHTML = createSvgIcon(cdxIconArrowPrevious.ltr.toString())

    chrome.storage.local.get('density', (result) =>
        {
            let densityValue = result.density
            if (!densityValue) {
            console.log(result)
            densityValue = 50
            chrome.storage.local.set({density: densityValue})
        }
        currentValueSpan.textContent = `Highlighting top ${densityValue}%` 
        densitySlider.value = densityValue})
})

densitySlider.addEventListener("input", () => {
    currentValueSpan.textContent =
    `Highlighting top ${densitySlider.value}%`
})

saveBtn.addEventListener("click", () => {
    chrome.storage.local.set({density: densitySlider.value})
})

