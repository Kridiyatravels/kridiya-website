/* Real control bindings for the owner's Transitions.dev patterns. */
"use strict";
(function () {
  const motion = window.KridiyaMotion;
  if (!motion) return;
  const swaps = new Map(), shakes = new WeakMap(), errorClears = new WeakMap(), pills = new WeakMap();
  let errorId = 0;
  const svgNS = "http://www.w3.org/2000/svg";
  function checkSVG() {
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 10.1668 10.1668");
    svg.setAttribute("fill", "none"); svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M1 5.52L3.92 9.17L9.17 1");
    path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path); return svg;
  }
  function measureCheck(host) {
    const path = host.querySelector("svg path");
    if (!path || !path.getTotalLength) return;
    host.style.setProperty("--check-len", String(Math.ceil(path.getTotalLength()) + 1));
  }
  function text(host, value) {
    value = String(value == null ? "" : value);
    const existing = swaps.get(host);
    if (existing) clearTimeout(existing.timer);
    swaps.delete(host);
    host.classList.add("t-text-swap");
    host.classList.remove("is-exit", "is-enter-start");
    const finish = function () {
      swaps.delete(host);
      host.textContent = value;
      host.classList.remove("is-exit");
      host.classList.add("is-enter-start");
      void host.offsetWidth;
      host.classList.remove("is-enter-start");
    };
    if (!host.textContent || host.textContent === value || motion.reduced()) { host.textContent = value; return; }
    host.classList.add("is-exit");
    swaps.set(host, { finish: finish, timer: setTimeout(finish, motion.duration("--text-swap-dur", host)) });
  }
  function label(host, value, loading) {
    value = String(value == null ? (host.dataset.motionIdleLabel || host.textContent.trim()) : value);
    if (!loading) host.dataset.motionIdleLabel = value;
    let span = host.querySelector(".motion-label");
    if (!span) {
      span = document.createElement("span"); span.className = "motion-label";
      span.textContent = host.textContent.trim(); host.replaceChildren(span);
    }
    host.setAttribute("aria-label", value);
    host.setAttribute("aria-busy", String(!!loading));
    span.classList.toggle("t-shimmer", !!loading);
    // Keep the shimmer's duplicate string synchronized through both text-swap phases.
    span.dataset.text = value;
    if (loading) { const pending = swaps.get(span); if (pending) clearTimeout(pending.timer); swaps.delete(span); span.classList.remove("is-exit", "is-enter-start"); span.textContent = value; }
    else text(span, value);
  }
  function error(input, field, message, value) {
    const choice = input.closest(".motion-choice");
    const target = choice ? choice.lastElementChild : input;
    field.classList.add("t-input-wrap"); target.classList.add("t-input"); message.classList.add("t-error-msg");
    if (!message.id) message.id = "motion-error-" + (++errorId);
    const ids = new Set((input.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    ids.add(message.id); input.setAttribute("aria-describedby", [...ids].join(" "));
    input.setAttribute("aria-invalid", value ? "true" : "false");
    field.classList.toggle("is-error", !!value); target.classList.toggle("is-error", !!value);
    clearTimeout(shakes.get(target)); target.classList.remove("is-shaking");
    clearTimeout(errorClears.get(message));
    if (value) message.textContent = value;
    else if (motion.reduced()) message.textContent = "";
    else errorClears.set(message, setTimeout(() => { message.textContent = ""; }, motion.duration("--revert-dur", target)));
    // Persistent validation messages: optional automatic error reversion is intentionally unused.
    if (value && !motion.reduced()) {
      void target.offsetWidth; target.classList.add("is-shaking");
      shakes.set(target, setTimeout(function () { target.classList.remove("is-shaking"); },
        motion.duration("--shake-dur-a", target) * 2 + motion.duration("--shake-dur-b", target) * 2));
    }
  }
  function tabs(bar, selected, animate) {
    let pill = pills.get(bar);
    if (!pill) {
      bar.classList.add("t-tabs"); pill = document.createElement("span"); pill.className = "t-tabs-pill";
      pill.setAttribute("aria-hidden", "true"); bar.prepend(pill); pills.set(bar, pill);
      bar.querySelectorAll('[role="tab"]').forEach(tab => tab.classList.add("t-tab"));
      const snap = () => tabs(bar, bar.querySelector('[aria-selected="true"]'), false);
      if (window.ResizeObserver) { const observer = new ResizeObserver(snap); observer.observe(bar); bar.querySelectorAll('[role="tab"]').forEach(tab => observer.observe(tab)); }
      else window.addEventListener("resize", snap);
      if (document.fonts) document.fonts.ready.then(snap);
      bar.addEventListener("keydown", function (event) {
        const items = [...bar.querySelectorAll('[role="tab"]')];
        const index = items.indexOf(event.target); if (index < 0) return;
        let next = index;
        if (event.key === "ArrowRight") next = (index + 1) % items.length;
        else if (event.key === "ArrowLeft") next = (index + items.length - 1) % items.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else return;
        event.preventDefault(); items[next].focus(); items[next].click();
      });
      animate = false;
    }
    if (!selected) return;
    bar.querySelectorAll('[role="tab"]').forEach(tab => { tab.tabIndex = tab === selected ? 0 : -1; });
    const previous = pill.style.transition;
    if (!animate || motion.reduced()) pill.style.transition = "none";
    pill.style.transform = "translateX(" + selected.offsetLeft + "px)";
    pill.style.width = selected.offsetWidth + "px";
    pill.style.top = selected.offsetTop + "px";
    pill.style.height = selected.offsetHeight + "px";
    if (!animate || motion.reduced()) { void pill.offsetWidth; pill.style.transition = previous; }
  }
  function syncChoices(scope, interacted) {
    (scope || document).querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      let host = input.closest(".motion-choice");
      if (!host) {
        host = document.createElement("span"); host.className = "motion-choice";
        input.before(host); host.appendChild(input); input.classList.add("motion-native");
        const visual = document.createElement("span"); visual.setAttribute("aria-hidden", "true");
        const toggle = !!input.closest("#notification-form");
        visual.className = toggle ? "t-toggle" : "t-check";
        if (toggle) {
          host.classList.add("motion-switch"); input.setAttribute("role", "switch");
          const thumb = document.createElement("span"); thumb.className = "t-toggle-thumb"; visual.appendChild(thumb);
        } else visual.appendChild(checkSVG());
        host.appendChild(visual); measureCheck(visual);
      }
      const visual = host.lastElementChild;
      if (visual.classList.contains("t-toggle")) {
        if (!interacted) visual.classList.remove("is-init");
        if (interacted === input) visual.classList.add("is-init");
        visual.dataset.on = String(input.checked);
        input.setAttribute("aria-checked", String(input.checked));
      } else visual.setAttribute("aria-checked", String(input.checked));
      host.classList.toggle("is-disabled", input.disabled);
    });
  }
  function success(host) {
    const wrapper = document.createElement("span"); wrapper.className = "t-success-check motion-success";
    wrapper.setAttribute("aria-hidden", "true"); wrapper.dataset.state = "out";
    wrapper.appendChild(checkSVG()); host.prepend(wrapper); measureCheck(wrapper);
    void wrapper.offsetWidth; wrapper.dataset.state = "in";
  }
  let activeDialog = false;
  function confirmAction(message, options) {
    options = options || {};
    if (activeDialog) return Promise.resolve(false);
    const dialog = document.createElement("dialog");
    if (!dialog.showModal) return Promise.resolve(options.input ? window.prompt(message) : window.confirm(message));
    activeDialog = true;
    const opener = options.opener || document.activeElement;
    dialog.className = "t-modal motion-confirm";
    const title = document.createElement("h2"); title.id = "motion-confirm-title"; title.textContent = message;
    dialog.setAttribute("aria-labelledby", title.id);
    const actions = document.createElement("div"); actions.className = "motion-confirm-actions";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "btn btn-outline"; cancel.textContent = options.input ? "Cancel" : "Keep";
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "btn btn-primary"; confirm.textContent = options.input ? "Send request" : "Confirm";
    const input = options.input ? document.createElement("textarea") : null;
    dialog.append(title);
    if (input) {
      input.className = "motion-dialog-input"; input.rows = 5; input.required = true; input.maxLength = 2000;
      input.setAttribute("aria-labelledby", title.id); dialog.append(input);
    }
    actions.append(cancel, confirm); dialog.append(actions); document.body.appendChild(dialog);
    dialog.showModal(); void dialog.offsetWidth; dialog.classList.add("is-open"); (input || cancel).focus();
    return new Promise(function (resolve) {
      let closing = false;
      function close(approved) {
        if (closing) return; closing = true;
        dialog.classList.remove("is-open"); dialog.classList.add("is-closing");
        cancel.disabled = confirm.disabled = true;
        setTimeout(function () {
          dialog.close(); dialog.remove(); activeDialog = false;
          if (opener && opener.isConnected) opener.focus(); resolve(approved);
        }, motion.duration("--modal-close-dur", dialog));
      }
      cancel.addEventListener("click", () => close(false)); confirm.addEventListener("click", () => {
        if (input && !input.value.trim()) { input.setCustomValidity("Describe the change you need."); input.reportValidity(); return; }
        close(input ? input.value.trim() : true);
      });
      if (input) input.addEventListener("input", () => input.setCustomValidity(""));
      dialog.addEventListener("cancel", event => { event.preventDefault(); close(false); });
    });
  }
  function learn(scope) {
    scope.querySelectorAll(".section-link, .service-slide-cta").forEach(function (host) {
      if (host.classList.contains("t-learn")) return;
      host.classList.add("t-learn");
      const old = host.querySelector("svg"); if (old) old.remove();
      const chevron = document.createElement("span"); chevron.className = "t-learn-chevron"; chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path class="t-learn-arm t-learn-arm-top" d="M6 4L10 8"/><path class="t-learn-arm t-learn-arm-bot" d="M10 8L6 12"/></svg>';
      host.appendChild(chevron);
    });
  }
  function like(button) {
    const on = button.dataset.liked !== "true"; button.dataset.liked = String(on); button.setAttribute("aria-pressed", String(on));
    button.classList.remove("is-bursting");
    if (!on || motion.reduced()) return;
    const style = getComputedStyle(button);
    const baseDistance = parseFloat(style.getPropertyValue("--like-particle-dist")) || 20;
    button.querySelectorAll(".t-like-particles i").forEach(function (dot, i) {
      const angle = i * Math.PI / 4, distance = baseDistance * (0.8 + Math.random() * 0.4);
      dot.style.setProperty("--px", Math.cos(angle) * distance + "px"); dot.style.setProperty("--py", Math.sin(angle) * distance + "px");
      dot.style.setProperty("--pdur", style.getPropertyValue("--like-particle-dur").trim()); dot.style.setProperty("--pdelay", "0ms");
    });
    void button.offsetWidth; button.classList.add("is-bursting");
    clearTimeout(button._burstTimer); button._burstTimer = setTimeout(() => button.classList.remove("is-bursting"), motion.duration("--like-particle-dur", button));
  }
  function skeleton(host) {
    host.classList.add("t-skel", "motion-skeleton", "is-resetting");
    host.classList.remove("is-revealed");
    host.dataset.state = "loading"; host.setAttribute("aria-busy", "true");
    const placeholder = document.createElement("div"); placeholder.className = "t-skel-skeleton";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.innerHTML = '<span class="motion-skeleton-bar"></span><span class="motion-skeleton-bar"></span><span class="motion-skeleton-bar"></span>';
    const content = document.createElement("div"); content.className = "t-skel-content"; content.inert = true; content.setAttribute("aria-hidden", "true");
    if (host.hasAttribute("data-trip-timeline-box")) {
      content.tabIndex = 0; content.setAttribute("role", "region"); content.setAttribute("aria-label", "Trip timeline");
    }
    host.replaceChildren(placeholder, content);
    void host.offsetWidth;
    host.classList.remove("is-resetting"); placeholder.classList.add("is-pulsing");
    return { content, reveal() {
      if (content.parentElement !== host) return;
      host.classList.add("is-revealed"); host.dataset.state = "ready"; host.setAttribute("aria-busy", "false");
      content.inert = false; content.removeAttribute("aria-hidden");
    } };
  }
  let accordionId = 0;
  function accordions(scope) {
    scope.querySelectorAll("details.quote-terms").forEach(function (details) {
      const summary = details.querySelector("summary"); if (!summary) return;
      const item = document.createElement("div"); item.className = details.className + " t-acc";
      const head = document.createElement("button"); head.type = "button"; head.className = "t-acc-head";
      head.textContent = summary.textContent;
      const chevron = document.createElement("span"); chevron.className = "t-acc-chevron"; chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML = '<svg viewBox="0 0 16 16"><path d="M4 6.5L8 10.5L12 6.5"/></svg>'; head.appendChild(chevron);
      const panel = document.createElement("div"); panel.className = "t-acc-panel"; panel.id = "motion-accordion-" + (++accordionId);
      const inner = document.createElement("div"); inner.className = "t-acc-panel-inner";
      [...details.childNodes].forEach(node => { if (node !== summary) inner.appendChild(node); });
      panel.appendChild(inner); item.append(head, panel); head.setAttribute("aria-controls", panel.id);
      function set(open) {
        item.dataset.open = String(open); head.setAttribute("aria-expanded", String(open));
        panel.inert = !open; panel.setAttribute("aria-hidden", String(!open));
      }
      set(details.open); head.addEventListener("click", () => set(item.dataset.open !== "true"));
      details.replaceWith(item);
    });
  }
  Object.assign(motion, { text, label, error, tabs, syncChoices, success, confirm: confirmAction, prompt: (message, opener) => confirmAction(message, { input: true, opener }), like, skeleton, accordions });
  document.addEventListener("change", function (event) { if (event.target.matches('input[type="checkbox"]')) syncChoices(document, event.target); });
  document.addEventListener("reset", function () { setTimeout(() => syncChoices(document), 0); });
  document.addEventListener("DOMContentLoaded", function () {
    syncChoices(document); learn(document); accordions(document);
    if (window.MutationObserver) new MutationObserver(function (records) {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1 && !node.closest(".motion-choice")) { syncChoices(node.parentElement || document); learn(node.parentElement || document); accordions(node.parentElement || document); }
      }));
    }).observe(document.body, { childList: true, subtree: true });
  });
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function (event) {
    if (!event.matches) return;
    [...swaps.values()].forEach(entry => { clearTimeout(entry.timer); entry.finish(); });
  });
})();
