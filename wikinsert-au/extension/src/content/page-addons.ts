import {openPopup} from "../utils";

export function addWikinsertButtonToNavBar() {
    const vectorMenuContentList = document.querySelector(
        "#p-views .vector-menu-content-list",
    );
    if (!vectorMenuContentList) {
        console.log("No vector menu to add wikinsert button to");
        return;
    }

    const wikinsertVectorMenuItem = document.createElement("li");
    wikinsertVectorMenuItem.id = "ca-wikinsert";
    wikinsertVectorMenuItem.className = "vector-tab-noicon mw-list-item";

    const wikinsertLink = document.createElement("a");
    wikinsertLink.href = "#";

    const wikinsertSpan = document.createElement("span");
    wikinsertSpan.textContent = "Wikinsert";
    wikinsertLink!.onclick = (e) => {
        e.preventDefault();
        openPopup();
    };
    wikinsertLink.appendChild(wikinsertSpan);
    wikinsertVectorMenuItem.appendChild(wikinsertLink);

    vectorMenuContentList.prepend(wikinsertVectorMenuItem);
}
