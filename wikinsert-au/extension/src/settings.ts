// import {createSvgIcon} from "./utils";
// import {cdxIconArrowPrevious} from "@wikimedia/codex-icons";

// document.addEventListener("DOMContentLoaded", () => {
//     const intensitySlider = document.getElementById(
//         "intensitySlider",
//     ) as HTMLInputElement;
//     const currentValueSpan = document.getElementById(
//         "intensityValue",
//     ) as HTMLSpanElement;
//     const saveBtn = document.getElementById("saveBtn") as HTMLButtonElement;
//     const previousBtn = document.getElementById("previousBtn");
//     if (!previousBtn) {
//         console.error("Settings or close button not found");
//         return;
//     }
//     previousBtn.innerHTML = createSvgIcon(cdxIconArrowPrevious.ltr.toString());

//     // first state
//     chrome.storage.session.get("intensity", (result) => {
//         let intensityValue = result.intensity;
//         if (!intensityValue) {
//             console.log(result);
//             intensityValue = 0.5;
//             chrome.storage.session.set({intensity: intensityValue});
//         }
//         currentValueSpan.textContent = `Highlighting sentences ≥ ${intensityValue}`;
//         intensitySlider.value = intensityValue;
//     });

//     // listen for changes
//     chrome.storage.onChanged.addListener((changes, namespace) => {
//         if (namespace === "session" && changes.intensity) {
//             const intensityValue = changes.intensity.newValue;
//             chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
//                 const activeTab = tabs[0];
//                 if (activeTab?.id) {
//                     chrome.tabs.sendMessage(activeTab.id, {
//                         action: "highlight",
//                         intensity: intensityValue,
//                     });
//                 }
//             });
//         }
//     });

//     intensitySlider.addEventListener("input", () => {
//         currentValueSpan.textContent = `Highlighting sentences ≥ ${intensitySlider.value}`;
//     });

//     saveBtn.addEventListener("click", () => {
//         chrome.storage.session.set({intensity: parseFloat(intensitySlider.value)});
//     });
// });
