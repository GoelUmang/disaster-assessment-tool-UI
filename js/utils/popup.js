// popup.js
// handles management of popup elements in the application

/**
 * Show a popup
 * @param {string|HTMLElement} popup
 */
export function showPopup(popup) {
    const el = typeof popup === "string"
        ? document.getElementById(popup)
        : popup;

    if (!el) return;

    el.classList.remove("hidden");
}

/**
 * Hide a popup
 * @param {string|HTMLElement} popup
 */
export function hidePopup(popup) {
    const el = typeof popup === "string"
        ? document.getElementById(popup)
        : popup;

    if (!el) return;

    el.classList.add("hidden");
}

/**
 * Bind a close button to a popup
 * @param {string|HTMLElement} popup
 * @param {string|HTMLElement} closeBtn
 */
export function bindPopupClose(popup, closeBtn) {
    const popupEl = typeof popup === "string"
        ? document.getElementById(popup)
        : popup;

    const btnEl = typeof closeBtn === "string"
        ? document.getElementById(closeBtn)
        : closeBtn;

    if (!popupEl || !btnEl) return;

    btnEl.addEventListener("click", () => {
        popupEl.classList.add("hidden");
    });
    
    console.log(`[INFO] Bound close button for popup: ${popupEl.id}`);
}

