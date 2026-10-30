/* ============================================================
   Kridiya Travel — shared chrome, config & helpers
   ============================================================ */
"use strict";

document.documentElement.classList.add("js");

/* ---------- Region and language boundary ----------
   UAE hosts may offer English and Arabic. India and international hosts stay
   English-only. The query parameter is a local/preview aid and is not needed
   on the regional production hosts. Privacy and terms remain bilingual legal
   documents, with English first and Arabic following in the same page. */
const KRIDIYA_LOCALE = (function () {
  const boot = window.KRIDIYA_LOCALE_BOOT;
  const params = new URLSearchParams(location.search);
  const host = location.hostname.toLowerCase();
  const firstPathSegment = location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
  const previewRegion = params.get("region");
  const region = boot?.region || (["ae", "in", "en"].includes(previewRegion) ? previewRegion
    : host.endsWith(".in") || firstPathSegment === "in" ? "in"
    : firstPathSegment === "en" || host.startsWith("global.") ? "en"
    : "ae");
  const page = location.pathname.split("/").pop() || "index.html";
  const bilingualLegalPage = page === "privacy.html" || page === "terms.html";
  const storageKey = "kridiya_language_ae";
  let stored = "";
  try { stored = localStorage.getItem(storageKey) || ""; } catch (error) { /* Storage can be unavailable. */ }
  const requested = params.get("lang");
  const browserPrefersArabic = (navigator.languages || [navigator.language || "en"])
    .some(function (value) { return /^ar(?:-|$)/i.test(value); });
  const language = boot?.language || (region === "ae" && !bilingualLegalPage
    ? (["en", "ar"].includes(requested) ? requested : ["en", "ar"].includes(stored) ? stored : browserPrefersArabic ? "ar" : "en")
    : "en");

  document.documentElement.dataset.siteRegion = region;
  document.documentElement.dataset.siteLanguage = language;
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";

  let ready = Promise.resolve();
  if (language === "ar") {
    ready = new Promise(function (resolve) {
      const script = document.createElement("script");
      const mainSource = document.currentScript && document.currentScript.src
        ? document.currentScript.src
        : new URL("js/main.js", document.baseURI).href;
      const localizationSource = new URL("localization-ar.js", mainSource);
      localizationSource.search = new URL(mainSource).search;
      script.src = localizationSource.href;
      script.defer = true;
      script.onload = resolve;
      script.onerror = function () {
        console.error("Arabic localisation could not be loaded. Returning to English.");
        try { localStorage.setItem(storageKey, "en"); } catch (error) { /* Storage can be unavailable. */ }
        document.documentElement.lang = "en";
        document.documentElement.dir = "ltr";
        document.documentElement.dataset.siteLanguage = "en";
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  function setLanguage(next) {
    if (region !== "ae" || bilingualLegalPage || !["en", "ar"].includes(next)) return;
    try { localStorage.setItem(storageKey, next); } catch (error) { /* Storage can be unavailable. */ }
    const nextURL = new URL(location.href);
    nextURL.searchParams.delete("lang");
    location.assign(nextURL.href);
  }

  return {
    region: region,
    language: language,
    isBilingualLegalPage: bilingualLegalPage,
    canChooseArabic: region === "ae" && !bilingualLegalPage,
    ready: ready,
    setLanguage: setLanguage,
    text: function (english) {
      return language === "ar" && window.KRIDIYA_AR_TRANSLATIONS
        ? (window.KRIDIYA_AR_TRANSLATIONS[english] || english)
        : english;
    }
  };
})();
window.KridiyaLocale = KRIDIYA_LOCALE;

/* ---------- Business config ---------- */
const KRIDIYA = {
  brand: "Kridiya Travel",
  legal: "Kridiya Travel and Tourism FZ-LLC",
  address: "Ras Al Khaimah, United Arab Emirates",
  phoneDisplay: "+971 50 941 3873",
  phoneTel: "+971509413873",
  waNumber: "971509413873",
  emails: {
    enquiry: "enquiry@kridiyatravel.com",
    contact: "contact@kridiyatravel.com",
    info: "info@kridiyatravel.com",
    deals: "deals@kridiyatravel.com"
  },
  social: {
    instagram: "https://www.instagram.com/kridiyatravel/",
    facebook: "https://www.facebook.com/profile.php?id=61592086520680",
    linkedin: "https://www.linkedin.com/company/kridiya-travel/"
  }
};

const KRIDIYA_GA4_MEASUREMENT_ID = "G-LB1TW8J03E";
const KRIDIYA_META_DATASET_ID = "1584188866628210";
const ANALYTICS_CONSENT_KEY = "kridiya_analytics_consent";
const MARKETING_CONSENT_KEY = "kridiya_marketing_measurement_consent";
const COOKIE_CONSENT_RECORD_KEY = "kridiya_cookie_consent_record";
const COOKIE_CONSENT_MANAGE_KEY = "kridiya_cookie_manage_on_load";
const COOKIE_CONSENT_VERSION = "2026-10-24";
const COOKIE_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function isPublicMeasurementPage() {
  return /^\/(?:index|about|contact|flights|hotels|holidays|umrah|cruise|visa|privacy|terms)?(?:\.html)?$/.test(location.pathname) ||
    /^\/guides\/(?:index|flight-booking-checklist)\.html$/.test(location.pathname);
}

function measurementPageURL() { return location.origin + location.pathname; }

function measurementReferrer() {
  try { return document.referrer ? new URL(document.referrer).origin : ""; }
  catch (error) { return ""; }
}

/* ---------- Marketing attribution and event queue ----------
   No personal information is stored here. GA4 and any future GTM container
   consume the same dataLayer events without changing the enquiry forms. */
const ATTRIBUTION_KEYS = [
  "utm_id", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "fbclid", "msclkid", "ttclid"
];
const ATTRIBUTION_FIRST_KEY = "kridiya_first_touch";
const ATTRIBUTION_LAST_KEY = "kridiya_last_touch";

function safeStorage(storage, action, key, value) {
  try {
    if (action === "get") return storage.getItem(key);
    if (action === "remove") return storage.removeItem(key);
    storage.setItem(key, value);
  } catch (e) { /* Storage may be blocked; attribution stays best-effort. */ }
  return null;
}

function globalPrivacyControlEnabled() {
  return navigator.globalPrivacyControl === true;
}

function readCookieConsentRecord() {
  const raw = safeStorage(localStorage, "get", COOKIE_CONSENT_RECORD_KEY);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    const updatedAt = Date.parse(record.updatedAt || "");
    const validChoice = function (value) { return value === "granted" || value === "denied"; };
    if (record.version !== COOKIE_CONSENT_VERSION ||
        !validChoice(record.analytics) || !validChoice(record.advertising) ||
        !Number.isFinite(updatedAt) || Date.now() - updatedAt > COOKIE_CONSENT_MAX_AGE_MS) {
      return null;
    }
    return record;
  } catch (error) {
    return null;
  }
}

function hasAnalyticsConsent() {
  const record = readCookieConsentRecord();
  return Boolean(record && record.analytics === "granted");
}

function hasMarketingConsent() {
  const record = readCookieConsentRecord();
  return Boolean(record && record.advertising === "granted" && !globalPrivacyControlEnabled());
}

function clearMeasurementCookies(prefixes) {
  const cookieNames = document.cookie.split(";").map(function (part) {
    return part.split("=")[0].trim();
  }).filter(function (name) {
    return prefixes.some(function (prefix) { return name === prefix || name.startsWith(prefix); });
  });
  const host = location.hostname;
  const domains = [""];
  if (host && host !== "localhost" && !/^\d+(?:\.\d+){3}$/.test(host)) {
    domains.push(host, "." + host, "." + host.split(".").slice(-2).join("."));
  }
  cookieNames.forEach(function (name) {
    domains.forEach(function (domain) {
      document.cookie = name + "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" +
        (domain ? "; domain=" + domain : "") + "; SameSite=Lax";
    });
  });
}

function writeCookieConsentRecord(analytics, advertising, source) {
  const record = {
    version: COOKIE_CONSENT_VERSION,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + COOKIE_CONSENT_MAX_AGE_MS).toISOString(),
    analytics: analytics,
    advertising: advertising,
    source: source,
    globalPrivacyControl: globalPrivacyControlEnabled()
  };
  safeStorage(localStorage, "set", COOKIE_CONSENT_RECORD_KEY, JSON.stringify(record));
  return record;
}

function setAnalyticsConsent(value, persist) {
  const granted = value === "granted";
  if (persist) safeStorage(localStorage, "set", ANALYTICS_CONSENT_KEY, granted ? "granted" : "denied");
  if (!granted) {
    try {
      localStorage.removeItem(ATTRIBUTION_FIRST_KEY);
      sessionStorage.removeItem(ATTRIBUTION_LAST_KEY);
    } catch (e) { /* Storage can be unavailable. */ }
    clearMeasurementCookies(["_ga"]);
  }
  if (granted) initGoogleAnalytics();
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
  }
}

function initMetaPixel() {
  // The browser pixel reads the full URL itself. Do not load it on private or parameterised pages.
  if (!hasMarketingConsent()) return;
  if (!isPublicMeasurementPage() || location.search || location.hash) return;
  if (window.kridiyaMetaPixelLoaded) return;
  window.kridiyaMetaPixelLoaded = true;

  if (!window.fbq) {
    const fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
  }

  window.fbq("init", KRIDIYA_META_DATASET_ID);
  window.fbq("consent", "grant");
  window.fbq("track", "PageView");

  if (!document.querySelector('script[data-kridiya-meta-pixel]')) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.kridiyaMetaPixel = "true";
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
}

function setMarketingMeasurementConsent(value, persist) {
  const granted = value === "granted";
  if (persist) {
    safeStorage(localStorage, "set", MARKETING_CONSENT_KEY, granted ? "granted" : "denied");
  }
  if (granted) initMetaPixel();
  else {
    if (window.fbq) window.fbq("consent", "revoke");
    clearMeasurementCookies(["_fbp", "_fbc"]);
  }
}

function applyCookieConsent(analytics, advertising, source) {
  const analyticsChoice = analytics === "granted" ? "granted" : "denied";
  const advertisingChoice = advertising === "granted" && !globalPrivacyControlEnabled() ? "granted" : "denied";
  writeCookieConsentRecord(analyticsChoice, advertisingChoice, source);
  setAnalyticsConsent(analyticsChoice, true);
  setMarketingMeasurementConsent(advertisingChoice, true);
}

function resetMeasurementConsent() {
  setAnalyticsConsent("denied", true);
  setMarketingMeasurementConsent("denied", true);
  safeStorage(localStorage, "remove", COOKIE_CONSENT_RECORD_KEY);
  safeStorage(sessionStorage, "set", COOKIE_CONSENT_MANAGE_KEY, "true");
  location.reload();
}

function initGoogleAnalytics() {
  if (!isPublicMeasurementPage()) return;
  if (!hasAnalyticsConsent()) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });

  window.gtag("js", new Date());
  window.gtag("config", KRIDIYA_GA4_MEASUREMENT_ID, {
    send_page_view: true,
    page_location: measurementPageURL(),
    page_referrer: measurementReferrer()
  });

  if (!document.querySelector('script[data-kridiya-ga4]')) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.kridiyaGa4 = "true";
    script.src = "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(KRIDIYA_GA4_MEASUREMENT_ID);
    document.head.appendChild(script);
  }
}

function initAnalyticsConsentBanner() {
  const manageOnLoad = safeStorage(sessionStorage, "get", COOKIE_CONSENT_MANAGE_KEY) === "true";
  if (manageOnLoad) safeStorage(sessionStorage, "remove", COOKIE_CONSENT_MANAGE_KEY);
  let consentRecord = readCookieConsentRecord();
  if (consentRecord && globalPrivacyControlEnabled() && consentRecord.advertising === "granted") {
    applyCookieConsent(consentRecord.analytics, "denied", "global_privacy_control");
    consentRecord = readCookieConsentRecord();
  }
  const savedAnalytics = consentRecord ? consentRecord.analytics : "denied";
  const savedMarketing = consentRecord ? consentRecord.advertising : "denied";
  if (consentRecord && !manageOnLoad) {
    if (savedAnalytics === "granted") initGoogleAnalytics();
    if (savedMarketing === "granted") initMetaPixel();
    return;
  }

  const banner = document.createElement("aside");
  banner.className = "analytics-consent";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-modal", "true");
  banner.setAttribute("aria-label", "Cookie preferences");
  banner.innerHTML =
    '<div class="analytics-consent-copy"><b>Cookies</b><p>Essential storage keeps this website working. With your choice, Google Analytics helps us understand visits and Meta helps us measure advertising. Optional technologies stay off until you allow them. You can accept all, reject optional cookies or choose each category. Change your choice at any time in our <a href="privacy.html#measurement" data-cookie-policy>Cookies Policy</a>.</p></div>' +
    '<div class="analytics-consent-actions">' +
      '<button class="btn" type="button" data-measurement-choice="denied">Reject optional</button>' +
      '<button class="btn" type="button" data-cookie-preferences aria-expanded="false" aria-controls="cookie-preference-options">Choose your preferences</button>' +
      '<button class="btn btn-primary" type="button" data-measurement-choice="all">Accept all</button>' +
    "</div>" +
    '<div class="analytics-consent-preferences" id="cookie-preference-options" hidden>' +
      '<div class="analytics-consent-preferences-head"><div><b>Cookie preferences</b><p>Choose how KRIDIYA Travel uses optional technologies. Analytics processes page URLs, referrers, campaign details, device information and interaction events. Advertising measurement processes public-page visits, click identifiers and event identifiers. We do not send enquiry text or contact, passport or payment details. Change your choice at any time in our <a href="privacy.html#measurement" data-cookie-policy>Cookies Policy</a>.</p><p class="analytics-consent-gpc" data-cookie-gpc hidden>Global Privacy Control is enabled. Advertising measurement will remain off.</p></div><button type="button" class="analytics-consent-close" data-cookie-preferences-close aria-label="Back to cookie notice">&times;</button></div>' +
      '<div class="analytics-consent-tabs" role="tablist" aria-label="Cookie preference details"><button type="button" role="tab" aria-selected="true" aria-controls="cookie-categories-panel" id="cookie-categories-tab" data-cookie-tab="categories">Categories</button><button type="button" role="tab" aria-selected="false" aria-controls="cookie-services-panel" id="cookie-services-tab" data-cookie-tab="services" tabindex="-1">Services</button></div>' +
      '<div class="analytics-consent-tab-panel" id="cookie-categories-panel" role="tabpanel" aria-labelledby="cookie-categories-tab" data-cookie-panel="categories">' +
        '<div class="analytics-consent-option analytics-consent-option--essential"><span><b>Essential cookies</b><small>Keep core site features, language choices and secure account access working.</small></span><strong>Always active</strong></div>' +
        '<div class="analytics-consent-option"><span><b>Analytics cookies</b><small>Help us understand visits and improve the website.</small></span><button class="analytics-consent-switch" type="button" role="switch" aria-checked="false" data-cookie-analytics aria-label="Allow analytics cookies"></button></div>' +
        '<div class="analytics-consent-option"><span><b>Advertising measurement</b><small>Helps us measure whether our advertising leads to useful visits.</small></span><button class="analytics-consent-switch" type="button" role="switch" aria-checked="false" data-cookie-marketing aria-label="Allow advertising measurement"></button></div>' +
      '</div>' +
      '<div class="analytics-consent-tab-panel analytics-consent-services" id="cookie-services-panel" role="tabpanel" aria-labelledby="cookie-services-tab" data-cookie-panel="services" hidden>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-kridiya" data-cookie-service><span><b>KRIDIYA browser storage</b><small>Essential</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-kridiya" hidden>Remembers your cookie choice, language, sign-in state and in-progress enquiry details on this device.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-supabase" data-cookie-service><span><b>Supabase</b><small>Essential when you request account or enquiry services</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-supabase" hidden>Provides account authentication, secure sessions, enquiries and customer account services that you request.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-jsdelivr" data-cookie-service><span><b>jsDelivr</b><small>Essential service delivery</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-jsdelivr" hidden>Delivers the Supabase browser library when account or enquiry features need it.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-google-signin" data-cookie-service><span><b>Google sign-in</b><small>Essential when selected</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-google-signin" hidden>Connects to Google only when you choose Continue with Google for account access.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-fonts" data-cookie-service><span><b>Google Fonts</b><small>Site delivery</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-fonts" hidden>Delivers the website typefaces. Google receives ordinary connection data, such as the requesting IP address and browser information.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-unsplash" data-cookie-service><span><b>Unsplash Images</b><small>Site content delivery</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-unsplash" hidden>Delivers travel photographs used on some pages. Unsplash receives ordinary connection data when your browser requests an image.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-formsubmit" data-cookie-service><span><b>FormSubmit</b><small>Requested form delivery</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-formsubmit" hidden>Receives the form details you choose to submit so Kridiya can receive enquiry and newsletter email notifications.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-ga4" data-cookie-service><span><b>Google Analytics 4</b><small>Analytics</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-ga4" hidden>Measures visits and interactions after you allow analytics cookies. Advertising storage and personalisation remain disabled.</div>' +
        '<button class="analytics-consent-service" type="button" aria-expanded="false" aria-controls="cookie-service-meta" data-cookie-service><span><b>Meta Pixel and Conversions API</b><small>Advertising measurement</small></span><i aria-hidden="true"></i></button><div class="analytics-consent-service-detail" id="cookie-service-meta" hidden>Measures public-page visits and enquiry events after you allow advertising measurement. Contact, passport and payment details are not sent in these events.</div>' +
      '</div>' +
      '<div class="analytics-consent-preference-actions"><button class="btn" type="button" data-measurement-choice="denied">Reject optional</button><button class="btn" type="button" data-cookie-save>Save choices</button><button class="btn btn-primary" type="button" data-measurement-choice="all">Accept all</button></div>' +
    "</div>";

  banner.querySelector("[data-cookie-analytics]").setAttribute("aria-checked", savedAnalytics === "granted" ? "true" : "false");
  banner.querySelector("[data-cookie-marketing]").setAttribute("aria-checked", savedMarketing === "granted" ? "true" : "false");
  if (globalPrivacyControlEnabled()) {
    const marketingSwitch = banner.querySelector("[data-cookie-marketing]");
    marketingSwitch.setAttribute("aria-checked", "false");
    marketingSwitch.setAttribute("aria-disabled", "true");
    marketingSwitch.disabled = true;
    banner.querySelector("[data-cookie-gpc]").hidden = false;
    banner.querySelectorAll('[data-measurement-choice="all"]').forEach(function (button) {
      button.textContent = "Accept analytics";
    });
  }

  function setPageLocked(locked) {
    document.body.classList.toggle("cookie-consent-pending", locked);
    Array.from(document.body.children).forEach(function (element) {
      if (element === banner || element.tagName === "SCRIPT") return;
      if (locked && !element.inert) {
        element.inert = true;
        element.dataset.cookieConsentInert = "true";
      } else if (!locked && element.dataset.cookieConsentInert === "true") {
        element.inert = false;
        delete element.dataset.cookieConsentInert;
      }
    });
  }

  function closeBanner() {
    setPageLocked(false);
    banner.remove();
  }

  banner.addEventListener("click", function (event) {
    const policyLink = event.target.closest("[data-cookie-policy]");
    if (policyLink) safeStorage(sessionStorage, "set", "kridiya_cookie_policy_access", "true");

    const preferencesButton = event.target.closest("[data-cookie-preferences]");
    if (preferencesButton) {
      const preferences = banner.querySelector(".analytics-consent-preferences");
      const opening = preferences.hidden;
      preferences.hidden = !opening;
      banner.classList.toggle("is-customizing", opening);
      preferencesButton.setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) banner.querySelector('[data-cookie-tab="categories"]').focus();
      return;
    }

    const preferencesClose = event.target.closest("[data-cookie-preferences-close]");
    if (preferencesClose) {
      const preferences = banner.querySelector(".analytics-consent-preferences");
      preferences.hidden = true;
      banner.classList.remove("is-customizing");
      const chooser = banner.querySelector("[data-cookie-preferences]");
      chooser.setAttribute("aria-expanded", "false");
      chooser.focus();
      return;
    }

    const tabButton = event.target.closest("[data-cookie-tab]");
    if (tabButton) {
      const selected = tabButton.dataset.cookieTab;
      banner.querySelectorAll("[data-cookie-tab]").forEach(function (button) {
        const active = button === tabButton;
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
      });
      banner.querySelectorAll("[data-cookie-panel]").forEach(function (panel) {
        panel.hidden = panel.dataset.cookiePanel !== selected;
      });
      return;
    }

    const serviceButton = event.target.closest("[data-cookie-service]");
    if (serviceButton) {
      const detail = banner.querySelector("#" + serviceButton.getAttribute("aria-controls"));
      const opening = serviceButton.getAttribute("aria-expanded") !== "true";
      serviceButton.setAttribute("aria-expanded", opening ? "true" : "false");
      detail.hidden = !opening;
      return;
    }

    const consentSwitch = event.target.closest(".analytics-consent-switch");
    if (consentSwitch) {
      consentSwitch.setAttribute("aria-checked", consentSwitch.getAttribute("aria-checked") === "true" ? "false" : "true");
      return;
    }

    const saveButton = event.target.closest("[data-cookie-save]");
    if (saveButton) {
      applyCookieConsent(
        banner.querySelector("[data-cookie-analytics]").getAttribute("aria-checked") === "true" ? "granted" : "denied",
        banner.querySelector("[data-cookie-marketing]").getAttribute("aria-checked") === "true" ? "granted" : "denied",
        "save_choices"
      );
      closeBanner();
      return;
    }

    const button = event.target.closest("[data-measurement-choice]");
    if (!button) return;
    const choice = button.dataset.measurementChoice;
    applyCookieConsent(
      choice === "denied" ? "denied" : "granted",
      choice === "all" ? "granted" : "denied",
      choice === "denied" ? "reject_optional" : "accept_all"
    );
    closeBanner();
  });

  banner.addEventListener("keydown", function (event) {
    const currentTab = event.target.closest && event.target.closest("[data-cookie-tab]");
    if (currentTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const tabs = Array.from(banner.querySelectorAll("[data-cookie-tab]"));
      const currentIndex = tabs.indexOf(currentTab);
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? tabs.length - 1
        : event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[nextIndex].click();
      tabs[nextIndex].focus();
      return;
    }
    if (event.key !== "Escape" || !banner.classList.contains("is-customizing")) return;
    banner.querySelector("[data-cookie-preferences-close]").click();
  });

  document.body.appendChild(banner);
  const policyAccess = /\/privacy(?:\.html)?$/.test(location.pathname) &&
    safeStorage(sessionStorage, "get", "kridiya_cookie_policy_access") === "true";
  if (!policyAccess) {
    setPageLocked(true);
    requestAnimationFrame(function () { banner.querySelector("[data-cookie-preferences]").focus(); });
  }
  if (manageOnLoad) banner.querySelector("[data-cookie-preferences]").click();
}

function readStoredJSON(storage, key) {
  const raw = safeStorage(storage, "get", key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function classifyTraffic(touch) {
  const medium = String(touch.utm_medium || "").toLowerCase();
  if (touch.gclid || touch.fbclid || touch.msclkid || touch.ttclid ||
      /^(cpc|ppc|paid|paid_social|display|affiliate)$/.test(medium)) return "paid";
  if (/^(organic|seo)$/.test(medium)) return "organic";
  if (touch.referrer) return "referral";
  return touch.utm_source ? "unknown" : "direct";
}

function sourceFromTouch(touch) {
  if (touch.utm_source) return touch.utm_source;
  if (touch.gclid) return "google";
  if (touch.fbclid) return "meta";
  if (touch.msclkid) return "microsoft";
  if (touch.ttclid) return "tiktok";
  if (touch.referrer) {
    try { return new URL(touch.referrer).hostname.replace(/^www\./, ""); }
    catch (e) { return "referral"; }
  }
  return "direct";
}

function captureAttribution() {
  if (!hasAnalyticsConsent()) return null;
  const params = new URLSearchParams(location.search);
  const safeLanding = location.pathname;
  const touch = {
    landing_page: safeLanding.slice(0, 500),
    referrer: document.referrer ? new URL(document.referrer).origin.slice(0, 500) : "",
    captured_at: new Date().toISOString()
  };
  ATTRIBUTION_KEYS.forEach(function (key) {
    const value = params.get(key);
    if (value) touch[key] = value.slice(0, 500);
  });
  touch.source = sourceFromTouch(touch);
  touch.medium = touch.utm_medium || (touch.referrer ? "referral" : "none");
  touch.campaign = touch.utm_campaign || "";
  touch.traffic_type = classifyTraffic(touch);
  touch.source_basis = touch.utm_source || ATTRIBUTION_KEYS.some(function (k) { return touch[k]; })
    ? "campaign_parameter"
    : (touch.referrer ? "referrer" : "direct");
  touch.source_confidence = touch.source_basis === "campaign_parameter" ? "high" :
    (touch.source_basis === "referrer" ? "medium" : "low");

  if (!readStoredJSON(localStorage, ATTRIBUTION_FIRST_KEY)) {
    safeStorage(localStorage, "set", ATTRIBUTION_FIRST_KEY, JSON.stringify(touch));
  }
  safeStorage(sessionStorage, "set", ATTRIBUTION_LAST_KEY, JSON.stringify(touch));
  return touch;
}

function attributionPayload() {
  const enabled = hasAnalyticsConsent();
  const empty = { source: "direct", medium: "none", campaign: "", landing_page: location.pathname,
    referrer: "", traffic_type: "direct", source_basis: "direct", source_confidence: "low" };
  function sanitize(touch) {
    if (!touch) return empty;
    try {
      const landing = new URL(touch.landing_page || location.pathname, location.origin);
      touch.landing_page = landing.pathname.slice(0, 500);
    } catch (e) { touch.landing_page = location.pathname; }
    try { touch.referrer = touch.referrer ? new URL(touch.referrer).origin.slice(0, 500) : ""; }
    catch (e) { touch.referrer = ""; }
    return touch;
  }
  const first = enabled ? sanitize(readStoredJSON(localStorage, ATTRIBUTION_FIRST_KEY) || captureAttribution()) : empty;
  const last = enabled ? sanitize(readStoredJSON(sessionStorage, ATTRIBUTION_LAST_KEY) || captureAttribution()) : empty;
  if (enabled) {
    safeStorage(localStorage, "set", ATTRIBUTION_FIRST_KEY, JSON.stringify(first));
    safeStorage(sessionStorage, "set", ATTRIBUTION_LAST_KEY, JSON.stringify(last));
  }
  return {
    first_touch_source: first.source || "direct",
    first_touch_medium: first.medium || "none",
    first_touch_campaign: first.campaign || null,
    last_touch_source: last.source || "direct",
    last_touch_medium: last.medium || "none",
    last_touch_campaign: last.campaign || null,
    utm_id: last.utm_id || null,
    utm_source: last.utm_source || null,
    utm_medium: last.utm_medium || null,
    utm_campaign: last.utm_campaign || null,
    utm_content: last.utm_content || null,
    utm_term: last.utm_term || null,
    gclid: last.gclid || null,
    fbclid: last.fbclid || null,
    msclkid: last.msclkid || null,
    ttclid: last.ttclid || null,
    landing_page: last.landing_page || location.pathname,
    referrer: last.referrer || null,
    traffic_type: last.traffic_type || "unknown",
    source_basis: last.source_basis || "direct",
    source_confidence: last.source_confidence || "low"
  };
}

function trackEvent(name, properties, meta) {
  if (!isPublicMeasurementPage()) return;
  const payload = {
    page_type: document.body.dataset.page || "unknown",
    service_type: document.body.dataset.widgetOnly || null,
    page_location: measurementPageURL(),
    page_referrer: measurementReferrer()
  };
  // Keep customer names, booking references and arbitrary form fields out of measurement.
  ["service_type", "enquiry_type", "method", "link_location", "status"].forEach(function (key) {
    const value = properties && properties[key];
    if (typeof value === "string" && /^[a-zA-Z0-9 _-]{1,80}$/.test(value)) payload[key] = value;
  });
  if (hasAnalyticsConsent() && typeof window.gtag === "function") {
    window.gtag("event", name, payload);
  }
  trackMetaEvent(name, payload, meta);
}

function trackMetaEvent(name, properties, meta) {
  if (!isPublicMeasurementPage() || location.search || location.hash) return;
  if (!hasMarketingConsent() ||
      typeof window.fbq !== "function") return;

  const safe = {
    content_name: properties.service_type || properties.enquiry_type || properties.page_type || "general",
    content_category: properties.page_type || "website"
  };
  if (properties.method) safe.method = properties.method;
  if (properties.link_location) safe.link_location = String(properties.link_location).slice(0, 100);

  const standardEvents = {
    view_service: "ViewContent",
    submit_enquiry: "Lead",
    newsletter_signup: "Subscribe",
    register_account: "CompleteRegistration",
    click_whatsapp: "Contact",
    click_call: "Contact",
    click_email: "Contact"
  };
  const standardName = standardEvents[name];
  const eventOptions = meta && meta.eventId ? { eventID: meta.eventId } : undefined;
  if (standardName) window.fbq("track", standardName, safe, eventOptions);
  else window.fbq("trackCustom", name, safe, eventOptions);
}

function generateMetaEventId(prefix) {
  const random = window.crypto && typeof window.crypto.randomUUID === "function"
    ? window.crypto.randomUUID()
    : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  return (prefix || "event") + "-" + random;
}

function readCookie(name) {
  const prefix = encodeURIComponent(name) + "=";
  const match = document.cookie.split(";").map(function (part) { return part.trim(); })
    .find(function (part) { return part.indexOf(prefix) === 0; });
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function sendMetaLeadServerEvent(eventId, serviceType, enquiryType) {
  if (!isPublicMeasurementPage()) return;
  if (!hasMarketingConsent()) return;
  const sb = await KridiyaAuth.client();
  const result = await sb.functions.invoke("meta-conversions", {
    body: {
      event_name: "Lead",
      event_id: eventId,
      event_source_url: measurementPageURL(),
      client_user_agent: navigator.userAgent,
      fbp: readCookie("_fbp"),
      fbc: readCookie("_fbc"),
      custom_data: {
        content_name: serviceType || enquiryType || "general",
        content_category: document.body.dataset.page || "website"
      }
    }
  });
  if (result.error) throw result.error;
}

initGoogleAnalytics();
captureAttribution();

function waLink(message) {
  return "https://wa.me/" + KRIDIYA.waNumber + (message ? "?text=" + encodeURIComponent(message) : "");
}

/* ---------- SVG icon paths (24x24 viewBox) ---------- */
const ICONS = {
  phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z",
  mail: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  pin: "M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  plane: "M21.5 15.5 13 10.7V4.5C13 3.7 12.3 3 11.5 3S10 3.7 10 4.5v6.2l-8.5 4.8v2l8.5-2.7v5.4L8 21.7V23l3.5-1 3.5 1v-1.3l-2-1.5v-5.4l8.5 2.7v-2z",
  hotel: "M7 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-6h-8v7H5V5H3v14h2v-2h14v2h2v-9a4 4 0 0 0-4-4z",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm7 9h-3a15 15 0 0 0-1.3-5.7A8 8 0 0 1 19 11zM12 4.1c.9 1.2 1.8 3.5 2 6.9h-4c.2-3.4 1.1-5.7 2-6.9zM5 13h3a15 15 0 0 0 1.3 5.7A8 8 0 0 1 5 13zm4.3-2H5a8 8 0 0 1 4.3-5.7A15 15 0 0 0 9.3 11zM12 19.9c-.9-1.2-1.8-3.5-2-6.9h4c-.2 3.4-1.1 5.7-2 6.9zm2.7-1.2A15 15 0 0 0 16 13h3a8 8 0 0 1-4.3 5.7z",
  suitcase: "M9 6V4c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2h3c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2h3zm2-2v2h2V4h-2zM8 9v9h1.5V9H8zm6.5 0v9H16V9h-1.5z",
  passport: "M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H6zm6 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.6c.5.7 1 1.7 1.1 2.4h-2.2c.1-.7.6-1.7 1.1-2.4zM9.7 10c-.2-.6-.1-1 .1-1.5.3-.5.8-.8 1.2-1-.4.8-.7 1.7-.7 2.5h-.6zm4 0c0-.8-.3-1.7-.7-2.5.4.2.9.5 1.2 1 .2.5.3.9.1 1.5h-.6zM9.7 12h.6c0 .8.3 1.7.7 2.5-.4-.2-.9-.5-1.2-1-.2-.5-.3-.9-.1-1.5zm4.6 0h.6c.2.6.1 1-.1 1.5-.3.5-.8.8-1.2 1 .4-.8.7-1.7.7-2.5zM8 17h8v1.5H8V17z",
  whatsapp: "M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.3-.4 0-.5.2-.7l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.3z",
  instagram: "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.4-.3.8-.3 1.9-.1 1.3-.1 1.7-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.1.8.3 1.9.3 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.4.3-.8.3-1.9.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.1-.8-.3-1.9-.3-1.3-.1-1.7-.1-4.8-.1zm0 3.1a5 5 0 1 1 0 9.9 5 5 0 0 1 0-9.9zm0 1.8a3.1 3.1 0 1 0 0 6.3 3.1 3.1 0 0 0 0-6.3zm5.1-2.2a1.2 1.2 0 1 1 0 2.3 1.2 1.2 0 0 1 0-2.3z",
  facebook: "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z",
  linkedin: "M6.5 8.3H3.2V19h3.3V8.3zM4.9 3a1.9 1.9 0 1 0 0 3.8A1.9 1.9 0 0 0 4.9 3zm14 9.9c0-3.2-1.7-4.9-4.1-4.9-1.9 0-2.8 1-3.2 1.8V8.3H8.3V19h3.3v-5.3c0-1.4.3-2.8 2-2.8 1.7 0 1.7 1.6 1.7 2.9V19h3.3l.3-6.1z",
  shield: "M12 1 3 5v6c0 5.6 3.8 10.7 9 12 5.2-1.3 9-6.4 9-12V5l-9-4zm-2 16-4-4 1.4-1.4L10 14.2l6.6-6.6L18 9l-8 8z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.2 14.2L11 13.3V7h1.5v5.4l4.5 2.7-.8 1.1z",
  tag: "M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l9 9c.8.8 2 .8 2.8 0l7-7c.8-.8.8-2 0-2.8zM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8z",
  users: "M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0h-1.1c1.2.8 2.1 1.9 2.1 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z",
  swap: "M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z",
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z",
  menu: "M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z",
  close: "M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z",
  star: "M12 17.3 6.2 21l1.6-6.6L2.5 9.9l6.8-.5L12 3l2.7 6.4 6.8.5-5.3 4.5L17.8 21z",
  check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z",
  inbox: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z",
  chevronLeft: "M15.4 6 9.4 12l6 6 1.4-1.4L12.2 12l4.6-4.6z",
  chevronRight: "M8.6 6 14.6 12l-6 6-1.4-1.4L11.8 12 7.2 7.4z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  trash: "M6 7h12l-1 13.1c-.1 1-.9 1.9-2 1.9H9c-1.1 0-1.9-.9-2-1.9zm3-3h6l1 2H8zM4 5h16v2H4z",
  route: "M4 6a3 3 0 1 1 4.9 2.3l3 3.6L18 9c-.6-.5-1-1.3-1-2.1a3 3 0 1 1 3.9 2.9l-6.6 6.6a1 1 0 0 1-1.4 0L7 10.6 4 14.3V19h13v2H4a2 2 0 0 1-2-2v-5.3a2 2 0 0 1 .4-1.2l3-4A3 3 0 0 1 4 6z",
  home: "M12 2.5 2 11h2v10h6v-6h4v6h6V11h2L12 2.5z",
  help: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 17.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.5-5.2v.6h-3v-1c0-1.8.9-2.7 2-3.5.8-.6 1.3-1 1.3-1.8 0-1-.7-1.7-1.9-1.7-1.1 0-2 .6-2.8 1.6L7 7.1A6 6 0 0 1 12 4.8c3 0 5 1.6 5 4 0 2.1-1.2 3.2-2.5 4.1-.7.6-1 .9-1 1.7z",
  account: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z",
  ship: "M20 21c-1.4 0-2.8-.5-4-1.3-2.4 1.7-5.6 1.7-8 0-1.2.8-2.6 1.3-4 1.3H2v2h2c1.4 0 2.7-.3 4-1 2.5 1.3 5.5 1.3 8 0 1.3.7 2.6 1 4 1h2v-2h-2zM4 11l1.3.4L4 12l-.3-.2-.6 2.1c0 .2 0 .5.1.7L4 15c1.6 0 3-.9 4-2 1 1.1 2.4 2 4 2s3-.9 4-2c1 1.1 2.4 2 4 2l.8-.5c.1-.2.2-.5.1-.7l-1.9-6.7c-.1-.3-.3-.5-.6-.6L20 6.6V4c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v.6L4 11zM6 6h12v3.9L12 8 6 9.9V6z",
  kaaba: "M12 2 4 6.5v11L12 22l8-4.5v-11L12 2zm0 2.3 5.8 3.3L12 10.9 6.2 7.6 12 4.3zM6 9.2l5 2.9v6.8l-5-2.8V9.2zm7 9.7v-6.8l5-2.9v6.8l-5 2.9z"
};

function icon(name, cls) {
  return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + ICONS[name] + '"/></svg>';
}

/* ---------- Logo (shared by header and footer) ---------- */
function logoHTML(footer) {
  return (
    '<a class="logo" href="index.html" aria-label="Kridiya Travel — home">' +
      '<img class="logo-art" src="assets/logo-wordmark.png" alt="Kridiya Travel and Tourism" width="780" height="323" decoding="async">' +
    "</a>"
  );
}

/* ---------- Site chrome ---------- */
function organizeConsumerFooter(footer) {
  const container = footer.querySelector(':scope > .container');
  const grid = footer.querySelector('.footer-grid');
  const brand = grid.querySelector('.footer-brand');
  const connect = grid.querySelector('.footer-connect');
  const newsletter = connect.querySelector('.newsletter-form');

  function link(label, href, options) {
    const anchor = document.createElement('a');
    anchor.textContent = label;
    anchor.href = href;
    if (options?.external) {
      anchor.target = '_blank';
      anchor.rel = 'noopener';
    }
    return anchor;
  }

  function directoryGroup(title, sections, key) {
    const details = document.createElement('details');
    details.className = 'footer-directory-group';
    details.dataset.footerGroup = key;
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = title;
    const body = document.createElement('div');
    body.className = 'footer-directory-body';
    sections.forEach(function (section) {
      const sectionElement = document.createElement('section');
      sectionElement.className = 'footer-directory-section';
      const heading = document.createElement('h5');
      heading.textContent = section.title;
      const list = document.createElement('ul');
      list.className = 'footer-links';
      section.links.forEach(function (item) {
        const listItem = document.createElement('li');
        listItem.append(item instanceof HTMLAnchorElement ? item : link(item[0], item[1], item[2]));
        list.append(listItem);
      });
      sectionElement.append(heading, list);
      body.append(sectionElement);
    });
    details.append(summary, body);
    return details;
  }

  const identityStrip = document.createElement('section');
  identityStrip.className = 'footer-identity-strip';
  identityStrip.setAttribute('aria-label', 'Kridiya Travel');
  brand.classList.add('footer-identity-main');
  const quickActions = document.createElement('nav');
  quickActions.className = 'footer-quick-actions';
  quickActions.setAttribute('aria-label', 'Contact and account');
  const whatsapp = link('WhatsApp', waLink(), { external: true });
  whatsapp.className = 'footer-quick-action footer-quick-action-primary';
  whatsapp.innerHTML = icon('whatsapp') + '<span class="footer-quick-action-copy"><small>WhatsApp</small><strong>Send your route</strong></span>';
  const call = link('Call us', 'tel:' + KRIDIYA.phoneTel);
  call.className = 'footer-quick-action';
  call.innerHTML = icon('phone') + '<span class="footer-quick-action-copy"><small>Call</small><strong dir="ltr">' + KRIDIYA.phoneDisplay + '</strong></span>';
  const email = link('Email us', 'mailto:' + KRIDIYA.emails.contact);
  email.className = 'footer-quick-action';
  email.innerHTML = icon('mail') + '<span class="footer-quick-action-copy"><small>Email</small><strong dir="ltr">' + KRIDIYA.emails.contact + '</strong></span>';
  const account = link('My Kridiya', 'login.html');
  account.className = 'footer-quick-action';
  account.innerHTML = '<span class="footer-quick-action-copy"><small>Account</small><strong>My Kridiya</strong></span>';
  quickActions.append(whatsapp, call, email, account);
  identityStrip.append(brand, quickActions);

  const routeLinks = [...footer.querySelectorAll('.footer-routes a')];
  const selectedRoutes = [0, 1, 3, 8].map(function (index) { return routeLinks[index]; }).filter(Boolean);
  grid.classList.add('footer-directory');
  grid.replaceChildren(
    directoryGroup('Book travel', [
      { title: 'Leisure', links: [
        ['Flight Booking', 'flights.html'], ['Hotel Booking', 'hotels.html'],
        ['Holiday Packages', 'holidays.html'], ['Cruise Packages', 'cruise.html'],
        ['Umrah Packages', 'umrah.html'], ['Visa Services', 'visa.html'],
        ['Travel Insurance', 'contact.html?topic=Travel%20insurance'],
      ] },
      { title: 'For companies', links: [
        ['Business Travel', 'https://corporate.kridiyatravel.com', { external: true }],
        ['Corporate Portal', 'https://corporate.kridiyatravel.com/login.html?next=corporate-account.html', { external: true }],
      ] },
    ], 'book'),
    directoryGroup('Manage your trip', [
      { title: 'Your account', links: [
        ['Customer Login', 'login.html'], ['Create Account', 'register.html'],
        ['My bookings', 'account.html#bookings'],
      ] },
      { title: 'Booking help', links: [
        ['Track Enquiry', 'track-enquiry.html'], ['Travel support', 'account.html#support'],
      ] },
    ], 'manage'),
    directoryGroup('Plan and explore', [
      { title: 'Travel planning', links: [
        ['Travel Guides', 'guides/'], ['Contact an adviser', 'contact.html'],
      ] },
      { title: 'Popular routes', links: selectedRoutes },
    ], 'plan'),
    directoryGroup('Kridiya', [
      { title: 'Company', links: [
        ['About Us', 'about.html'], ['Contact Us', 'contact.html'],
      ] },
      { title: 'Policies', links: [
        ['Privacy Policy', 'privacy.html'], ['Terms & Conditions', 'terms.html'],
        ['Unsubscribe from offers', 'unsubscribe.html'],
      ] },
    ], 'company')
  );

  const updates = document.createElement('section');
  updates.className = 'footer-updates';
  updates.setAttribute('aria-labelledby', 'footer-updates-title');
  const title = connect.querySelector('h4:last-of-type');
  title.id = 'footer-updates-title';
  const updatesCopy = document.createElement('div');
  updatesCopy.className = 'footer-updates-copy';
  const updatesDescription = document.createElement('p');
  updatesDescription.textContent = 'Optional fare alerts and travel ideas. Unsubscribe whenever you like.';
  updatesCopy.append(title, updatesDescription);
  updates.append(updatesCopy, newsletter);

  function disclosure(title, content) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary, content);
    return details;
  }
  const legal = footer.querySelector('.footer-legal');
  const identitySelector = KRIDIYA_LOCALE.language === 'ar' ? '.footer-identity-ar' : '.footer-identity-en';
  const identityContent = legal.querySelector(identitySelector);
  legal.querySelectorAll('.footer-identity-en, .footer-identity-ar').forEach(function (item) {
    if (item !== identityContent) item.remove();
  });
  const identity = disclosure('Company details', identityContent);
  identity.className = 'footer-company-details';
  legal.append(identity);

  container.replaceChildren(identityStrip, grid, updates);
  const mobileDirectory = window.matchMedia('(max-width: 720px)');
  function syncDirectoryDisclosure() {
    grid.querySelectorAll('.footer-directory-group').forEach(function (details) {
      details.open = !mobileDirectory.matches;
    });
  }
  syncDirectoryDisclosure();
  mobileDirectory.addEventListener('change', syncDirectoryDisclosure);
}

const NAV_ITEMS = [
  ["index.html", "Home"],
  ["flights.html", "Flights"],
  ["hotels.html", "Hotels"],
  ["holidays.html", "Holidays"],
  ["umrah.html", "Umrah"],
  ["cruise.html", "Cruise"],
  ["visa.html", "Visa"],
  ["https://corporate.kridiyatravel.com", "Business"],
  ["about.html", "About"],
  ["contact.html", "Contact"]
];

function currentPage() {
  const p = location.pathname.split("/").pop();
  return p === "" ? "index.html" : p;
}

function consumerLoginHref() {
  const path = location.pathname.replace(/^\/+/, "") || "index.html";
  if (["login.html", "register.html", "forgot-password.html", "reset-password.html"].includes(path)) return "login.html";
  return "login.html?next=" + encodeURIComponent(path + location.search + location.hash);
}

function renderMobilePrimaryNavigation(page) {
  if (!document.body.classList.contains("consumer-site") || page === "account.html") return;
  const tripPages = ["track-enquiry.html", "thanks.html"];
  const accountPages = ["login.html", "register.html", "forgot-password.html", "reset-password.html"];
  const session = window.KridiyaAuth ? KridiyaAuth.session() : null;
  const items = [
    ["index.html", "Home", "home", !tripPages.includes(page) && page !== "contact.html" && !accountPages.includes(page)],
    ["account.html#bookings", "Bookings", "suitcase", tripPages.includes(page)],
    ["contact.html", "Help", "help", page === "contact.html"],
    [session ? "account.html#account-menu" : consumerLoginHref(), "My Kridiya", "account", accountPages.includes(page)]
  ];
  const navigation = document.createElement("nav");
  navigation.className = "mobile-primary-nav";
  navigation.setAttribute("aria-label", "Mobile navigation");
  navigation.innerHTML = items.map(function (item) {
    return '<a href="' + item[0] + '"' + (item[3] ? ' aria-current="page"' : '') + '>' +
      icon(item[2]) + '<span>' + item[1] + '</span></a>';
  }).join("");
  document.body.append(navigation);
  document.body.classList.add("mobile-primary-navigation-ready");
}

function updateConsumerAuthChrome(user) {
  if (!document.body.classList.contains("consumer-site")) return;
  const signedIn = Boolean(user);
  const account = document.getElementById("account-btn");
  if (account) {
    account.textContent = KRIDIYA_LOCALE.text(signedIn ? "My Kridiya" : "Sign in");
    account.href = signedIn ? "account.html#account-menu" : consumerLoginHref();
  }
  const mobileAccount = document.querySelector('.mobile-primary-nav a:last-child');
  if (mobileAccount) mobileAccount.href = signedIn ? "account.html#account-menu" : consumerLoginHref();
}

document.addEventListener("kridiya:auth-state", function (event) {
  updateConsumerAuthChrome(event.detail && event.detail.user);
});

function initConsumerHeaderMorph(header) {
  if (!header || !document.body.classList.contains("consumer-site")) return;

  // Phones keep the stable compact header. Larger viewports start with the
  // navigation integrated into the page, then condense it after the user has
  // clearly started scrolling.
  const supportsMorph = window.matchMedia("(min-width: 721px)");
  let animationFrame = 0;
  let floating = false;

  function updateHeaderState() {
    animationFrame = 0;
    floating = supportsMorph.matches && window.scrollY > (floating ? 2 : 4);
    header.classList.toggle("is-floating", floating);
    header.dataset.scrollState = floating ? "floating" : "top";
  }

  function queueHeaderUpdate() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateHeaderState);
  }

  updateHeaderState();
  window.addEventListener("scroll", queueHeaderUpdate, { passive: true });
  supportsMorph.addEventListener("change", updateHeaderState);
}

function renderChrome() {
  const page = currentPage();
  const consumerHeader = document.body.classList.contains("consumer-site");
  const homeServices = [
    ["flights.html", "Flights", "plane"], ["hotels.html", "Hotels", "hotel"],
    ["holidays.html", "Holidays", "suitcase"], ["visa.html", "Visa", "passport"],
    ["umrah.html", "Umrah", "kaaba"], ["cruise.html", "Cruise", "ship"]
  ];
  const header = document.getElementById("site-header");
  if (header) {
    const session = window.KridiyaAuth ? KridiyaAuth.session() : null;
    const accountHref = session ? "account.html#account-menu" : (consumerHeader ? consumerLoginHref() : "login.html");
    const accountLabel = session ? "My Kridiya" : "Sign in";
    header.innerHTML =
      '<div class="container header-inner">' +
        logoHTML(false) +
        '<button class="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="main-nav">' + icon("menu") + "</button>" +
        '<nav class="main-nav" id="main-nav" aria-label="Main navigation"><button class="nav-close btn btn-outline" type="button">Close menu</button><ul>' +
          (consumerHeader ? homeServices : NAV_ITEMS).map(function (it) {
            const cur = it[0] === page ? ' aria-current="page"' : "";
            return '<li><a href="' + it[0] + '"' + cur + ">" + (consumerHeader ? icon(it[2]) + '<span>' + it[1] + '</span>' : it[1]) + "</a></li>";
          }).join("") +
          (consumerHeader ? '<li class="home-mobile-nav-link"><a href="https://corporate.kridiyatravel.com">Corporate Travel</a></li><li class="home-mobile-nav-link"><a href="track-enquiry.html">Track enquiry</a></li><li class="home-mobile-nav-link"><a href="about.html">About Kridiya</a></li>' : "") +
        "</ul></nav>" +
        '<div class="header-actions">' +
          (KRIDIYA_LOCALE.canChooseArabic
            ? '<button class="site-language-switch" type="button" translate="no" data-site-language-switch="' + (KRIDIYA_LOCALE.language === "ar" ? "en" : "ar") + '">' + (KRIDIYA_LOCALE.language === "ar" ? "English" : "العربية") + '</button>'
            : '') +
          (consumerHeader ? '<a class="home-corporate-link" href="https://corporate.kridiyatravel.com">Corporate Travel</a><a class="home-help-link" href="contact.html">Help</a>' : '') +
          '<a class="header-call" href="tel:' + KRIDIYA.phoneTel + '" aria-label="Call Kridiya Travel at ' + KRIDIYA.phoneDisplay + '">' + icon("phone") + "<span>" + KRIDIYA.phoneDisplay + "</span></a>" +
          '<a class="btn btn-primary" href="' + accountHref + '" id="account-btn">' + (consumerHeader ? accountLabel : "Login") + '</a>' +
        "</div>" +
      "</div>" +
      '<button class="nav-backdrop" aria-hidden="true" tabindex="-1"></button>';

    const nav = header.querySelector(".main-nav");
    const toggle = header.querySelector(".nav-toggle");
    const backdrop = header.querySelector(".nav-backdrop");
    const mobileNav = window.matchMedia("(max-width: 1270px)");
    const closeButton = nav.querySelector(".nav-close");
    let background = [], previousOverflow = "";
    function setNav(open) {
      open = open && mobileNav.matches;
      const wasOpen = nav.classList.contains("open");
      if (!open && wasOpen) {
        background.forEach(([element, inert]) => { element.inert = inert; });
        background = [];
        document.body.style.overflow = previousOverflow;
        if (mobileNav.matches) toggle.focus();
        else if (document.activeElement === closeButton) nav.querySelector('a').focus();
      }
      nav.classList.toggle("open", open);
      nav.inert = mobileNav.matches && !open;
      backdrop.classList.toggle("show", open);
      toggle.setAttribute("aria-expanded", String(open));
      // Render only the icon for the current state. Keeping both SVGs in the
      // button made the menu and close marks appear together when motion styles
      // were unavailable or still loading.
      toggle.innerHTML = icon(open ? "close" : "menu");
      toggle.setAttribute("aria-label", KRIDIYA_LOCALE.text(open ? "Close menu" : "Open menu"));
      if (open && !wasOpen) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        // Make every branch outside the drawer inert, preserving its previous state.
        let branch = nav;
        while (branch.parentElement && branch !== document.body) {
          [...branch.parentElement.children].forEach(element => {
            if (element !== branch && element !== backdrop) {
              background.push([element, element.inert]); element.inert = true;
            }
          });
          branch = branch.parentElement;
        }
        closeButton.focus();
      }
    }
    setNav(false);
    mobileNav.addEventListener("change", function () { setNav(false); });
    closeButton.addEventListener("click", function () { setNav(false); });
    toggle.addEventListener("click", function () { setNav(!nav.classList.contains("open")); });
    backdrop.addEventListener("click", function () { setNav(false); });
    document.addEventListener("keydown", function (e) {
      if (!nav.classList.contains("open")) return;
      if (e.key === "Escape") { e.preventDefault(); setNav(false); }
      if (e.key === "Tab") {
        const items = [...nav.querySelectorAll('a[href], button:not(:disabled)')];
        const index = items.indexOf(document.activeElement);
        const next = (index + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        e.preventDefault(); items[next].focus();
      }
    });

    updateConsumerAuthChrome(session);

    initConsumerHeaderMorph(header);
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML =
      '<div class="container footer-main">' +
        '<nav class="footer-grid" aria-label="Footer">' +
          '<details class="footer-column" open><summary>Kridiya</summary><ul class="footer-links">' +
            '<li><a href="about.html">About Us</a></li>' +
            '<li><a href="guides/">Travel Guides</a></li>' +
            '<li><a href="sitemap.html">Site map</a></li>' +
            '<li><a href="contact.html">Contact Us</a></li>' +
          '</ul></details>' +
          '<details class="footer-column" open><summary>Book travel</summary><ul class="footer-links">' +
            '<li><a href="flights.html">Flight Booking</a></li>' +
            '<li><a href="hotels.html">Hotel Booking</a></li>' +
            '<li><a href="holidays.html">Holiday Packages</a></li>' +
            '<li><a href="cruise.html">Cruise Packages</a></li>' +
            '<li><a href="umrah.html">Umrah Packages</a></li>' +
            '<li><a href="visa.html">Visa Services</a></li>' +
          '</ul></details>' +
          '<details class="footer-column" open><summary>Manage your trip</summary><ul class="footer-links">' +
            '<li><a href="login.html?next=account.html%23bookings">My bookings</a></li>' +
            '<li><a href="login.html?next=account.html%23travellers">Saved travellers</a></li>' +
            '<li><a href="login.html?next=account.html%23payments">Payments &amp; refunds</a></li>' +
            '<li><a href="track-enquiry.html">Track Enquiry</a></li>' +
            '<li><a href="login.html">Customer Login</a></li>' +
            '<li><a href="register.html">Create Account</a></li>' +
          '</ul></details>' +
          '<details class="footer-column" open><summary>Support &amp; Legal</summary><ul class="footer-links">' +
            '<li><a href="contact.html">Help &amp; contact</a></li>' +
            '<li><a href="contact.html?topic=Travel%20insurance">Travel Insurance</a></li>' +
            '<li><a href="privacy.html">Privacy Policy</a></li>' +
            '<li><button class="footer-privacy-choice" type="button" data-reset-measurement-consent>Privacy choices</button></li>' +
            '<li><a href="unsubscribe.html">Unsubscribe from offers</a></li>' +
            '<li><a href="terms.html">Terms &amp; Conditions</a></li>' +
          '</ul></details>' +
          '<details class="footer-column" open><summary>Business</summary><ul class="footer-links">' +
            '<li><a href="https://corporate.kridiyatravel.com">Business Travel</a></li>' +
            '<li><a href="https://corporate.kridiyatravel.com/login.html?next=corporate-account.html">Corporate Portal</a></li>' +
          '</ul></details>' +
          '<details class="footer-column footer-connect" open><summary>Contact</summary><ul class="footer-contact">' +
            '<li>' + icon("phone") + '<a href="tel:' + KRIDIYA.phoneTel + '">' + KRIDIYA.phoneDisplay + '</a></li>' +
            '<li>' + icon("mail") + '<a href="mailto:' + KRIDIYA.emails.contact + '">' + KRIDIYA.emails.contact + '</a></li>' +
            '<li>' + icon("whatsapp") + '<a href="' + waLink() + '" target="_blank" rel="noopener">WhatsApp us</a></li>' +
          '</ul></details>' +
        '</nav>' +
        '<div class="footer-brand-row">' +
          '<div class="footer-brand-summary">' + logoHTML(true) + '<p>Kridiya Travel and Tourism is a UAE travel desk for flights, hotels, holidays, visas, Umrah and cruises. Send your dates and traveller details, and our team will return available options with prices and conditions.</p></div>' +
          '<details class="footer-newsletter" open><summary>Travel updates by email</summary>' +
            '<form class="newsletter-form" id="newsletter-form" method="POST" action="https://formsubmit.co/' + KRIDIYA.emails.deals + '">' +
              '<input type="hidden" name="_subject" value="Newsletter subscription — kridiyatravel.com">' +
              '<input type="hidden" name="_captcha" value="false">' +
              '<input type="hidden" name="_template" value="table">' +
              '<div class="newsletter-row"><input type="email" name="email" placeholder="Email address" required aria-label="Email address for travel updates">' +
              '<button class="btn btn-primary" type="submit">Subscribe</button></div>' +
              '<label class="newsletter-consent"><input type="checkbox" name="Marketing_consent" value="Yes" required>' +
              '<span>I agree to receive travel offers by email. I can unsubscribe at any time. <a href="privacy.html">Privacy policy</a>.</span></label>' +
              '<p class="newsletter-status" aria-live="polite"></p>' +
            '</form>' +
          '</details>' +
        '</div>' +
      '</div>' +
      '<div class="footer-bar"><div class="container footer-bottom">' +
        '<span class="footer-copyright">© ' + new Date().getFullYear() + ' ' + KRIDIYA.legal + '. All rights reserved.</span>' +
        '<div class="footer-social">' +
          '<a class="icon-instagram" href="' + KRIDIYA.social.instagram + '" target="_blank" rel="noopener" aria-label="Instagram">' + icon("instagram") + '</a>' +
          '<a class="icon-facebook" href="' + KRIDIYA.social.facebook + '" target="_blank" rel="noopener" aria-label="Facebook">' + icon("facebook") + '</a>' +
          '<a class="icon-linkedin" href="' + KRIDIYA.social.linkedin + '" target="_blank" rel="noopener" aria-label="LinkedIn">' + icon("linkedin") + '</a>' +
          '<a class="icon-whatsapp" href="' + waLink() + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + icon("whatsapp") + '</a>' +
        '</div>' +
        '<details class="footer-company-details"><summary>Company details</summary><div class="footer-company-body">' +
          '<span class="footer-identity-en" translate="no"><strong>Company details:</strong> KRIDIYA Travel and Tourism FZ-LLC is a free-zone limited-liability company registered with Ras Al Khaimah Economic Zone (RAKEZ), United Arab Emirates, trade licence 5033347. Registered address: FDRK7105, Compass Building, Al Shohada Road, Al Hamra Industrial Zone-FZ, Ras Al Khaimah, United Arab Emirates. Email: <a href="mailto:contact@kridiyatravel.com">contact@kridiyatravel.com</a>. WhatsApp: <a href="https://wa.me/971509413873" target="_blank" rel="noopener">+971 50 941 3873</a>. Website: <a href="https://www.kridiyatravel.com">www.kridiyatravel.com</a>.</span>' +
          '<span class="footer-identity-ar" lang="ar" dir="rtl" translate="no"><strong>هوية التاجر / المتحكم:</strong> الاسم القانوني: KRIDIYA Travel and Tourism FZ-LLC (كريديا للسفر). الشكل القانوني: شركة منطقة حرة ذات مسؤولية محدودة (FZ-LLC). مكان التسجيل: هيئة مناطق رأس الخيمة الاقتصادية (RAKEZ)، رأس الخيمة، الإمارات العربية المتحدة. رقم الرخصة التجارية: 5033347. العنوان: FDRK7105، مبنى Compass Building، طريق الشهداء (Al Shohada Road)، منطقة الحمرا الصناعية الحرة (Al Hamra Industrial Zone-FZ)، رأس الخيمة، الإمارات العربية المتحدة. البريد الإلكتروني: <a href="mailto:contact@kridiyatravel.com">contact@kridiyatravel.com</a>. واتساب: <a href="https://wa.me/971509413873" target="_blank" rel="noopener">+971 50 941 3873</a>. الموقع: <a href="https://www.kridiyatravel.com">www.kridiyatravel.com</a>.</span>' +
        '</div></details>' +
      '</div></div>';

    prepareFormSubmit(footer.querySelector("#newsletter-form"));
    const phoneFooter = window.matchMedia("(max-width: 560px)");
    const phoneFooterSections = footer.querySelectorAll(".footer-column");
    const phoneNewsletter = footer.querySelector(".footer-newsletter");
    function syncPhoneFooter() {
      phoneFooterSections.forEach(function (section) {
        section.open = true;
        section.querySelector("summary").tabIndex = phoneFooter.matches ? -1 : 0;
      });
      phoneNewsletter.open = !phoneFooter.matches;
    }
    syncPhoneFooter();
    phoneFooter.addEventListener("change", syncPhoneFooter);
  }

  renderMobilePrimaryNavigation(page);

  // Floating WhatsApp
  const wa = document.createElement("a");
  wa.className = "wa-float";
  wa.href = waLink("Hello Kridiya Travel! I have a travel enquiry.");
  wa.target = "_blank";
  wa.rel = "noopener";
  wa.setAttribute("aria-label", "Chat with us on WhatsApp");
  wa.innerHTML = icon("whatsapp") + "<span>WhatsApp</span>";
  document.body.appendChild(wa);
  if (consumerHeader && footer && "IntersectionObserver" in window) {
    const phoneFooter = window.matchMedia("(max-width: 720px)");
    let footerVisible = false;
    function syncFooterContact() {
      const hidden = phoneFooter.matches && footerVisible;
      document.body.classList.toggle("consumer-footer-visible", hidden);
      if (hidden) {
        wa.setAttribute("aria-hidden", "true");
        wa.tabIndex = -1;
      } else {
        wa.removeAttribute("aria-hidden");
        wa.removeAttribute("tabindex");
      }
    }
    new IntersectionObserver(function (entries) {
      footerVisible = entries.some(function (entry) { return entry.isIntersecting; });
      syncFooterContact();
    }, { rootMargin: "0px 0px -72px 0px" }).observe(footer);
    phoneFooter.addEventListener("change", syncFooterContact);
  }
}

/* ---------- Toast ---------- */
let toastTimer = null, toastRemaining = 0, toastStarted = 0;
function scheduleToast() {
  clearTimeout(toastTimer);
  if (document.hidden || !toastRemaining) return;
  toastStarted = Date.now();
  toastTimer = setTimeout(function () {
    document.querySelector(".toast")?.classList.remove("is-open");
    toastRemaining = 0;
  }, toastRemaining);
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    clearTimeout(toastTimer);
    if (toastStarted) toastRemaining = Math.max(0, toastRemaining - (Date.now() - toastStarted));
    toastStarted = 0;
  } else scheduleToast();
});
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast t-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  void el.offsetWidth;
  el.classList.add("is-open");
  toastRemaining = 4200; toastStarted = 0;
  scheduleToast();
}

/* ---------- Enquiry submission plumbing ----------
   Every form tagged data-enquiry-type is saved to Supabase first. Only
   after that succeeds do we send the same enquiry to FormSubmit as a
   best-effort email confirmation and hand the reference to thanks.html.
   The footer newsletter form has no data-enquiry-type. */
const SERVICE_TYPE_RULES = [
  [/flight/i, "flight"],
  [/hotel/i, "hotel"],
  [/holiday/i, "holiday"],
  [/visa/i, "visa"],
  [/umrah/i, "umrah"],
  [/cruise/i, "cruise"]
];
const SERVICE_PREFIX = { flight: "FLT", hotel: "HTL", holiday: "HOL", visa: "VSA", umrah: "UMR", cruise: "CRU", other: "ENQ" };

function serviceTypeFromLabel(label) {
  const hit = SERVICE_TYPE_RULES.find(function (r) { return r[0].test(label || ""); });
  return hit ? hit[1] : "other";
}

function generateReference(serviceType) {
  const prefix = SERVICE_PREFIX[serviceType] || "ENQ";
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return "KD-" + prefix + "-" + stamp + rand;
}

function generateSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20);
}

function gatherEnquiryFields(form) {
  const data = new FormData(form);
  const details = {};
  const parts = [];
  data.forEach(function (v, k) {
    if (typeof File !== "undefined" && v instanceof File) return;
    if (k.charAt(0) === "_" || k === "Name" || k === "Email" || k === "Phone") return;
    const val = String(v).trim();
    if (!val) return;
    details[k] = val;
    parts.push(k.replace(/_/g, " ") + ": " + val);
  });
  return {
    fullName: String(data.get("Name") || "").trim(),
    email: String(data.get("Email") || "").trim(),
    phone: String(data.get("Phone") || "").trim(),
    marketingConsent: data.get("Marketing_consent") === "Yes",
    details: details,
    summary: parts.join(" · ")
  };
}

async function submitEnquiryToSupabase(fields, serviceType, reference, submissionId) {
  const sb = await KridiyaAuth.client();
  const session = KridiyaAuth.session();
  const attribution = attributionPayload();
  const result = await sb.rpc("submit_public_enquiry", {
    p_reference: reference,
    p_submission_id: submissionId,
    p_service_type: serviceType,
    p_full_name: fields.fullName,
    p_email: fields.email,
    p_phone: fields.phone || null,
    p_summary: fields.summary || "Enquiry",
    p_details: fields.details,
    p_marketing_consent: fields.marketingConsent,
    p_attribution: attribution
  });
  if (result.error) throw result.error;
  const receipt = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!receipt || receipt.reference !== reference || typeof receipt.created !== "boolean") {
    throw new Error("The enquiry service returned an invalid receipt.");
  }
  // The database's enquiries_notify_new trigger creates staff_notifications atomically.
  // Anonymous receipts intentionally omit the private enquiry identifier.
  let enquiryId = receipt.id || null;
  if (session && !enquiryId) {
    const lookup = await sb.from("enquiries").select("id").eq("reference", reference).eq("user_id", session.id).maybeSingle();
    if (!lookup.error && lookup.data) enquiryId = lookup.data.id;
  }
  return { reference: reference, id: enquiryId, created: receipt.created };
}

async function uploadEnquiryAttachments(enquiryId, files) {
  if (!files.length) return;
  if (!enquiryId) throw new Error("Sign in again before uploading private documents.");
  const user = await KridiyaAuth.currentUser(); if (!user) throw new Error("Please sign in again before uploading files.");
  const sb = await KridiyaAuth.client();
  for (const file of files) {
    if (file.size < 1 || file.size > 10485760 || ["application/pdf","image/jpeg","image/png","image/webp"].indexOf(file.type) === -1) throw new Error("Attachments must be PDF, JPG, PNG, or WebP files up to 10 MB.");
    const safe = String(file.name || "attachment").replace(/[^A-Za-z0-9._-]+/g,"-").slice(-120) || "attachment";
    const path = user.id + "/" + enquiryId + "/" + Date.now() + "-" + safe;
    const uploaded = await sb.storage.from("enquiry-uploads").upload(path,file,{upsert:false,contentType:file.type});
    if (uploaded.error) throw uploaded.error;
    const attached = await sb.rpc("attach_my_enquiry_file",{p_enquiry_id:enquiryId,p_storage_path:path,p_file_name:String(file.name||safe).slice(0,180),p_mime_type:file.type,p_size_bytes:file.size});
    if (attached.error) { await sb.storage.from("enquiry-uploads").remove([path]); throw attached.error; }
  }
}

function enquiryAttachmentError(files) {
  const selected = Array.from(files || []);
  if (selected.length > 3) return "Choose no more than 3 supporting documents.";
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  const invalidType = selected.find(function (file) { return allowed.indexOf(file.type) === -1; });
  if (invalidType) return "Attachments must be PDF, JPG, PNG, or WebP files.";
  const invalidSize = selected.find(function (file) { return file.size < 1 || file.size > 10485760; });
  if (invalidSize) return "Each attachment must be between 1 byte and 10 MB.";
  return "";
}

async function submitNewsletterConsent(email, submissionId) {
  const sb = await KridiyaAuth.client();
  const a = attributionPayload();
  const result = await sb.rpc("record_marketing_subscription_consent", {
    p_email: String(email || "").trim().toLowerCase(),
    p_submission_id: submissionId,
    p_consent_version: "privacy-2026-07",
    p_first_touch_source: a.first_touch_source,
    p_first_touch_medium: a.first_touch_medium,
    p_first_touch_campaign: a.first_touch_campaign,
    p_last_touch_source: a.last_touch_source,
    p_last_touch_medium: a.last_touch_medium,
    p_last_touch_campaign: a.last_touch_campaign,
    p_landing_page: a.landing_page,
    p_referrer: a.referrer
  });
  if (result.error) throw result.error;
  if (!result.data || !result.data.decision) throw new Error("Consent persistence was not confirmed");
  return result.data;
}

function newsletterSubmissionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-" + hex.slice(12,16) + "-" + hex.slice(16,20) + "-" + hex.slice(20);
}

function setNewsletterStatus(form, state, message) {
  const status = form.querySelector(".newsletter-status");
  if (!status) return;
  status.className = "newsletter-status " + (state || "");
  status.setAttribute("role", state === "error" ? "alert" : "status");
  status.textContent = message || "";
  if (window.KridiyaMotion && state === "success" && message) KridiyaMotion.success(status);
}

function formSubmitAjaxURL(form) {
  return form.action.replace("https://formsubmit.co/", "https://formsubmit.co/ajax/");
}

async function sendFormSubmitAjax(form, reference) {
  const data = new FormData(form);
  const payload = { Reference: reference };
  data.forEach(function (v, k) { if (!(typeof File !== "undefined" && v instanceof File)) payload[k] = v; });
  const response = await fetch(formSubmitAjaxURL(form), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("FormSubmit returned HTTP " + response.status);
}

function restoreSubmitButton(btn, label) {
  if (!btn) return;
  btn.disabled = false;
  if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, label || "Send enquiry", false);
  else btn.textContent = label || "Send enquiry";
}

function stashEnquiryForThanksPage(reference, serviceType, summary, typeLabel, name) {
  try {
    sessionStorage.setItem("kridiya_last_enquiry", JSON.stringify({
      reference: reference,
      serviceType: serviceType,
      typeLabel: typeLabel,
      summary: summary,
      name: name,
      at: new Date().toISOString()
    }));
  } catch (e) { /* best-effort */ }
}

function enquiryDraftKey(form) {
  const raw = [location.pathname, form.id || form.dataset.enquiryType || "enquiry"].join(":").toLowerCase();
  return raw.replace(/[^a-z0-9:_-]+/g, "-").slice(0, 80);
}

function enquiryDraftPayload(form) {
  const payload = {};
  Array.from(form.elements).forEach(function (field) {
    if (!field.name || field.disabled || field.type === "file" || field.type === "submit" || field.name.charAt(0) === "_" || /passport|card|cvv|password|otp/i.test(field.name)) return;
    if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;
    const value = String(field.value || "").trim();
    if (value) payload[field.name] = value;
  });
  return payload;
}

function applyEnquiryDraft(form, payload) {
  Object.keys(payload || {}).forEach(function (name) {
    const fields = form.querySelectorAll('[name="' + CSS.escape(name) + '"]');
    fields.forEach(function (field) {
      if (field.type === "checkbox" || field.type === "radio") field.checked = field.value === String(payload[name]);
      else if (field.type !== "file" && field.type !== "hidden") field.value = String(payload[name]);
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function initEnquiryDraft(form, serviceType) {
  const key = enquiryDraftKey(form), guestKey = "kridiya_enquiry_draft:" + key;
  let timer = null, status = document.createElement("p");
  status.className = "form-note enquiry-draft-status"; status.setAttribute("aria-live", "polite");
  const submit = form.querySelector('button[type="submit"]'); if (submit) submit.insertAdjacentElement("beforebegin", status);
  function show(text) { if (window.KridiyaMotion && KridiyaMotion.text) KridiyaMotion.text(status, text); else status.textContent = text; }
  function save() {
    const payload = enquiryDraftPayload(form); if (!Object.keys(payload).length) return;
    const cached = KridiyaAuth.session();
    if (cached) KridiyaAuth.saveMyEnquiryDraft(key, serviceType, payload).then(function () { show("Draft saved securely."); }).catch(function () { try { sessionStorage.setItem(guestKey, JSON.stringify(payload)); show("Draft saved in this browser tab."); } catch (e) {} });
    else try { sessionStorage.setItem(guestKey, JSON.stringify(payload)); show("Draft saved in this browser tab."); } catch (e) {}
  }
  form.addEventListener("input", function () { clearTimeout(timer); show("Saving draft..."); timer = setTimeout(save, 900); });
  const cached = KridiyaAuth.session();
  const local = function () { try { const payload = JSON.parse(sessionStorage.getItem(guestKey) || "null"); if (payload) { applyEnquiryDraft(form, payload); show("Draft restored from this browser tab."); } } catch (e) {} };
  if (cached) KridiyaAuth.getMyEnquiryDraft(key).then(function (draft) { if (draft && draft.payload) { applyEnquiryDraft(form, draft.payload); show("Your saved draft was restored."); } else local(); }).catch(local); else local();
  return function clearDraft() { clearTimeout(timer); try { sessionStorage.removeItem(guestKey); } catch (e) {} if (KridiyaAuth.session()) KridiyaAuth.deleteMyEnquiryDraft(key).catch(function () {}); };
}

function prepareFormSubmit(form) {
  if (!form) return;
  if (form.dataset.kridiyaPrepared === "true") return;
  form.dataset.kridiyaPrepared = "true";
  if (form.dataset.enquiryType && !form.querySelector('input[name="Marketing_consent"]')) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.insertAdjacentHTML("beforebegin",
        '<label class="form-consent"><input type="checkbox" name="Marketing_consent" value="Yes">' +
        '<span>Send me optional offers and travel ideas by email.<span class="arabic-copy" lang="ar" dir="rtl">أرسلوا إليّ عروضًا وأفكار سفر اختيارية عبر البريد الإلكتروني.</span></span></label>');
    }
  }
  if (form.dataset.enquiryType && !form.querySelector('.enquiry-data-note')) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      const note = document.createElement('p');
      note.className = 'form-note enquiry-data-note';
      note.innerHTML = 'By sending this enquiry, you ask us to use your details to reply and prepare a quote. This is not a booking. See our <a href="privacy.html">Privacy Policy</a> and <a href="terms.html">Terms and Conditions</a>. Do not include passport copies, card details or ID numbers.<span class="arabic-copy" lang="ar" dir="rtl">بإرسال هذا الاستفسار، فإنك تطلب منا استخدام بياناتك للرد عليك وإعداد عرض سعر. هذا الاستفسار ليس حجزًا. راجع <a href="privacy.html#arabic">سياسة الخصوصية</a> و<a href="terms.html#arabic">الشروط والأحكام</a>. لا تُرسل نسخ جوازات السفر أو بيانات البطاقات أو أرقام الهوية.</span>';
      submitButton.insertAdjacentElement('beforebegin', note);
    }
  }
  let next = form.querySelector('input[name="_next"]');
  if (!next) {
    next = document.createElement("input");
    next.type = "hidden";
    next.name = "_next";
    form.appendChild(next);
  }
  next.value = new URL("thanks.html", location.href).href;
  const draftClear = form.dataset.enquiryType ? initEnquiryDraft(form, serviceTypeFromLabel(form.dataset.enquiryType)) : function () {};

  let started = false;
  form.addEventListener("focusin", function () {
    if (started) return;
    started = true;
    trackEvent("start_enquiry", { enquiry_type: form.dataset.enquiryType || "newsletter" });
  });
  if (!form.dataset.enquiryType) {
    form.addEventListener("input", function () { delete form.dataset.newsletterSubmissionId; });
  } else {
    const resetEnquiryAction = function () {
      delete form.dataset.enquirySubmissionId;
      delete form.dataset.enquiryReference;
    };
    form.addEventListener("input", resetEnquiryAction);
    form.addEventListener("change", resetEnquiryAction);
  }

  form.addEventListener("submit", function (e) {
    if (!validateForm(form)) { e.preventDefault(); return; }

    const attachmentInput = form.querySelector('[name="Enquiry_attachments"]');
    const attachmentProblem = attachmentInput ? enquiryAttachmentError(attachmentInput.files) : "";
    if (attachmentProblem) {
      e.preventDefault();
      setFieldError(attachmentInput, attachmentProblem);
      attachmentInput.focus();
      return;
    }

    const type = form.dataset.enquiryType;
    if (!type) {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const newsletterButton = form.querySelector('button[type="submit"]');
      const newsletterLabel = newsletterButton ? (newsletterButton.dataset.motionIdleLabel || newsletterButton.textContent) : "Join";
      const newsletterActionId = form.dataset.newsletterSubmissionId || newsletterSubmissionId();
      form.dataset.newsletterSubmissionId = newsletterActionId;
      if (newsletterButton) {
        newsletterButton.disabled = true;
        if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(newsletterButton, "Joining…", true);
        else newsletterButton.textContent = "Joining…";
      }
      setNewsletterStatus(form, "loading", "Saving your subscription…");
      import("./newsletter-consent.mjs").then(function (newsletter) {
        return newsletter.submitNewsletterSubscription({
          persistConsent: function () {
            return submitNewsletterConsent(emailInput.value.trim(), newsletterActionId);
          },
          sendNotification: function () { return sendFormSubmitAjax(form, "NEWSLETTER"); }
        });
      }).then(function (result) {
        restoreSubmitButton(newsletterButton, newsletterLabel);
        if (!result.ok) {
          setNewsletterStatus(form, "error", result.message);
          toast(result.message);
          emailInput.focus();
          return;
        }
        trackEvent("newsletter_signup", { method: "website_footer", status: result.status });
        delete form.dataset.newsletterSubmissionId;
        form.reset();
        setNewsletterStatus(form, result.notificationSent ? "success" : "warning", result.message);
        toast(result.message);
      }).catch(function (error) {
        console.error("Kridiya: newsletter submission failed", error);
        restoreSubmitButton(newsletterButton, newsletterLabel);
        const message = "We couldn't save your subscription. Your email was not added. Please try again.";
        setNewsletterStatus(form, "error", message);
        toast(message);
        emailInput.focus();
      });
      return;
    }

    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalButtonLabel = btn ? (btn.dataset.motionIdleLabel || btn.textContent) : "";
    if (btn) {
      btn.disabled = true;
      if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, "Sending…", true);
      else btn.textContent = "Sending…";
    }

    const serviceType = serviceTypeFromLabel(type);
    const submissionId = form.dataset.enquirySubmissionId || generateSubmissionId();
    const reference = form.dataset.enquiryReference || generateReference(serviceType);
    form.dataset.enquirySubmissionId = submissionId;
    form.dataset.enquiryReference = reference;
    const fields = gatherEnquiryFields(form);
    const attachmentFiles = attachmentInput ? Array.from(attachmentInput.files || []) : [];
    const dest = next.value;

    submitEnquiryToSupabase(fields, serviceType, reference, submissionId).then(async function (saved) {
      if (attachmentFiles.length) {
        try { await uploadEnquiryAttachments(saved.id, attachmentFiles); }
        catch (error) { console.error("Kridiya: enquiry saved but attachment upload failed", error); try { sessionStorage.setItem("kridiya_attachment_warning", "Your enquiry was saved, but one or more attachments could not be uploaded. Please send them through your account support request or WhatsApp."); } catch (e) {} }
      }
      if (saved.created) {
        try {
          await sendFormSubmitAjax(form, reference);
        } catch (error) {
          // Supabase is the source of truth; email delivery must never determine CRM success.
          console.error("Kridiya: enquiry was saved, but the confirmation email could not be sent", error);
        }
      }

      const metaEventId = generateMetaEventId("lead");
      trackEvent("submit_enquiry", {
        enquiry_type: type,
        service_type: serviceType,
        reference: reference,
        saved_to_crm: true
      }, { eventId: metaEventId });
      try {
        await sendMetaLeadServerEvent(metaEventId, serviceType, type);
      } catch (error) {
        console.warn("Kridiya: server-side Meta lead measurement was unavailable.", error);
      }
      stashEnquiryForThanksPage(reference, serviceType, fields.summary, type, fields.fullName);
      delete form.dataset.enquirySubmissionId;
      delete form.dataset.enquiryReference;
      draftClear();
      location.href = dest;
    }).catch(function (error) {
      console.error("Kridiya: could not save enquiry to Supabase", error);
      restoreSubmitButton(btn, originalButtonLabel);
      toast("We could not save this enquiry. Please try again or WhatsApp us on +971 50 941 3873.");
    });
  });
}

/* ---------- Validation ---------- */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_PHONE = /^\+?[0-9\s\-()]{7,17}$/;

function setFieldError(input, msg) {
  const field = input.closest(".field, .form-consent, .newsletter-consent");
  if (!field) return;
  let err = field.querySelector(".err");
  if (!err) {
    err = document.createElement("span");
    err.className = "err";
    field.appendChild(err);
  }
  if (msg) {
    field.classList.add("invalid");
    err.textContent = msg;
  } else {
    field.classList.remove("invalid");
    if (!(window.KridiyaMotion && KridiyaMotion.error)) err.textContent = "";
  }
  if (window.KridiyaMotion && KridiyaMotion.error) KridiyaMotion.error(input, field, err, msg);
}

function validateForm(form) {
  let ok = true, first = null;
  form.querySelectorAll("input[required], select[required], textarea[required]").forEach(function (input) {
    if (input.type === "hidden") return;
    let msg = "";
    const v = input.value.trim();
    if (input.type === "checkbox" && !input.checked) msg = "Please confirm this choice.";
    else if (!v) msg = "This field is required.";
    else if (input.type === "email" && !RE_EMAIL.test(v)) msg = "Enter a valid email address.";
    else if (input.type === "tel" && !RE_PHONE.test(v)) msg = "Enter a valid phone number (e.g. +971 50 941 3873).";
    setFieldError(input, msg);
    if (msg) { ok = false; if (!first) first = input; }
  });
  if (first) first.focus();
  return ok;
}

/* Clear errors as the user types */
document.addEventListener("input", function (e) {
  if (e.target.matches(".field input, .field select, .field textarea")) setFieldError(e.target, "");
});

/* ---------- Reveal-on-scroll (enhance-only; content visible without JS) ---------- */
function initReveal() {
  if (window.KridiyaMotion) { window.KridiyaMotion.reveal(); return; }
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    return;
  }
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
}

/* ---------- Date helpers ----------
   Always format dates from local Y/M/D, never toISOString() — that
   converts to UTC first and silently rolls the date back or forward
   a day depending on the visitor's timezone offset. */
function localISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return localISO(d);
}
function initDateMins() {
  document.querySelectorAll('input[type="date"][data-min-today]').forEach(function (el) {
    el.min = todayISO(0);
    if (!el.value && el.dataset.defaultOffset) el.value = todayISO(parseInt(el.dataset.defaultOffset, 10));
  });
}

function initAccessibilityLandmarks() {
  const main = document.querySelector("main");
  if (!main) return;
  if (!main.id) main.id = "main-content";
  if (!document.querySelector(".skip-link, .home-skip")) {
    const link = document.createElement("a");
    link.className = "skip-link";
    link.href = "#" + main.id;
    link.textContent = "Skip to main content";
    document.body.insertBefore(link, document.body.firstChild);
  }
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", function () {
  KRIDIYA_LOCALE.ready.then(function () {
  document.body.dataset.siteRegion = KRIDIYA_LOCALE.region;
  document.body.dataset.siteLanguage = KRIDIYA_LOCALE.language;
  // Keep editorial image slots usable if their remote host is unavailable.
  document.querySelectorAll('img[src^="https://images.unsplash.com"]').forEach(function (img) {
    function fallback() {
      if (img.dataset.fallback) return;
      img.dataset.fallback = "true";
      img.src = new URL("assets/illustrations-v2/spots/svg/destination-pin.svg", document.baseURI).href;
      img.alt = "Travel destination illustration";
      img.classList.add("editorial-fallback");
    }
    img.addEventListener("error", fallback);
    if (img.complete && !img.naturalWidth) fallback();
  });
  initAccessibilityLandmarks();
  renderChrome();
  document.dispatchEvent(new CustomEvent("kridiya:chrome-ready"));
  initAnalyticsConsentBanner();
  initDateMins();
  document.querySelectorAll("form[data-formsubmit]").forEach(prepareFormSubmit);
  initReveal();
  trackEvent("view_service", {
    service_type: document.body.dataset.widgetOnly || document.body.dataset.page || "general"
  });
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (window.KRIDIYA_LOCALE_BOOT) window.KRIDIYA_LOCALE_BOOT.release();
    });
  });
  });
});

document.addEventListener("click", function (e) {
  const languageSwitch = e.target.closest("[data-site-language-switch]");
  if (languageSwitch) {
    KRIDIYA_LOCALE.setLanguage(languageSwitch.dataset.siteLanguageSwitch);
    return;
  }
  const resetConsent = e.target.closest("[data-reset-measurement-consent]");
  if (resetConsent) {
    resetMeasurementConsent();
    return;
  }
  const link = e.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (/(?:wa\.me|whatsapp\.com)/i.test(href)) trackEvent("click_whatsapp", { link_location: link.className || "content" });
  else if (/^tel:/i.test(href)) trackEvent("click_call", { link_location: link.className || "content" });
  else if (/^mailto:/i.test(href)) trackEvent("click_email", { link_location: link.className || "content" });
});
