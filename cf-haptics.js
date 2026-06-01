(function () {
  if (window.__cfCustomerHaptics) return;
  window.__cfCustomerHaptics = true;

  const ACTION_SELECTOR = [
    "button",
    "a[href]",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']",
    "input[type='reset']",
    "[data-haptic]",
    "[data-view]",
    "[data-action]",
    "[data-open]",
    "[data-close]",
    "[data-filter]",
    "[data-date-key]",
    "[data-select]",
    "[data-edit]",
    "[data-remove]",
    "[data-add]",
    "[data-minus]",
    "[data-plus]",
    ".add-btn",
    ".qty-btn",
    ".chip",
    ".tab",
    ".saved-address-card",
    ".location-row",
    ".profile-button",
    ".cart-card",
    ".track-card",
    ".bottom-nav-item",
    ".back-button",
    ".close-button"
  ].join(",");

  const SKIP_SELECTOR = [
    "[disabled]",
    "[aria-disabled='true']",
    "[data-no-haptic]",
    "input[type='text']",
    "input[type='tel']",
    "input[type='number']",
    "input[type='email']",
    "input[type='password']",
    "input[type='search']",
    "textarea",
    "select",
    "[contenteditable='true']"
  ].join(",");

  let lastPulseAt = 0;

  function isUsableAction(element) {
    if (!element) return false;
    if (element.closest(SKIP_SELECTOR)) return false;
    return true;
  }

  function pulse() {
    const now = Date.now();
    if (now - lastPulseAt < 80) return;
    lastPulseAt = now;

    try {
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (_) {}
  }

  function pressFeedback(element) {
    if (!element || element.dataset.noPressFeedback === "1") return;
    element.classList.add("cf-haptic-press");
    window.setTimeout(function () {
      element.classList.remove("cf-haptic-press");
    }, 130);
  }

  function handlePointer(event) {
    if (event.pointerType === "mouse") return;
    const action = event.target.closest(ACTION_SELECTOR);
    if (!isUsableAction(action)) return;
    pulse();
    pressFeedback(action);
  }

  function handleClick(event) {
    const action = event.target.closest(ACTION_SELECTOR);
    if (!isUsableAction(action)) return;
    if ("PointerEvent" in window) return;
    pulse();
    pressFeedback(action);
  }

  function injectStyle() {
    if (document.getElementById("cf-haptic-style")) return;
    const style = document.createElement("style");
    style.id = "cf-haptic-style";
    style.textContent = ".cf-haptic-press{transform:scale(.985);transition:transform 120ms ease,opacity 120ms ease;opacity:.92}.cf-haptic-press *{pointer-events:none}";
    document.head.appendChild(style);
  }

  injectStyle();

  document.addEventListener("pointerdown", handlePointer, { passive: true, capture: true });
  document.addEventListener("click", handleClick, { passive: true, capture: true });
})();
