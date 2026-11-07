(function () {
  "use strict";
  function labels() {
    return document.documentElement.lang === "ar"
      ? { copy: "نسخ المرجع", copied: "تم النسخ", fallback: "تعذّر النسخ التلقائي. حدّد المرجع وانسخه يدويًا.", reference: "المرجع" }
      : { copy: "Copy reference", copied: "Copied", fallback: "Could not copy automatically. Select the reference and copy it manually.", reference: "Reference" };
  }

  function create(reference) {
    const value = String(reference || "");
    const group = document.createElement("span");
    group.className = "reference-copy";
    group.setAttribute("data-no-localize", "");
    const text = document.createElement("span");
    text.className = "reference-copy-value";
    text.dir = "ltr";
    text.textContent = value;
    group.appendChild(text);
    if (!value.trim()) return group;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reference-copy-button";
    button.setAttribute("data-reference-copy", value);
    button.setAttribute("aria-label", labels().copy + " " + value);
    button.title = labels().copy + " " + value;
    button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
    const status = document.createElement("span");
    status.className = "reference-copy-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    group.append(button, status);
    return group;
  }

  document.addEventListener("click", async function (event) {
    const button = event.target.closest("[data-reference-copy]");
    if (!button || button.dataset.copyBusy === "true") return;
    const group = button.closest(".reference-copy");
    const status = group.querySelector(".reference-copy-status");
    const copy = labels();
    clearTimeout(button.copyFeedbackTimer);
    status.textContent = "";
    group.querySelector(".reference-copy-fallback")?.remove();
    button.dataset.copyBusy = "true";
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(button.dataset.referenceCopy);
      status.textContent = copy.copied;
      button.copyFeedbackTimer = setTimeout(function () { status.textContent = ""; }, 2200);
    } catch (_) {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "reference-copy-fallback";
      input.readOnly = true;
      input.dir = "ltr";
      input.value = button.dataset.referenceCopy;
      input.setAttribute("aria-label", copy.reference + " " + button.dataset.referenceCopy);
      input.addEventListener("focus", function () { input.select(); });
      group.appendChild(input);
      status.textContent = copy.fallback;
      input.focus({ preventScroll: true });
      input.select();
    } finally {
      delete button.dataset.copyBusy;
    }
  });

  window.KridiyaReferenceCopy = Object.freeze({
    html: function (reference) { return create(reference).outerHTML; },
    mount: function (element, reference) { if (element) element.replaceChildren(create(reference)); }
  });
})();
