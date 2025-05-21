import {createSvgIcon} from "../utils";
import {cdxIconCancel, cdxIconSubtract,} from "@wikimedia/codex-icons";

export function initMenu() {
    //const settingsBtn = document.getElementById("settings");
    const closeBtn = document.getElementById("minimize");
    if (!closeBtn) {
        console.error("Settings or close button not found");
        return;
    }
    //settingsBtn.innerHTML = createSvgIcon(cdxIconConfigure);
    closeBtn.innerHTML = createSvgIcon(cdxIconSubtract);

    closeBtn?.addEventListener("click", () => {
        window.close();
    });

    const cancelBtn = document.getElementById("cancel");
    if (cancelBtn) {
        cancelBtn.innerHTML = createSvgIcon(cdxIconCancel);
    }
}
