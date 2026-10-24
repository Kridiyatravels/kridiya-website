/* Keep the static page hidden until shared chrome, the booking widget and the
   selected language are ready. This prevents incomplete English markup from
   flashing during an Arabic reload. A timeout keeps the page usable if a
   later script fails unexpectedly. */
(function () {
  "use strict";

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var host = location.hostname.toLowerCase();
  var firstPathSegment = location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  var previewRegion = params.get("region");
  var region = ["ae", "in", "en"].includes(previewRegion) ? previewRegion
    : host.endsWith(".in") || firstPathSegment === "in" ? "in"
    : firstPathSegment === "en" || host.startsWith("global.") ? "en"
    : "ae";
  var page = location.pathname.split("/").pop() || "index.html";
  var bilingualLegalPage = page === "privacy.html" || page === "terms.html";
  var stored = "";
  try { stored = localStorage.getItem("kridiya_language_ae") || ""; } catch (error) { /* Storage can be unavailable. */ }
  var requested = params.get("lang");
  var browserPrefersArabic = (navigator.languages || [navigator.language || "en"])
    .some(function (value) { return /^ar(?:-|$)/i.test(value); });
  var language = region === "ae" && !bilingualLegalPage
    ? (["en", "ar"].includes(requested) ? requested : ["en", "ar"].includes(stored) ? stored : browserPrefersArabic ? "ar" : "en")
    : "en";

  root.classList.add("js", "kridiya-booting");
  root.dataset.siteRegion = region;
  root.dataset.siteLanguage = language;
  root.lang = language;
  root.dir = language === "ar" ? "rtl" : "ltr";

  var style = document.createElement("style");
  style.id = "kridiya-boot-style";
  style.textContent = "html.kridiya-booting body{visibility:hidden}html.kridiya-booting{background:#fff}";
  document.head.appendChild(style);

  var released = false;
  function release() {
    if (released) return;
    released = true;
    root.classList.remove("kridiya-booting");
    style.remove();
  }

  window.KRIDIYA_LOCALE_BOOT = {
    region: region,
    language: language,
    bilingualLegalPage: bilingualLegalPage,
    release: release
  };
  window.setTimeout(release, 5000);
})();
