/* Shared Transitions.dev orchestration; presentation only. */
"use strict";
(function () {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const closing = new Map();
  const animations = new WeakMap();
  const activeAnimations = new Set();
  function duration(token, element) {
    if (preference.matches) return 0;
    const value = getComputedStyle(element || document.documentElement).getPropertyValue(token).trim();
    const n = parseFloat(value);
    return Number.isFinite(n) ? n * (value.endsWith("ms") ? 1 : 1000) : 0;
  }
  function dropdown(element, open, origin) {
    if (!open && (element.hidden || element.classList.contains("is-closing"))) return;
    clearTimeout(closing.get(element));
    closing.delete(element);
    element.classList.add("t-dropdown");
    element.dataset.origin = origin || "top-left";
    if (open) {
      const wasHidden = element.hidden;
      element.hidden = false;
      element.inert = false;
      element.classList.remove("is-closing");
      if (wasHidden) void element.offsetWidth;
      element.classList.add("is-open");
    } else {
      element.inert = true;
      element.classList.remove("is-open");
      element.classList.add("is-closing");
      const finish = function () {
        element.hidden = true;
        element.classList.remove("is-closing");
        closing.delete(element);
      };
      const ms = duration("--dropdown-close-dur", element);
      if (!ms) finish();
      else closing.set(element, setTimeout(finish, ms));
    }
  }
  function enterPanel(element) {
    const previous = animations.get(element);
    if (previous) previous.cancel();
    if (preference.matches || !element.animate) return;
    const style = getComputedStyle(element);
    const animation = element.animate([
      { opacity: 0, transform: "translateY(" + style.getPropertyValue("--page-slide-distance").trim() + ")" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: duration("--page-slide-dur", element), easing: style.getPropertyValue("--page-slide-ease").trim() });
    animations.set(element, animation);
    activeAnimations.add(animation);
    animation.onfinish = animation.oncancel = function () { activeAnimations.delete(animation); };
  }
  function ease(progress) {
    // Evaluate the shared cubic-bezier for the scrollLeft carousel adapter.
    const curve = getComputedStyle(document.documentElement).getPropertyValue("--page-slide-ease");
    const values = curve.match(/cubic-bezier\(([^)]+)\)/);
    if (!values) return progress;
    const [x1, y1, x2, y2] = values[1].split(",").map(Number);
    const point = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (point(mid, x1, x2) < progress) lo = mid; else hi = mid;
    }
    return point((lo + hi) / 2, y1, y2);
  }
  function reveal() {
    const elements = document.querySelectorAll(".reveal");
    const show = function (element) { element.dataset.open = "true"; element.classList.add("in", "is-shown"); };
    if (preference.matches || !("IntersectionObserver" in window)) {
      elements.forEach(show);
      return;
    }
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { show(entry.target); observer.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    const moments = [...elements].filter(element => element.classList.contains("section-head")).slice(0, 2);
    elements.forEach(function (element) {
      if (!moments.includes(element)) { show(element); return; }
      const lines = [...element.children].filter(child => /^(H[1-6]|P)$/.test(child.tagName));
      if (element.classList.contains("section-head") && lines.length) {
        element.classList.add("t-stagger");
        lines.forEach(function (line, i) {
          line.classList.add("t-stagger-line");
          line.style.transitionDelay = "calc(var(--stagger-stagger) * " + i + ")";
        });
      } else element.classList.add("t-panel-slide");
      element.dataset.open = element.classList.contains("in") ? "true" : "false";
      observer.observe(element);
      element.addEventListener("transitionend", function () {
        if (element.classList.contains("in")) {
          element.style.willChange = "auto";
          element.querySelectorAll(".t-stagger-line").forEach(line => { line.style.willChange = "auto"; });
        }
      });
      element.addEventListener("focusin", function () { show(element); observer.unobserve(element); });
    });
    preference.addEventListener("change", function () {
      if (preference.matches) { elements.forEach(show); observer.disconnect(); }
    });
  }
  preference.addEventListener("change", function () {
    if (!preference.matches) return;
    activeAnimations.forEach(function (animation) { animation.cancel(); });
    closing.forEach(function (timer, element) {
      clearTimeout(timer); element.hidden = true; element.classList.remove("is-closing");
    });
    closing.clear();
  });
  window.KridiyaMotion = { dropdown: dropdown, duration: duration, enterPanel: enterPanel, ease: ease, reveal: reveal, reduced: function () { return preference.matches; } };
})();
