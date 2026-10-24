/* ============================================================
   Kridiya Travel - customer accounts
   Supabase Auth + Postgres profiles/bookings.
   Browser-safe config only: never place secret/service_role keys here.
   ============================================================ */
"use strict";

window.KridiyaAuth = (function () {
  const localRuntime = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
    ? (window.KRIDIYA_LOCAL_SUPABASE || {
        url: "http://127.0.0.1:57421",
        publishableKey: "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
        siteUrl: location.origin + "/"
      })
    : {};
  const SUPABASE_URL = localRuntime.url || "https://jmvqqpughlzeqrcyavwz.supabase.co";
  const SUPABASE_KEY = localRuntime.publishableKey || "sb_publishable_wiA9tSt74X-UQhW4yOXgIQ_lEUG1Q1Q";
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4";
  const SESSION_KEY = "kridiya_session";
  const AUTH_RETURN_KEY = "kridiya_auth_return";
  const AUTH_RETURN_SHARED_KEY = AUTH_RETURN_KEY + ":shared";
  const AUTH_RETURN_TTL = 15 * 60 * 1000;
  const PUBLIC_SITE_URL = localRuntime.siteUrl || "https://www.kridiyatravel.com/";
  const PUBLIC_RETURN_PATHS = new Set([
    "index.html", "flights.html", "hotels.html", "holidays.html", "umrah.html", "cruise.html", "visa.html",
    "about.html", "contact.html", "privacy.html", "terms.html", "sitemap.html", "track-enquiry.html", "thanks.html",
    "unsubscribe.html", "account.html", "guides/", "guides/index.html", "guides/flight-booking-checklist.html"
  ]);
  const ACCOUNT_RETURN_HASHES = new Set([
    "", "account-menu", "bookings", "profile", "travellers", "security", "payments", "travel-updates",
    "notifications", "support", "contact-team"
  ]);
  const AUTH_RESPONSE_PARAMETERS = new Set([
    "access_token", "refresh_token", "provider_token", "provider_refresh_token", "id_token", "code",
    "token", "token_hash", "confirmation_token", "recovery_token", "email_change_token_current", "email_change_token_new",
    "token_type", "expires_in", "expires_at", "error", "error_code", "error_description", "state", "sb"
  ]);

  let clientPromise = null;
  let cachedClient = null;
  let restorePromise = null;
  let authGeneration = 0;
  let authListenerInstalled = false;

  function cleanEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizeLoginIdentifier(identifier) {
    const raw = String(identifier || "").trim();
    const email = cleanEmail(raw);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { kind: "email", value: email };
    }

    const phone = raw.replace(/[\s()-]/g, "");
    if (/^\+[1-9]\d{7,14}$/.test(phone)) {
      return { kind: "phone", value: phone };
    }

    throw new Error("Enter a valid email address or a mobile number with country code, for example +971 50 123 4567.");
  }

  function publicURL(path) {
    return new URL(path, PUBLIC_SITE_URL).href;
  }

  function safeReturnDestination(value, fallback) {
    const safeFallback = PUBLIC_RETURN_PATHS.has(String(fallback || "")) ? String(fallback) : "account.html";
    const raw = String(value || "").trim();
    if (!raw || /^\s*(?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(raw)) return safeFallback;
    try {
      const base = new URL(PUBLIC_SITE_URL);
      const destination = new URL(raw, base);
      const path = destination.pathname.replace(/^\/+/, "");
      if (destination.origin !== base.origin || destination.username || destination.password || !PUBLIC_RETURN_PATHS.has(path)) {
        return safeFallback;
      }
      const hashParameters = new URLSearchParams(destination.hash.replace(/^#/, ""));
      const hasReservedAuthMaterial = Array.from(AUTH_RESPONSE_PARAMETERS).some(function (key) {
        return destination.searchParams.has(key) || hashParameters.has(key);
      });
      if (hasReservedAuthMaterial) return safeFallback;
      if (path === "account.html") {
        const accountHash = destination.hash.replace(/^#/, "");
        if (!ACCOUNT_RETURN_HASHES.has(accountHash)) destination.hash = "";
      }
      return path + destination.search + destination.hash;
    } catch (error) {
      return safeFallback;
    }
  }

  function freshReturnRecord(stored) {
    const age = Date.now() - Number(stored && stored.savedAt);
    return Boolean(
      stored
      && typeof stored.destination === "string"
      && safeReturnDestination(stored.destination, "account.html") === stored.destination
      && Number.isFinite(age)
      && age >= 0
      && age <= AUTH_RETURN_TTL
    );
  }

  function sameReturnRecord(left, right) {
    return Boolean(
      left
      && right
      && left.destination === right.destination
      && Number(left.savedAt) === Number(right.savedAt)
      && cleanEmail(left.subject) === cleanEmail(right.subject)
    );
  }

  function sharedReturnMatchesUser(record, email) {
    const subject = cleanEmail(record && record.subject);
    return Boolean(subject && subject === cleanEmail(email));
  }

  function readSharedReturnDestination() {
    try {
      const stored = JSON.parse(localStorage.getItem(AUTH_RETURN_SHARED_KEY));
      if (freshReturnRecord(stored)) return stored;
      localStorage.removeItem(AUTH_RETURN_SHARED_KEY);
    } catch (error) {
      try { localStorage.removeItem(AUTH_RETURN_SHARED_KEY); } catch (storageError) { /* Storage can be unavailable. */ }
    }
    return null;
  }

  function rememberReturnDestinationRecord(value, shareAcrossTabs, subject) {
    const destination = safeReturnDestination(value, "account.html");
    const record = { destination: destination, savedAt: Date.now(), shared: false };
    if (shareAcrossTabs) {
      try {
        record.shared = true;
        record.subject = cleanEmail(subject);
        const existing = readSharedReturnDestination();
        const sharedRecord = existing && (
          existing.ambiguous
          || existing.destination !== destination
          || cleanEmail(existing.subject) !== record.subject
        )
          ? { destination: "account.html", savedAt: Date.now(), shared: true, ambiguous: true, subject: "" }
          : record;
        localStorage.setItem(AUTH_RETURN_SHARED_KEY, JSON.stringify(sharedRecord));
      } catch (error) {
        record.shared = false;
      }
    }
    try { sessionStorage.setItem(AUTH_RETURN_KEY, JSON.stringify(record)); }
    catch (error) { /* Storage can be unavailable. */ }
    return record;
  }

  function rememberReturnDestination(value) {
    return rememberReturnDestinationRecord(value, false).destination;
  }

  function pendingReturnDestination(allowSharedFallback, authenticatedEmail) {
    try {
      const value = sessionStorage.getItem(AUTH_RETURN_KEY);
      if (value) {
        const stored = JSON.parse(value);
        if (!freshReturnRecord(stored)) {
          clearReturnDestination();
        } else if (stored.shared) {
          const shared = readSharedReturnDestination();
          if (sameReturnRecord(stored, shared)) {
            if (!allowSharedFallback || sharedReturnMatchesUser(stored, authenticatedEmail)) {
              return safeReturnDestination(stored.destination, "account.html");
            }
            try { localStorage.removeItem(AUTH_RETURN_SHARED_KEY); } catch (storageError) { /* Storage can be unavailable. */ }
          }
          try { sessionStorage.removeItem(AUTH_RETURN_KEY); } catch (storageError) { /* Storage can be unavailable. */ }
        } else {
          return safeReturnDestination(stored.destination, "account.html");
        }
      }
    } catch (error) {
      try { sessionStorage.removeItem(AUTH_RETURN_KEY); } catch (storageError) { /* Storage can be unavailable. */ }
    }

    if (!allowSharedFallback) return "";
    const shared = readSharedReturnDestination();
    if (!shared) return "";
    try { localStorage.removeItem(AUTH_RETURN_SHARED_KEY); } catch (error) { /* Storage can be unavailable. */ }
    if (!sharedReturnMatchesUser(shared, authenticatedEmail)) return "";
    return safeReturnDestination(shared.destination, "account.html");
  }

  function clearReturnDestination() {
    let stored = null;
    try {
      stored = JSON.parse(sessionStorage.getItem(AUTH_RETURN_KEY));
    } catch (error) { /* A malformed session record is removed below. */ }
    try { sessionStorage.removeItem(AUTH_RETURN_KEY); } catch (error) { /* Storage can be unavailable. */ }
    if (!stored || !stored.shared) return;
    const shared = readSharedReturnDestination();
    if (!sameReturnRecord(stored, shared)) return;
    try { localStorage.removeItem(AUTH_RETURN_SHARED_KEY); } catch (error) { /* Storage can be unavailable. */ }
  }

  readSharedReturnDestination();

  function nameFromProfile(profile, authUser) {
    return (
      (profile && profile.full_name) ||
      (authUser && authUser.user_metadata && (authUser.user_metadata.full_name || authUser.user_metadata.name)) ||
      (authUser && authUser.email && authUser.email.split("@")[0]) ||
      "Traveller"
    );
  }

  function session() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(user) {
    const payload = JSON.stringify({
      id: user.id || "",
      email: user.email || "",
      name: user.name || "Traveller",
      phone: user.phone || "",
      createdAt: user.createdAt || new Date().toISOString(),
      at: Date.now()
    });
    localStorage.setItem(SESSION_KEY, payload);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  function clearSupabaseSession() {
    const authStorageKey = "sb-jmvqqpughlzeqrcyavwz-auth-token";
    localStorage.removeItem(authStorageKey);
    sessionStorage.removeItem(authStorageKey);
  }

  function loadSupabaseScript() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-supabase-js="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = SUPABASE_CDN;
      script.async = true;
      script.dataset.supabaseJs = "true";
      script.onload = resolve;
      script.onerror = function () {
        script.remove();
        reject(new Error("Could not load the secure account service. Please check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }

  async function client() {
    if (cachedClient) return cachedClient;
    if (!clientPromise) {
      clientPromise = loadSupabaseScript().then(function () {
        cachedClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
        installAuthListener(cachedClient);
        return cachedClient;
      }).catch(function (error) {
        clientPromise = null;
        throw error;
      });
    }
    return clientPromise;
  }

  async function profileFor(authUser) {
    if (!authUser) return null;
    const sb = await client();
    const result = await sb
      .from("profiles")
      .select("id, full_name, preferred_email, phone, whatsapp, preferred_currency, newsletter_opt_in, created_at")
      .eq("id", authUser.id)
      .maybeSingle();

    if (result.error) throw result.error;

    const profile = result.data || null;
    return {
      id: authUser.id,
      email: authUser.email || (profile && profile.preferred_email) || "",
      name: nameFromProfile(profile, authUser),
      phone: (profile && (profile.whatsapp || profile.phone)) || authUser.phone || "",
      createdAt: (profile && profile.created_at) || authUser.created_at || new Date().toISOString()
    };
  }

  async function currentUser() {
    // Anonymous visitors do not need a network round trip. This also keeps the
    // signed-out account state usable when Supabase is temporarily unavailable.
    if (restorePromise) return restorePromise;
    if (!hasPersistedAuth() && !hasAuthCallbackInUrl()) return null;
    const generation = authGeneration;
    const sb = await client();
    const authResult = await sb.auth.getUser();
    if (authResult.error) throw authResult.error;
    if (!authResult.data || !authResult.data.user) {
      if (generation === authGeneration) {
        authGeneration += 1;
        clearSession();
        announceAuthState(null);
      }
      return null;
    }
    const user = await profileFor(authResult.data.user);
    if (generation !== authGeneration) return session();
    setSession(user);
    return user;
  }

  function announceAuthState(user) {
    document.dispatchEvent(new CustomEvent("kridiya:auth-state", { detail: { user: user || null } }));
  }

  function userFromAuthSession(authUser) {
    return {
      id: authUser.id || "",
      email: authUser.email || "",
      name: nameFromProfile(null, authUser),
      phone: authUser.phone || "",
      createdAt: authUser.created_at || new Date().toISOString()
    };
  }

  async function profileForActiveAuth(authUser, generation) {
    const user = await profileFor(authUser);
    if (generation !== authGeneration) {
      const activeUser = session();
      if (!activeUser || activeUser.id !== authUser.id) {
        throw new Error("The sign-in session changed before your account finished loading.");
      }
    }
    setSession(user);
    return user;
  }

  function establishVerifiedAuthUser(authUser, hydrateProfile) {
    const generation = ++authGeneration;
    const provisionalUser = userFromAuthSession(authUser);
    setSession(provisionalUser);
    announceAuthState(provisionalUser);
    if (hydrateProfile) {
      Promise.resolve().then(function () { return profileFor(authUser); }).then(function (profileUser) {
        if (generation !== authGeneration) return;
        setSession(profileUser);
        announceAuthState(profileUser);
      }).catch(function () { /* The verified auth identity remains usable if profile hydration is unavailable. */ });
    }
    return provisionalUser;
  }

  function installAuthListener(sb) {
    if (authListenerInstalled || !sb || !sb.auth || typeof sb.auth.onAuthStateChange !== "function") return;
    authListenerInstalled = true;
    sb.auth.onAuthStateChange(function (event, authSession) {
      const authUser = authSession && authSession.user;
      if (authUser) {
        const activeUser = session();
        if (event === "TOKEN_REFRESHED" && activeUser && activeUser.id === authUser.id) {
          announceAuthState(activeUser);
          return;
        }
        establishVerifiedAuthUser(authUser, true);
      } else if (event === "SIGNED_OUT") {
        authGeneration += 1;
        clearSession();
        announceAuthState(null);
      }
    });
  }

  function hasPersistedAuth() {
    try {
      return Boolean(session() || localStorage.getItem("sb-jmvqqpughlzeqrcyavwz-auth-token"));
    } catch (error) {
      return Boolean(session());
    }
  }

  function hasAuthCallbackInUrl() {
    try {
      const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
      const search = new URLSearchParams(location.search);
      return Array.from(AUTH_RESPONSE_PARAMETERS).some(function (key) {
        return hash.has(key) || search.has(key);
      });
    } catch (error) {
      return false;
    }
  }

  function scrubAuthCallbackFromUrl() {
    try {
      const url = new URL(location.href);
      AUTH_RESPONSE_PARAMETERS.forEach(function (key) { url.searchParams.delete(key); });
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      let changedHash = false;
      AUTH_RESPONSE_PARAMETERS.forEach(function (key) {
        if (hash.has(key)) {
          hash.delete(key);
          changedHash = true;
        }
      });
      if (changedHash) url.hash = hash.toString() ? "#" + hash.toString() : "";
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (error) { /* The form can still recover when history access is unavailable. */ }
  }

  function restoreSession() {
    if (restorePromise) return restorePromise;
    const generation = authGeneration;
    const pending = client().then(async function (sb) {
      const result = await sb.auth.getSession();
      if (result.error) throw result.error;
      if (generation !== authGeneration) return session();
      const authUser = result.data && result.data.session && result.data.session.user;
      if (!authUser) {
        authGeneration += 1;
        clearSession();
        announceAuthState(null);
        return null;
      }

      return establishVerifiedAuthUser(authUser, true);
    });
    restorePromise = pending.then(function (user) {
      restorePromise = null;
      return user;
    }, function (error) {
      restorePromise = null;
      throw error;
    });
    return restorePromise;
  }

  async function register(opts) {
    const sb = await client();
    const generation = authGeneration;
    const email = cleanEmail(opts.email);
    const name = String(opts.name || "").trim();
    const phone = String(opts.phone || "").trim();
    const result = await sb.auth.signUp({
      email: email,
      password: opts.password,
      options: {
        emailRedirectTo: publicURL("account.html"),
        data: {
          full_name: name,
          phone: phone,
          whatsapp: phone
        }
      }
    });

    if (result.error) throw result.error;

    const authUser = result.data && result.data.user;
    if (!result.data || !result.data.session) {
      clearSession();
      return {
        email: email,
        name: name,
        phone: phone,
        needsEmailConfirmation: true
      };
    }

    return profileForActiveAuth(authUser, generation);
  }

  async function login(identifier, password) {
    const sb = await client();
    const generation = authGeneration;
    const identity = normalizeLoginIdentifier(identifier);
    const credentials = { password: password };
    credentials[identity.kind] = identity.value;
    const result = await sb.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;

    return profileForActiveAuth(result.data.user, generation);
  }

  async function requestLoginOtp(identifier, nextPath) {
    const sb = await client();
    const identity = normalizeLoginIdentifier(identifier);
    const input = { options: { shouldCreateUser: false } };
    input[identity.kind] = identity.value;
    if (identity.kind === "email") {
      const callback = new URL("login.html", PUBLIC_SITE_URL);
      callback.searchParams.set("next", "account.html");
      input.options.emailRedirectTo = callback.href;
    }
    const result = await sb.auth.signInWithOtp(input);
    if (result.error) throw result.error;
    if (identity.kind === "email") rememberReturnDestinationRecord(nextPath, true, identity.value);
    return identity;
  }

  async function verifyLoginOtp(identifier, token) {
    const sb = await client();
    const generation = authGeneration;
    const identity = normalizeLoginIdentifier(identifier);
    const input = {
      token: String(token || "").replace(/\s/g, ""),
      type: identity.kind === "email" ? "email" : "sms"
    };
    input[identity.kind] = identity.value;
    const result = await sb.auth.verifyOtp(input);
    if (result.error) throw result.error;
    if (!result.data || !result.data.user) throw new Error("The code could not be verified. Request a new code and try again.");

    return profileForActiveAuth(result.data.user, generation);
  }

  async function loginWithGoogle(nextPath) {
    const sb = await client();
    const callback = new URL("login.html", PUBLIC_SITE_URL);
    rememberReturnDestinationRecord(nextPath, false);
    callback.searchParams.set("next", "account.html");
    const result = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.href,
        scopes: "openid email profile"
      }
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function logout() {
    authGeneration += 1;
    clearSession();
    clearSupabaseSession();
    announceAuthState(null);
    if (cachedClient) cachedClient.auth.signOut().catch(function () {});
  }

  async function resetPassword(email) {
    const sb = await client();
    const result = await sb.auth.resetPasswordForEmail(cleanEmail(email), {
      redirectTo: publicURL("reset-password.html")
    });
    if (result.error) throw result.error;
  }

  async function completePasswordReset(nextPassword) {
    const sb = await client();
    const result = await sb.auth.updateUser({ password: nextPassword });
    if (result.error) throw result.error;
    await currentUser();
  }

  async function changePassword(email, current, next) {
    const sb = await client();
    const signIn = await sb.auth.signInWithPassword({
      email: cleanEmail(email),
      password: current
    });
    if (signIn.error) throw new Error("Your current password is incorrect.");

    const result = await sb.auth.updateUser({ password: next });
    if (result.error) throw result.error;
    await currentUser();
  }

  async function updateProfile(email, fields) {
    const user = await currentUser();
    if (!user) throw new Error("Please log in again.");

    const name = String(fields.name || "").trim();
    const phone = String(fields.phone || "").trim();
    const sb = await client();

    const result = await sb
      .from("profiles")
      .update({
        full_name: name,
        phone: phone,
        whatsapp: phone,
        preferred_email: cleanEmail(email || user.email)
      })
      .eq("id", user.id)
      .select("id, full_name, preferred_email, phone, whatsapp, created_at")
      .single();

    if (result.error) throw result.error;

    const updated = {
      id: user.id,
      email: user.email,
      name: result.data.full_name,
      phone: result.data.whatsapp || result.data.phone || "",
      createdAt: result.data.created_at || user.createdAt
    };
    setSession(updated);
    return updated;
  }

  async function listBookings() {
    const user = await currentUser();
    if (!user) return [];

    const sb = await client();
    const result = await sb
      .from("bookings")
      .select("id, booking_reference, service_type, title, route_or_destination, travel_start, travel_end, adults, children, infants, amount, currency, status, payment_status, document_status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;
    return result.data || [];
  }
  async function listBookingDocuments() {
    const user = await currentUser();
    if (!user) return [];
    const sb = await client();
    const result = await sb
      .from("booking_documents")
      .select("id, booking_id, document_type, file_name, storage_path, storage_provider, external_reference, visible_to_customer, created_at")
      .eq("user_id", user.id)
      .eq("visible_to_customer", true)
      .order("created_at", { ascending: false });
    if (result.error) return [];
    return result.data || [];
  }
  async function listCustomerPayments(bookingIds, enquiryIds) {
    const user = await currentUser();
    if (!user) return [];
    const ids = [];
    (bookingIds || []).forEach(function (id) { ids.push("booking_id.eq." + id); });
    (enquiryIds || []).forEach(function (id) { ids.push("enquiry_id.eq." + id); });
    if (!ids.length) return [];
    const sb = await client();
    const result = await sb
      .from("payments")
      .select("id, booking_id, enquiry_id, payment_reference, payment_direction, amount, currency, method, status, payment_link, receipt_document_id, proof_file_name, proof_uploaded_at, proof_source, refund_amount, refund_reason, refund_method, refund_reference, refund_requested_at, refund_approved_at, refund_completed_at, received_at, created_at")
      .or(ids.join(","))
      .order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }
  async function openBookingDocument(documentId, storagePath, storageProvider) {
    const user = await currentUser();
    if (!user) throw new Error("Please log in again.");
    if (!documentId || !storagePath) throw new Error("This document does not have a downloadable file yet.");
    const sb = await client();
    const check = await sb
      .from("booking_documents")
      .select("id, storage_path")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .eq("visible_to_customer", true)
      .maybeSingle();
    if (check.error || !check.data || check.data.storage_path !== storagePath) {
      throw new Error("This document is not available for your account.");
    }
    if (storageProvider === "microsoft") {
      const sessionResult = await sb.auth.getSession();
      const token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
      if (!token) throw new Error("Please log in again.");
      const response = await fetch(SUPABASE_URL + "/functions/v1/microsoft-documents", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "download_booking_document", document_id: documentId })
      });
      if (!response.ok) {
        const failure = await response.json().catch(function () { return {}; });
        throw new Error(failure.error || "Could not prepare document download.");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = "";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function () { URL.revokeObjectURL(downloadUrl); }, 30000);
      return;
    }
    const result = await sb.storage.from("booking-documents").createSignedUrl(storagePath, 300, { download: true });
    if (result.error || !result.data || !result.data.signedUrl) {
      throw new Error(result.error ? result.error.message : "Could not prepare document download.");
    }
    window.open(result.data.signedUrl, "_blank", "noopener");
  }

  async function uploadMyPaymentProof(paymentId, file) {
    const user = await currentUser();
    if (!user) throw new Error("Please log in again.");
    if (!file || file.size < 1 || file.size > 10485760) throw new Error("Choose a proof file up to 10 MB.");
    if (["application/pdf", "image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) throw new Error("Use a PDF, JPG, PNG, or WebP file.");
    const safeName = String(file.name || "proof").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-120) || "proof";
    const path = user.id + "/" + paymentId + "/" + Date.now() + "-" + safeName;
    const sb = await client();
    const upload = await sb.storage.from("booking-payment-proofs").upload(path, file, { upsert: false, contentType: file.type });
    if (upload.error) throw upload.error;
    const attach = await sb.rpc("attach_my_payment_proof", { p_payment_id: paymentId, p_storage_path: path, p_file_name: String(file.name || safeName).slice(0, 180), p_mime_type: file.type, p_size_bytes: file.size });
    if (attach.error) {
      await sb.storage.from("booking-payment-proofs").remove([path]);
      throw attach.error;
    }
    return attach.data === true;
  }

  async function getMyPaymentReceipt(paymentId) {
    const sb = await client();
    const result = await sb.rpc("get_my_payment_receipt", { p_payment_id: paymentId }).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("This receipt has not been released for your account.");
    return result.data;
  }

  async function listMyBookingTimeline(bookingId) {
    const sb = await client();
    const result = await sb.rpc("list_my_booking_timeline", { p_booking_id: bookingId });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function getMyNotificationPreferences() {
    const sb = await client(); const result = await sb.rpc("get_my_notification_preferences");
    if (result.error) throw result.error; return result.data || {};
  }
  async function saveMyNotificationPreferences(values) {
    const sb = await client(); const result = await sb.rpc("save_my_notification_preferences", {
      p_email_enabled: values.emailEnabled, p_whatsapp_enabled: values.whatsappEnabled,
      p_booking_updates: values.bookingUpdates, p_payment_updates: values.paymentUpdates,
      p_document_updates: values.documentUpdates, p_support_updates: values.supportUpdates,
      p_marketing_email: values.marketingEmail
    }); if (result.error) throw result.error; return result.data;
  }
  async function listMyCommunicationHistory() {
    const sb = await client(); const result = await sb.rpc("list_my_communication_history", { p_limit: 50 });
    if (result.error) throw result.error; return result.data || [];
  }
  async function listMyTravelDisruptions() {
    const sb = await client(); const result = await sb.rpc("list_my_travel_disruptions", { p_limit: 100 });
    if (result.error) throw result.error; return result.data || [];
  }
  async function getMyEnquiryDraft(formKey) {
    const sb = await client(); const result = await sb.rpc("get_my_enquiry_draft", { p_form_key: formKey });
    if (result.error) throw result.error; return result.data || null;
  }
  async function saveMyEnquiryDraft(formKey, serviceType, payload) {
    const sb = await client(); const result = await sb.rpc("save_my_enquiry_draft", { p_form_key: formKey, p_service_type: serviceType, p_payload: payload });
    if (result.error) throw result.error; return result.data;
  }
  async function deleteMyEnquiryDraft(formKey) {
    const sb = await client(); const result = await sb.rpc("delete_my_enquiry_draft", { p_form_key: formKey });
    if (result.error) throw result.error; return result.data === true;
  }

  async function listMyTravellers() {
    const sb = await client();
    const result = await sb.rpc("list_my_travellers");
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function saveMyTraveller(payload) {
    const sb = await client();
    const result = await sb.rpc("save_my_traveller", {
      p_traveller_id: payload.id || null,
      p_full_name: payload.fullName,
      p_date_of_birth: payload.dateOfBirth || null,
      p_nationality: payload.nationality || null,
      p_passport_number: payload.passportNumber || null,
      p_passport_expiry: payload.passportExpiry || null,
      p_expected_updated_at: payload.expectedUpdatedAt || null
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function archiveMyTraveller(id, expectedUpdatedAt) {
    const sb = await client();
    const result = await sb.rpc("archive_my_traveller", {
      p_traveller_id: id,
      p_expected_updated_at: expectedUpdatedAt
    });
    if (result.error) throw result.error;
    return result.data === true;
  }

  async function listMySupportRequests() {
    const sb = await client();
    const result = await sb.rpc("list_my_support_requests");
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function createMySupportRequest(payload) {
    const sb = await client();
    const result = await sb.rpc("create_my_support_request", {
      p_category: payload.category,
      p_subject: payload.subject,
      p_description: payload.description,
      p_urgency: payload.urgency,
      p_booking_id: payload.bookingId || null,
      p_enquiry_id: payload.enquiryId || null
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function cancelMySupportRequest(id, expectedUpdatedAt) {
    const sb = await client();
    const result = await sb.rpc("cancel_my_support_request", { p_request_id: id, p_expected_updated_at: expectedUpdatedAt });
    if (result.error) throw result.error;
    return result.data === true;
  }

  async function listEnquiries() {
    const user = await currentUser();
    if (!user) return [];

    const sb = await client();
    const result = await sb
      .from("enquiries")
      .select("id, reference, service_type, status, summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function listRequests() {
    const user = await currentUser();
    if (!user) return [];
    const sb = await client();
    const result = await sb.from("enquiry_requests").select("*").order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function listQuotes() {
    const user = await currentUser();
    if (!user) return [];
    const sb = await client();
    const result = await sb.from("quotes").select("*").order("created_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function respondToTextRequest(requestId, text) {
    const sb = await client();
    const result = await sb
      .from("enquiry_requests")
      .update({ response_text: text, responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function respondToFileRequest(requestId, file) {
    const user = await currentUser();
    if (!user) throw new Error("Please log in again.");
    const sb = await client();
    const path = user.id + "/" + requestId + "/" + file.name;
    const upload = await sb.storage.from("enquiry-uploads").upload(path, file, { upsert: true });
    if (upload.error) throw upload.error;
    const result = await sb
      .from("enquiry_requests")
      .update({ response_file_path: path, response_file_name: file.name, responded_at: new Date().toISOString() })
      .eq("id", requestId)
      .select("*")
      .single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function respondToQuote(quoteId, status, expectedUpdatedAt, termsConfirmed) {
    const sb = await client();
    const result = await sb.rpc("respond_to_my_quote", { p_quote_id: quoteId, p_decision: status, p_expected_updated_at: expectedUpdatedAt, p_terms_confirmed: termsConfirmed === true });
    if (result.error) throw result.error;
    return result.data;
  }

  async function requestQuoteRevision(quoteId, message, expectedUpdatedAt) {
    const sb = await client();
    const result = await sb.rpc("request_my_quote_revision", { p_quote_id: quoteId, p_message: message, p_expected_updated_at: expectedUpdatedAt });
    if (result.error) throw result.error;
    return result.data;
  }

  async function getMyCorporatePortal() {
    const user = await currentUser();
    if (!user) return [];
    const sb = await client();
    const result = await sb.rpc("get_my_corporate_portal");
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function listMyCorporateBookings(corporateAccountId) {
    const user = await currentUser();
    if (!user) return [];
    const sb = await client();
    const result = await sb.rpc("list_my_corporate_bookings", {
      p_corporate_account_id: corporateAccountId || null,
      p_limit: 100
    });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function createMyCorporateRequest(payload) {
    const user = await currentUser();
    if (!user) throw new Error("Please log in again.");
    const sb = await client();
    const result = await sb.rpc("create_my_corporate_request", {
      p_corporate_account_id: payload.corporateAccountId,
      p_title: payload.title,
      p_service_type: payload.serviceType,
      p_route_or_destination: payload.route || null,
      p_travel_start: payload.travelStart || null,
      p_travel_end: payload.travelEnd || null,
      p_customer_notes: payload.notes || null
    });
    if (result.error) throw result.error;
    return result.data;
  }

  function getUser(email) {
    const cached = session();
    if (!cached) return null;
    return !email || cleanEmail(email) === cleanEmail(cached.email) ? cached : null;
  }

  function passwordIssue(pw) {
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use at least one letter and one number.";
    return "";
  }

  function passwordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusLabel(value) {
    return String(value || "enquiry").replace(/_/g, " ").replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  return {
    client: client,
    session: session,
    currentUser: currentUser,
    hasPersistedAuth: hasPersistedAuth,
    hasAuthCallbackInUrl: hasAuthCallbackInUrl,
    safeReturnDestination: safeReturnDestination,
    rememberReturnDestination: rememberReturnDestination,
    pendingReturnDestination: pendingReturnDestination,
    clearReturnDestination: clearReturnDestination,
    scrubAuthCallbackFromUrl: scrubAuthCallbackFromUrl,
    restoreSession: restoreSession,
    register: register,
    login: login,
    normalizeLoginIdentifier: normalizeLoginIdentifier,
    requestLoginOtp: requestLoginOtp,
    verifyLoginOtp: verifyLoginOtp,
    loginWithGoogle: loginWithGoogle,
    logout: logout,
    resetPassword: resetPassword,
    completePasswordReset: completePasswordReset,
    changePassword: changePassword,
    updateProfile: updateProfile,
    getUser: getUser,
    listBookings: listBookings,
    listEnquiries: listEnquiries,
    listBookingDocuments: listBookingDocuments,
    openBookingDocument: openBookingDocument,
    listCustomerPayments: listCustomerPayments,
    uploadMyPaymentProof: uploadMyPaymentProof,
    getMyPaymentReceipt: getMyPaymentReceipt,
    listMyBookingTimeline: listMyBookingTimeline,
    getMyNotificationPreferences: getMyNotificationPreferences,
    saveMyNotificationPreferences: saveMyNotificationPreferences,
    listMyCommunicationHistory: listMyCommunicationHistory,
    listMyTravelDisruptions: listMyTravelDisruptions,
    getMyEnquiryDraft: getMyEnquiryDraft,
    saveMyEnquiryDraft: saveMyEnquiryDraft,
    deleteMyEnquiryDraft: deleteMyEnquiryDraft,
    listMyTravellers: listMyTravellers,
    saveMyTraveller: saveMyTraveller,
    archiveMyTraveller: archiveMyTraveller,
    listMySupportRequests: listMySupportRequests,
    createMySupportRequest: createMySupportRequest,
    cancelMySupportRequest: cancelMySupportRequest,
    listRequests: listRequests,
    listQuotes: listQuotes,
    respondToTextRequest: respondToTextRequest,
    respondToFileRequest: respondToFileRequest,
    respondToQuote: respondToQuote,
    requestQuoteRevision: requestQuoteRevision,
    getMyCorporatePortal: getMyCorporatePortal,
    listMyCorporateBookings: listMyCorporateBookings,
    createMyCorporateRequest: createMyCorporateRequest,
    passwordIssue: passwordIssue,
    passwordStrength: passwordStrength,
    escapeHTML: escapeHTML,
    statusLabel: statusLabel
  };
})();

/* ============================================================
   Page wiring (login / register / account / reset password)
   ============================================================ */
(function () {
  const page = document.body.dataset.page;
  const authCallbackOnArrival = KridiyaAuth.hasAuthCallbackInUrl();

  document.addEventListener("DOMContentLoaded", function () {
    if (KridiyaAuth.hasPersistedAuth() || authCallbackOnArrival) {
      KridiyaAuth.restoreSession().catch(function () {});
    }
  });

  function banner(form, msg, kind) {
    const el = form.querySelector(".form-banner");
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
    el.className = "form-banner " + (kind || "error");
    if (msg && kind === "success" && window.KridiyaMotion && KridiyaMotion.success) KridiyaMotion.success(el);
  }

  function readableErrorValue(value, depth) {
    if (!value || depth > 2) return "";
    if (typeof value === "string") return value.trim();
    if (value instanceof Error && value.message) return value.message.trim();

    const keys = ["message", "error_description", "description", "details", "hint", "msg"];
    for (let i = 0; i < keys.length; i++) {
      const text = readableErrorValue(value[keys[i]], depth + 1);
      if (text) return text;
    }

    const nested = readableErrorValue(value.error, depth + 1);
    if (nested) return nested;

    try {
      const text = JSON.stringify(value);
      return text && text !== "{}" ? text : "";
    } catch (e) {
      return "";
    }
  }

  function errorMessage(err, fallback) {
    const text = readableErrorValue(err, 0);
    if (!text || text === "{}") return fallback;
    if (/already registered|user already exists|already been registered/i.test(text)) {
      return "An account already exists for this email. Please log in or use password reset.";
    }
    if (/database error saving new user|error saving new user/i.test(text)) {
      return "We could not finish account setup right now. Please try again, or contact Kridiya Travel on WhatsApp so we can create it for you.";
    }
    if (/failed to fetch|network|load failed/i.test(text)) {
      return "Could not reach the secure account service. Please check your internet connection and try again.";
    }
    if (/provider.+not enabled|unsupported provider|google.+disabled/i.test(text)) {
      return "Google sign-in is not available right now. Use your email and password instead.";
    }
    if (/sms.+provider|phone.+disabled|phone.+not enabled|unsupported phone/i.test(text)) {
      return "Phone code sign-in is not available right now. Use your email or password, or contact Kridiya Travel.";
    }
    if (/otp_expired|token.+expired|invalid.+token|token.+invalid|invalid.+otp/i.test(text)) {
      return "That one-time code is invalid or expired. Request a new code and try again.";
    }
    if (/rate limit|too many requests|over_email_send_rate_limit|over_sms_send_rate_limit/i.test(text)) {
      return "Too many code requests. Please wait a minute and try again.";
    }
    if (/signups? not allowed|user not found|no user found/i.test(text)) {
      return "We could not send a code to those account details. Check them or use password sign-in.";
    }
    return fallback;
  }

  function authLinkError() {
    const search = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const code = hash.get("error_code") || search.get("error_code") || hash.get("error") || search.get("error") || "";
    const description = hash.get("error_description") || search.get("error_description") || "";
    if (!code && !description) return "";
    if (/otp_expired|expired/i.test(code + " " + description)) {
      return "This sign-in or password-reset link has expired. Request a new link and use the newest email.";
    }
    if (/access_denied|oauth|provider/i.test(code + " " + description)) {
      return "Google sign-in was cancelled or could not be completed. Try again or use your email and password.";
    }
    return "This sign-in or password-reset link is invalid. Request a new link or contact Kridiya Travel for help.";
  }

  function busy(form, on, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(btn, on ? label : btn.dataset.label, on);
    else btn.textContent = on ? label : btn.dataset.label;
  }

  function initPwToggles(scope) {
    (scope || document).querySelectorAll(".pw-toggle").forEach(function (t) {
      t.addEventListener("click", function () {
        const input = t.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(t, show ? "HIDE" : "SHOW", false);
        else t.textContent = show ? "HIDE" : "SHOW";
        t.setAttribute("aria-label", show ? "Hide password" : "Show password");
      });
    });
  }

  function refreshHeaderName(user) {
    const btn = document.getElementById("account-btn");
    if (btn && user) {
      btn.textContent = "My Kridiya";
      btn.href = "account.html#account-menu";
    }
  }

  async function existingUserOrNull() {
    try {
      return await KridiyaAuth.currentUser();
    } catch (e) {
      return null;
    }
  }

  function loginRedirectTarget(form, user) {
    const requestedByPage = (form && form.dataset.authNext)
      || new URLSearchParams(location.search).get("next");
    const pendingDestination = KridiyaAuth.pendingReturnDestination(authCallbackOnArrival, user && user.email);
    const requested = authCallbackOnArrival
      ? (pendingDestination || requestedByPage)
      : (requestedByPage || pendingDestination);
    return KridiyaAuth.safeReturnDestination(requested, "account.html");
  }

  function cancelLoginRestoreWatchdog() {
    if (!window.__KRIDIYA_AUTH_RESTORE_WATCHDOG__) return;
    clearTimeout(window.__KRIDIYA_AUTH_RESTORE_WATCHDOG__);
    window.__KRIDIYA_AUTH_RESTORE_WATCHDOG__ = 0;
  }

  function showLoginRestore(show) {
    const restore = document.getElementById("auth-session-restore");
    if (!show) cancelLoginRestoreWatchdog();
    document.documentElement.classList.toggle("auth-restore-pending", show);
    document.body.classList.toggle("auth-session-restoring", show);
    if (restore) restore.hidden = !show;
  }

  async function initializeLoginForm(form) {
      if (!form || form.dataset.loginInitialized === "true") return;
      form.dataset.loginInitialized = "true";
      if (window.KridiyaLocale && KridiyaLocale.ready) await KridiyaLocale.ready;
      initPwToggles(form);
      const identifierInput = form.elements.identifier;
      const passwordInput = form.elements.password;
      const codeInput = form.elements.code;
      const passwordField = document.getElementById("login-password-field");
      const codeField = document.getElementById("login-code-field");
      const forgotRow = document.getElementById("login-forgot-row");
      const methodToggle = document.getElementById("auth-method-toggle");
      const changeIdentifier = document.getElementById("otp-change-identifier");
      const submitButton = form.querySelector('button[type="submit"]');
      const googleBtn = document.getElementById("google-login-btn");
      let mode = "otp-request";

      function loginText(english) {
        return window.KridiyaLocale ? KridiyaLocale.text(english) : english;
      }

      function setLoginButtonLabel(english) {
        const label = loginText(english);
        submitButton.dataset.label = label;
        submitButton.textContent = label;
        submitButton.setAttribute("aria-label", label);
      }

      function setLoginMode(nextMode) {
        mode = nextMode;
        form.dataset.mode = mode;
        const passwordMode = mode === "password";
        const codeMode = mode === "otp-verify";
        passwordField.hidden = !passwordMode;
        forgotRow.hidden = !passwordMode;
        codeField.hidden = !codeMode;
        passwordInput.required = passwordMode;
        codeInput.required = codeMode;
        identifierInput.readOnly = codeMode;
        changeIdentifier.hidden = !codeMode;
        methodToggle.textContent = loginText(passwordMode ? "Use a one-time code" : "Use password instead");
        setLoginButtonLabel(passwordMode ? "Log in" : codeMode ? "Verify code" : "Send one-time code");
        banner(form, "");
      }

      function setLoginBusy(on, label) {
        busy(form, on, label);
        methodToggle.disabled = on;
        changeIdentifier.disabled = on;
        if (googleBtn) googleBtn.disabled = on;
      }

      function validIdentity() {
        try {
          const identity = KridiyaAuth.normalizeLoginIdentifier(identifierInput.value);
          setFieldError(identifierInput, "");
          return identity;
        } catch (error) {
          setFieldError(identifierInput, loginText(error.message));
          identifierInput.focus();
          return null;
        }
      }

      methodToggle.addEventListener("click", function () {
        setLoginMode(mode === "password" ? "otp-request" : "password");
        (mode === "password" ? passwordInput : identifierInput).focus();
      });

      changeIdentifier.addEventListener("click", function () {
        codeInput.value = "";
        setFieldError(codeInput, "");
        setLoginMode("otp-request");
        identifierInput.focus();
        identifierInput.select();
      });

      setLoginMode("otp-request");
      const linkError = authLinkError();
      if (linkError) banner(form, linkError, "error");
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        const identity = validIdentity();
        if (!identity) return;

        if (mode === "password" && !passwordInput.value) {
          setFieldError(passwordInput, loginText("Enter your password."));
          passwordInput.focus();
          return;
        }
        if (mode === "otp-verify" && !/^\d{6}$/.test(codeInput.value.replace(/\s/g, ""))) {
          setFieldError(codeInput, loginText("Enter the 6-digit code."));
          codeInput.focus();
          return;
        }

        banner(form, "");
        setLoginBusy(true, loginText(mode === "otp-request" ? "Sending code..." : mode === "otp-verify" ? "Verifying code..." : "Signing in..."));
        try {
          if (mode === "otp-request") {
            await KridiyaAuth.requestLoginOtp(identity.value, loginRedirectTarget(form));
            if (typeof trackEvent === "function") trackEvent("login_otp_requested", { channel: identity.kind });
            setLoginBusy(false);
            setLoginMode("otp-verify");
            banner(form, loginText("We sent a one-time code. Enter it below."), "success");
            codeInput.focus();
            return;
          }

          const user = mode === "otp-verify"
            ? await KridiyaAuth.verifyLoginOtp(identity.value, codeInput.value)
            : await KridiyaAuth.login(identity.value, passwordInput.value);
          if (typeof trackEvent === "function") trackEvent("login", { method: mode === "otp-verify" ? identity.kind + "_otp" : identity.kind + "_password" });
          toast("Welcome back, " + user.name.split(" ")[0] + "!");
          const destination = loginRedirectTarget(form, user);
          KridiyaAuth.clearReturnDestination();
          location.href = destination;
        } catch (err) {
          const fallback = mode === "otp-request"
            ? "Could not send a one-time code. Check your details and try again."
            : mode === "otp-verify"
              ? "Could not verify that code. Check it or request a new one."
              : "Could not sign in. Check your account details and password.";
          banner(form, loginText(errorMessage(err, fallback)), "error");
          setLoginBusy(false);
        }
      });

      if (googleBtn) {
        googleBtn.addEventListener("click", async function () {
          const label = googleBtn.querySelector(".auth-provider-label");
          const idleLabel = label ? label.textContent : "Continue with Google";
          banner(form, "");
          googleBtn.disabled = true;
          googleBtn.setAttribute("aria-busy", "true");
          if (label) label.textContent = "Opening Google...";
          try {
            if (typeof trackEvent === "function") trackEvent("login_start", { method: "google" });
            await KridiyaAuth.loginWithGoogle(loginRedirectTarget(form));
          } catch (err) {
            banner(form, loginText(errorMessage(err, "Could not start Google sign-in. Try again or use another sign-in method.")), "error");
          } finally {
            googleBtn.disabled = false;
            googleBtn.removeAttribute("aria-busy");
            if (label) label.textContent = idleLabel;
          }
        });
      }

      const resetBtn = document.getElementById("reset-password-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", async function () {
          const email = form.email.value.trim();
          if (!email) {
            setFieldError(form.email, "Enter your email first, then click reset.");
            form.email.focus();
            return;
          }
          banner(form, "");
          resetBtn.disabled = true;
          resetBtn.textContent = "Sending reset link...";
          try {
            await KridiyaAuth.resetPassword(email);
            banner(form, "Password reset email sent. Check your inbox.", "success");
          } catch (err) {
            banner(form, errorMessage(err, "Could not send the password reset email. Please try again."), "error");
          }
          resetBtn.disabled = false;
          resetBtn.textContent = "Send password reset email";
        });
      }
  }

  document.addEventListener("kridiya:login-dialog-ready", function (event) {
    initializeLoginForm(event.detail && event.detail.form);
  });

  if (page === "login") {
    document.addEventListener("DOMContentLoaded", async function () {
      const form = document.getElementById("login-form");
      const initialized = initializeLoginForm(form);
      const shouldRestore = authCallbackOnArrival || KridiyaAuth.hasPersistedAuth();
      if (!shouldRestore) return;

      showLoginRestore(true);
      try {
        const user = await KridiyaAuth.restoreSession();
        if (user) {
          window.__KRIDIYA_AUTH_RESTORE_TIMED_OUT__ = false;
          const destination = loginRedirectTarget(form, user);
          KridiyaAuth.clearReturnDestination();
          showLoginRestore(false);
          document.body.classList.remove("auth-login-open");
          banner(form, "");
          location.replace(destination);
          return;
        }
        if (window.__KRIDIYA_AUTH_RESTORE_TIMED_OUT__) {
          if (authCallbackOnArrival) KridiyaAuth.scrubAuthCallbackFromUrl();
          return;
        }
        showLoginRestore(false);
        if (authCallbackOnArrival) {
          const callbackMessage = authLinkError();
          KridiyaAuth.scrubAuthCallbackFromUrl();
          await initialized;
          document.body.classList.add("auth-login-open");
          banner(form, callbackMessage || "We could not complete Google sign-in. Please try again or use another sign-in method.", "error");
        }
      } catch (error) {
        const callbackMessage = authCallbackOnArrival ? authLinkError() : "";
        if (authCallbackOnArrival) KridiyaAuth.scrubAuthCallbackFromUrl();
        showLoginRestore(false);
        await initialized;
        document.body.classList.add("auth-login-open");
        banner(form, callbackMessage || errorMessage(error, "We could not complete sign-in. Check your connection and try again."), "error");
      }
    });
  }

  if (page === "register") {
    document.addEventListener("DOMContentLoaded", async function () {
      existingUserOrNull().then(user => { if (user) location.replace("account.html"); });

      const form = document.getElementById("register-form");
      initPwToggles(form);

      const googleBtn = document.getElementById("register-google-btn");
      if (googleBtn) {
        googleBtn.addEventListener("click", async function () {
          const label = googleBtn.querySelector(".auth-provider-label");
          const idleLabel = label ? label.textContent : "Continue with Google";
          banner(form, "");
          googleBtn.disabled = true;
          googleBtn.setAttribute("aria-busy", "true");
          if (label) label.textContent = "Opening Google...";
          try {
            if (typeof trackEvent === "function") trackEvent("register_account", { method: "google", status: "started" });
            await KridiyaAuth.loginWithGoogle("account.html#profile");
          } catch (err) {
            banner(form, errorMessage(err, "Could not start Google account setup. Try again or continue with email."), "error");
          } finally {
            googleBtn.disabled = false;
            googleBtn.removeAttribute("aria-busy");
            if (label) label.textContent = idleLabel;
          }
        });
      }

      const pwInput = form.password;
      const meter = form.querySelector(".pw-meter i");
      pwInput.addEventListener("input", function () {
        const s = KridiyaAuth.passwordStrength(pwInput.value);
        meter.style.width = (s / 5) * 100 + "%";
        meter.className = s >= 4 ? "strong" : s >= 2 ? "ok" : "";
      });

      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        const issue = KridiyaAuth.passwordIssue(form.password.value);
        if (issue) {
          setFieldError(form.password, issue);
          form.password.focus();
          return;
        }
        if (form.password.value !== form.confirm.value) {
          setFieldError(form.confirm, "Passwords do not match.");
          form.confirm.focus();
          return;
        }
        banner(form, "");
        busy(form, true, "Creating account...");
        try {
          const user = await KridiyaAuth.register({
            name: form.name.value,
            email: form.email.value,
            phone: form.phone.value,
            password: form.password.value
          });

          if (user.needsEmailConfirmation) {
            if (typeof trackEvent === "function") trackEvent("register_account", { method: "email", confirmation_required: true });
            banner(form, "Account created. Check your email and click the confirmation link before logging in.", "success");
            form.reset();
            meter.style.width = "0";
            busy(form, false);
            return;
          }

          if (typeof trackEvent === "function") trackEvent("register_account", { method: "email", confirmation_required: false });
          toast("Welcome to Kridiya Travel, " + user.name.split(" ")[0] + "!");
          location.href = "account.html";
        } catch (err) {
          banner(form, errorMessage(err, "Could not create the account. Please try again or contact Kridiya Travel."), "error");
          busy(form, false);
        }
      });
    });
  }

  function requestsHTML(requests) {
    if (!requests.length) return "";
    return '<div class="enq-extra customer-action-list"><h4>Action needed from you</h4>' + requests.map(function (r) {
      if (r.responded_at) {
        const answer = r.kind === "file"
          ? (r.response_file_name ? "Uploaded: " + KridiyaAuth.escapeHTML(r.response_file_name) : "Uploaded")
          : KridiyaAuth.escapeHTML(r.response_text || "");
        return '<p class="form-note enq-extra-done">' + icon("check") + " " + KridiyaAuth.escapeHTML(r.label) + " - " + answer + "</p>";
      }
      if (r.kind === "file") {
        return '<form class="cust-request-form" data-request-id="' + r.id + '" data-kind="file">' +
          "<label>" + KridiyaAuth.escapeHTML(r.label) + "</label>" +
          '<input type="file" required>' +
          '<button class="btn btn-outline" type="submit">Upload</button>' +
          "</form>";
      }
      return '<form class="cust-request-form" data-request-id="' + r.id + '" data-kind="text">' +
        "<label>" + KridiyaAuth.escapeHTML(r.label) + "</label>" +
        '<input type="text" required placeholder="Your answer">' +
        '<button class="btn btn-outline" type="submit">Send</button>' +
        "</form>";
    }).join("") + "</div>";
  }

  function money(v, c) {
    return KridiyaAuth.escapeHTML((c || "AED") + " " + Number(v || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  function docPresentation(doc) {
    const source = String([doc.document_type, doc.file_name, doc.external_reference].filter(Boolean).join(" ")).toLowerCase();
    if (/ticket|e-?ticket|flight/.test(source)) return { type: "ticket", label: "Travel ticket" };
    if (/voucher|hotel|stay|transfer|tour|package/.test(source)) return { type: "voucher", label: "Voucher" };
    if (/invoice|tax|receipt|bill/.test(source)) return { type: "invoice", label: "Invoice" };
    if (/visa|permit/.test(source)) return { type: "visa", label: "Visa document" };
    if (/insurance|policy/.test(source)) return { type: "policy", label: "Policy" };
    return { type: "document", label: KridiyaAuth.statusLabel(doc.document_type || "Document") };
  }

  function quoteDetailRows(q) {
    const od = (q.option_data && typeof q.option_data === "object") ? q.option_data : {};
    let rows = Object.keys(od).map(function (k) {
      return od[k] ? '<div class="quote-row"><span class="quote-k">' + KridiyaAuth.escapeHTML(k) + '</span><span class="quote-v">' + KridiyaAuth.escapeHTML(String(od[k])) + "</span></div>" : "";
    }).join("");
    if (!rows) {
      const legacy = [];
      if (q.airline || q.stops) legacy.push(["Flight", [q.airline, q.stops].filter(Boolean).join(" / ")]);
      if (q.outbound) legacy.push(["Onward", q.outbound]);
      if (q.inbound) legacy.push(["Return", q.inbound]);
      if (q.baggage) legacy.push(["Baggage", q.baggage]);
      rows = legacy.map(function (r) {
        return '<div class="quote-row"><span class="quote-k">' + KridiyaAuth.escapeHTML(r[0]) + '</span><span class="quote-v">' + KridiyaAuth.escapeHTML(r[1]) + "</span></div>";
      }).join("");
    }
    return rows;
  }
  function quotesHTML(quotes) {
    if (!quotes.length) return "";
    const sortedQuotes = quotes.slice().sort(function (a, b) {
      const byPrice = Number(a.price_amount || 0) - Number(b.price_amount || 0);
      if (byPrice) return byPrice;
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
    function displayTitle(q, index) {
      const name = String(q.title || "").replace(/^Option\s+\d+\s*:\s*/i, "").trim();
      return "Option " + (index + 1) + (name ? ": " + name : "");
    }
    return '<div class="enq-extra quote-list">' + sortedQuotes.map(function (q, index) {
      const amount = money(q.price_amount, q.currency);
      const expired = q.status === "expired" || (q.valid_until && new Date(q.valid_until).getTime() <= Date.now());
      const validity = q.valid_until
        ? new Date(q.valid_until).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        : "";
      const details = quoteDetailRows(q);
      const adds = Array.isArray(q.addons) ? q.addons : [];
      const addonsHtml = adds.length
        ? '<div class="quote-addons"><span class="quote-addons-title">Optional add-ons</span>' + adds.map(function (a) {
            return '<div class="quote-row"><span class="quote-k">' + KridiyaAuth.escapeHTML(a.name) + '</span><span class="quote-v">' + (a.price != null ? money(a.price, q.currency) : "") + "</span></div>";
          }).join("") + "</div>"
        : "";
      const termsHtml = q.terms
        ? '<details class="quote-terms"><summary>Terms &amp; conditions</summary><ul>' + String(q.terms).split("\n").map(function (t) {
            t = t.replace(/^[-*]\s*/, "").trim();
            return t ? "<li>" + KridiyaAuth.escapeHTML(t) + "</li>" : "";
          }).join("") + "</ul></details>"
        : "";

      if (q.status === "sent" && !expired) {
        return '<div class="quote-card">' +
          '<div class="quote-card-head"><h4>' + KridiyaAuth.escapeHTML(displayTitle(q, index)) + '</h4><div class="quote-price">' + amount + "</div></div>" +
          (details ? '<div class="quote-details">' + details + "</div>" : "") +
          addonsHtml +
          termsHtml +
          (validity ? '<p class="quote-valid">Valid until ' + KridiyaAuth.escapeHTML(validity) + "</p>" : "") +
          '<div class="quote-acceptance-boundary"><p>Accepting this quote records your agreement to the shown service, price, inclusions, exclusions, supplier conditions and any Kridiya Travel service fee stated separately from supplier prices. This quote is not a booking and acceptance is not a confirmed booking. Booking proceeds only after written acceptance, required traveller details and documents, cleared payment where required, supplier confirmation and any applicable verification. A receipt or uploaded payment proof is evidence only and does not by itself mean funds have cleared.</p><p lang="ar" dir="rtl">عرض السعر هذا ليس حجزًا ولا يحجز التوافر. قد تُبيَّن رسوم خدمة كريديا للسفر بشكل منفصل عن أسعار المورّدين. لا يُؤكَّد الحجز إلا بعد قبولكم الكتابي، وتقديم معلومات المسافر والمستندات المطلوبة، ووصول المبلغ المحصّل فعليًا حيث يُطلب ذلك، وتأكيد المورّد، وأي تحقق معمول به. لا يعني إيصال الدفع أو إثبات الدفع المرفوع بذاته أن الأموال قد حُصّلت فعليًا.</p></div>' +
          '<label class="quote-confirm"><input type="checkbox" data-quote-terms="' + q.id + '"> <span>I confirm I reviewed this quote and its terms.<span class="arabic-copy" lang="ar" dir="rtl">أؤكد أنني راجعت عرض السعر وشروطه.</span></span></label>' +
          '<div class="quote-actions">' +
            '<button class="btn btn-primary" type="button" data-quote-id="' + q.id + '" data-quote-updated="' + KridiyaAuth.escapeHTML(q.updated_at) + '" data-action="accepted">Accept quote / <span lang="ar" dir="rtl">قبول عرض السعر</span></button>' +
            '<button class="btn btn-outline" type="button" data-quote-id="' + q.id + '" data-quote-updated="' + KridiyaAuth.escapeHTML(q.updated_at) + '" data-action="revision">Request changes</button>' +
            '<button class="btn btn-outline" type="button" data-quote-id="' + q.id + '" data-quote-updated="' + KridiyaAuth.escapeHTML(q.updated_at) + '" data-action="declined">Decline</button>' +
          "</div></div>";
      }
      return '<div class="quote-card quote-card-done">' +
        '<div class="quote-card-head"><h4>' + KridiyaAuth.escapeHTML(displayTitle(q, index)) + '</h4><div class="quote-price">' + amount + "</div></div>" +
        (details ? '<div class="quote-details">' + details + "</div>" : "") +
        '<p class="quote-status-line">' + icon(expired ? "clock" : "check") + " " + KridiyaAuth.escapeHTML(expired ? "Quote expired" : KridiyaAuth.statusLabel(q.status)) + "</p>" +
        (expired ? '<p class="form-note">Prices or availability may have changed. Ask Kridiya for refreshed options.</p><button class="btn btn-outline btn-sm customer-recovery" type="button" data-recovery-link="enquiry:' + KridiyaAuth.escapeHTML(q.enquiry_id) + '" data-recovery-subject="Refresh expired quote" data-recovery-description="Please refresh the expired quote and confirm current price, availability and terms.">Request refreshed quote</button>' : '') + "</div>";
    }).join("") + "</div>";
  }
  function customerDocsHTML(docs) {
    if (!docs.length) return '<div class="enq-extra customer-doc-list customer-empty-list"><h4>Documents</h4><p>No customer-visible documents have been released yet.</p></div>';
    return '<div class="enq-extra customer-doc-list"><h4>Documents</h4>' + docs.map(function (d) {
      const created = d.created_at ? new Date(d.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
      const view = docPresentation(d);
      return '<div class="customer-doc-ticket doc-' + KridiyaAuth.escapeHTML(view.type) + '">' +
        '<div class="doc-ticket-mark"><span>' + KridiyaAuth.escapeHTML(view.label) + '</span></div>' +
        '<div class="doc-ticket-body"><b>' + KridiyaAuth.escapeHTML(d.file_name || view.label) + '</b>' +
        '<span>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(d.document_type || view.label)) + (created ? " / " + KridiyaAuth.escapeHTML(created) : "") + '</span>' +
        (d.external_reference ? '<small>Reference: ' + KridiyaAuth.escapeHTML(d.external_reference) + '</small>' : '') + '</div>' +
        (d.storage_path
          ? '<button class="btn btn-outline btn-sm customer-doc-download" type="button" data-document-id="' + KridiyaAuth.escapeHTML(d.id) + '" data-storage-path="' + KridiyaAuth.escapeHTML(d.storage_path) + '" data-storage-provider="' + KridiyaAuth.escapeHTML(d.storage_provider || "supabase") + '">Download</button>'
          : '<span class="customer-row-state">Released</span>') + '</div>';
    }).join("") + "</div>";
  }

  function safePaymentLink(value) {
    try { const parsed = new URL(String(value || "")); return parsed.protocol === "https:" ? parsed.href : ""; }
    catch (e) { return ""; }
  }

  function customerReceiptHTML(receipt) {
    const received = receipt.received_at ? new Date(receipt.received_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ' + KridiyaAuth.escapeHTML(receipt.receipt_number) + '</title><style>body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:42px}.head{display:flex;justify-content:space-between;border-bottom:3px solid #c9601c;padding-bottom:18px}.brand{color:#a3480f;font-size:20px;font-weight:800}.meta{text-align:right}.box{border:1px solid #eed6bd;background:#fff8f0;border-radius:10px;padding:18px;margin:20px 0}.kv{display:grid;grid-template-columns:170px 1fr;gap:9px 18px}.k{color:#777}.v{font-weight:700}.amount{font-size:28px;color:#a3480f;font-weight:800}.foot{margin-top:34px;border-top:1px solid #eee;padding-top:16px;color:#666;font-size:12px;line-height:1.6}@media print{body{padding:.45in}}</style></head><body>' +
      '<div class="head"><div><div class="brand">KRIDIYA Travel and Tourism FZ-LLC</div><p>Ras Al Khaimah, United Arab Emirates<br>Trade licence: 5033347 · info@kridiyatravel.com</p></div><div class="meta"><b>PAYMENT RECEIPT</b><h2>' + KridiyaAuth.escapeHTML(receipt.receipt_number) + '</h2></div></div>' +
      '<div class="box kv"><span class="k">Booking reference</span><span class="v">' + KridiyaAuth.escapeHTML(receipt.booking_reference) + '</span><span class="k">Booking</span><span class="v">' + KridiyaAuth.escapeHTML(receipt.booking_title || receipt.route_or_destination || "Travel service") + '</span><span class="k">Payment reference</span><span class="v">' + KridiyaAuth.escapeHTML(receipt.payment_reference) + '</span><span class="k">Payment method</span><span class="v">' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(receipt.payment_method)) + '</span><span class="k">Received</span><span class="v">' + KridiyaAuth.escapeHTML(received) + '</span></div>' +
      '<div class="box"><b>Amount received</b><div class="amount">' + KridiyaAuth.escapeHTML(money(receipt.amount, receipt.currency)) + '</div></div><div class="foot">This receipt confirms payment recorded by KRIDIYA Travel and Tourism. Keep it for your records.</div><script>window.onload=function(){window.print()}<\/script></body></html>';
  }

  function customerPaymentsHTML(payments) {
    if (!payments.length) return '<div class="enq-extra customer-payment-list customer-empty-list"><h4>Payments and refunds</h4><p>No customer payment or refund updates yet.</p></div>';
    return '<div class="enq-extra customer-payment-list"><h4>Payments and refunds</h4>' + payments.map(function (p) {
      const status = KridiyaAuth.statusLabel(p.status);
      const amount = money(p.refund_amount || p.amount, p.currency);
      const isRefund = /refund/i.test(String(p.status || "")) || p.refund_amount;
      const ref = p.refund_reference || p.payment_reference || "";
      const canUpload = !isRefund && p.payment_direction === "customer_in" && /^(pending|proof_received)$/.test(String(p.status || ""));
      const paymentUrl = !isRefund && /^(pending|proof_received)$/.test(String(p.status || "")) ? safePaymentLink(p.payment_link) : "";
      const proof = p.proof_uploaded_at ? '<small>Proof submitted ' + KridiyaAuth.escapeHTML(new Date(p.proof_uploaded_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) + ' — awaiting verification</small>' : '';
      const upload = canUpload ? '<label class="btn btn-outline btn-sm proof-upload-label">' + (p.proof_uploaded_at ? 'Replace proof' : 'Upload proof') + '<input type="file" data-customer-proof="' + KridiyaAuth.escapeHTML(p.id) + '" accept="image/jpeg,image/png,image/webp,application/pdf" hidden></label>' : '';
      const refundStages = isRefund ? [p.refund_requested_at ? "Requested " + new Date(p.refund_requested_at).toLocaleDateString("en-GB") : "", p.refund_approved_at ? "Approved " + new Date(p.refund_approved_at).toLocaleDateString("en-GB") : "", p.refund_completed_at ? "Completed " + new Date(p.refund_completed_at).toLocaleDateString("en-GB") : ""].filter(Boolean).join(" · ") : "";
      const pay = paymentUrl ? '<a class="btn btn-primary btn-sm" href="' + KridiyaAuth.escapeHTML(paymentUrl) + '" target="_blank" rel="noopener noreferrer">Pay securely</a>' : '';
      const receipt = p.receipt_document_id && p.status === "received" ? '<button class="btn btn-outline btn-sm customer-receipt" type="button" data-payment-id="' + KridiyaAuth.escapeHTML(p.id) + '">Receipt</button>' : '';
      const failed = !isRefund && /^(failed|cancelled)$/.test(String(p.status || ""));
      const recovery = failed ? '<button class="btn btn-outline btn-sm customer-recovery" type="button" data-recovery-link="booking:' + KridiyaAuth.escapeHTML(p.booking_id || "") + '" data-recovery-subject="Help with failed payment" data-recovery-description="Please help me retry or use another secure payment method for payment reference ' + KridiyaAuth.escapeHTML(p.payment_reference || "") + '.">Get payment help</button>' : '';
      return '<div class="customer-mini-row customer-payment-row"><div><b>' + (isRefund ? "Refund" : "Payment") + ": " + amount + '</b><span>' + KridiyaAuth.escapeHTML(status) + ' / ' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(p.method)) + '</span>' + (ref ? '<small>Reference: ' + KridiyaAuth.escapeHTML(ref) + '</small>' : '') + proof + (failed ? '<small>No new payment was recorded. Use the help action to request a safe retry method.</small>' : '') + (refundStages ? '<small>' + KridiyaAuth.escapeHTML(refundStages) + '</small>' : '') + (p.refund_reason ? '<small>' + KridiyaAuth.escapeHTML(p.refund_reason) + '</small>' : '') + '</div><div class="account-actions"><span class="customer-row-state">' + KridiyaAuth.escapeHTML(status) + '</span>' + pay + receipt + recovery + upload + '</div></div>';
    }).join("") + "</div>";
  }

  function tripTimelineHTML(events) {
    if (!events.length) return '<p class="form-note">No trip milestones are available yet.</p>';
    return '<ol class="trip-timeline">' + events.map(function (event) {
      const date = new Date(event.event_at);
      return '<li class="timeline-' + KridiyaAuth.escapeHTML(event.tone || "current") + '"><span></span><div><time datetime="' + KridiyaAuth.escapeHTML(event.event_at) + '">' + KridiyaAuth.escapeHTML(date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })) + '</time><b>' + KridiyaAuth.escapeHTML(event.title) + '</b><small>' + KridiyaAuth.escapeHTML(event.detail || "") + '</small></div></li>';
    }).join("") + '</ol>';
  }

  function wireEnquiryExtras(listEl) {
    if (listEl.dataset.extrasWired) return;
    listEl.dataset.extrasWired = "true";
    listEl.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-trip-timeline]");
      if (!button) return;
      const box = listEl.querySelector('[data-trip-timeline-box="' + button.dataset.tripTimeline + '"]');
      if (!box) return;
      if (!box.hidden) { box.hidden = true; button.textContent = "View trip timeline"; return; }
      box.hidden = false; button.disabled = true; button.textContent = "Loading...";
      const loading = window.KridiyaMotion ? KridiyaMotion.skeleton(box) : null;
      const result = loading ? loading.content : box;
      try { result.innerHTML = tripTimelineHTML(await KridiyaAuth.listMyBookingTimeline(button.dataset.tripTimeline)); button.textContent = "Hide trip timeline"; }
      catch (err) { result.innerHTML = '<div class="form-banner error" role="alert">' + KridiyaAuth.escapeHTML(errorMessage(err, "Could not load trip timeline.")) + '</div>'; button.textContent = "Try timeline again"; }
      if (loading) loading.reveal();
      button.disabled = false;
    });
    listEl.addEventListener("change", async function (event) {
      const input = event.target.closest("[data-customer-proof]");
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0], label = input.closest("label"), old = label.firstChild.textContent;
      input.disabled = true; label.firstChild.textContent = "Uploading...";
      try { await KridiyaAuth.uploadMyPaymentProof(input.dataset.customerProof, file); toast("Payment proof submitted for verification."); await listEl.refresh(); }
      catch (err) { input.disabled = false; input.value = ""; label.firstChild.textContent = old; toast(errorMessage(err, "Could not upload payment proof.")); }
    });
    listEl.addEventListener("click", async function (e) {
      const recoveryBtn = e.target.closest(".customer-recovery");
      if (recoveryBtn) {
        const supportForm = document.getElementById("support-request-form");
        if (!supportForm) { toast("Please contact Kridiya support for help."); return; }
        supportForm.category.value = "other";
        supportForm.urgency.value = "normal";
        supportForm.linked_item.value = recoveryBtn.dataset.recoveryLink || "";
        supportForm.subject.value = recoveryBtn.dataset.recoverySubject || "Travel support request";
        supportForm.description.value = recoveryBtn.dataset.recoveryDescription || "Please help me with this travel request.";
        supportForm.scrollIntoView({ behavior: "smooth", block: "center" });
        supportForm.description.focus({ preventScroll: true });
        toast("Review the prefilled request, then submit it to Kridiya operations.");
        return;
      }
      const receiptBtn = e.target.closest(".customer-receipt");
      if (receiptBtn) {
        receiptBtn.disabled = true;
        const oldReceiptLabel = receiptBtn.textContent;
        receiptBtn.textContent = "Preparing...";
        try {
          const receipt = await KridiyaAuth.getMyPaymentReceipt(receiptBtn.dataset.paymentId);
          const popup = window.open("", "_blank");
          if (!popup) throw new Error("Please allow pop-ups to open your receipt.");
          popup.document.open(); popup.document.write(customerReceiptHTML(receipt)); popup.document.close();
        } catch (err) { toast(errorMessage(err, "Could not open the receipt.")); }
        receiptBtn.disabled = false;
        receiptBtn.textContent = oldReceiptLabel;
        return;
      }
      const btn = e.target.closest(".customer-doc-download");
      if (!btn) return;
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = "Preparing...";
      try {
        await KridiyaAuth.openBookingDocument(btn.dataset.documentId, btn.dataset.storagePath, btn.dataset.storageProvider);
      } catch (err) {
        toast(errorMessage(err, "Could not prepare the document."));
      }
      btn.disabled = false;
      btn.textContent = old;
    });
    listEl.addEventListener("submit", async function (e) {
      const form = e.target.closest(".cust-request-form");
      if (!form) return;
      e.preventDefault();
      const id = form.dataset.requestId;
      const kind = form.dataset.kind;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        if (kind === "file") {
          const file = form.querySelector('input[type="file"]').files[0];
          if (!file) { btn.disabled = false; return; }
          await KridiyaAuth.respondToFileRequest(id, file);
        } else {
          const value = form.querySelector('input[type="text"]').value.trim();
          if (!value) { btn.disabled = false; return; }
          await KridiyaAuth.respondToTextRequest(id, value);
        }
        toast("Sent - thank you.");
        await listEl.refresh();
      } catch (err) {
        btn.disabled = false;
        toast(errorMessage(err, "Could not send your reply."));
      }
    });

    listEl.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-quote-id]");
      if (!btn) return;
      const action = btn.dataset.action;
      const terms = listEl.querySelector('[data-quote-terms="' + btn.dataset.quoteId + '"]');
      if (action === "accepted" && (!terms || !terms.checked)) { toast("Please confirm you reviewed the quote and terms before accepting."); return; }
      try {
        if (action === "revision") {
          const message = await KridiyaMotion.prompt("What would you like Kridiya to change in this quote?", btn);
          if (!message) return;
          btn.disabled = true;
          await KridiyaAuth.requestQuoteRevision(btn.dataset.quoteId, message, btn.dataset.quoteUpdated);
          toast("Revision request sent to Kridiya operations.");
        } else {
          btn.disabled = true;
          await KridiyaAuth.respondToQuote(btn.dataset.quoteId, action, btn.dataset.quoteUpdated, !!(terms && terms.checked));
          toast(action === "accepted" ? "Quote accepted." : "Quote declined.");
        }
        await listEl.refresh();
      } catch (err) {
        btn.disabled = false;
        toast(errorMessage(err, "Could not update the quote."));
      }
    });
  }

  function initCustomerSupport(bookings, enquiries) {
    const form = document.getElementById("support-request-form");
    const list = document.getElementById("support-request-list");
    if (!form || !list) return;
    const linked = form.linked_item;
    linked.innerHTML = '<option value="">Account-level request</option>' +
      bookings.map(function (b) { return '<option value="booking:' + KridiyaAuth.escapeHTML(b.id) + '">Booking ' + KridiyaAuth.escapeHTML(b.booking_reference) + '</option>'; }).join("") +
      enquiries.map(function (e) { return '<option value="enquiry:' + KridiyaAuth.escapeHTML(e.id) + '">Enquiry ' + KridiyaAuth.escapeHTML(e.reference) + '</option>'; }).join("");
    let rows = [];
    function render() {
      if (!rows.length) { list.innerHTML = '<p class="form-note">No support requests submitted from this account.</p>'; return; }
      list.innerHTML = '<div class="customer-doc-list">' + rows.map(function (r) {
        const canCancel = /^(submitted|acknowledged)$/.test(r.status);
        return '<div class="customer-doc-row"><div><b>' + KridiyaAuth.escapeHTML(r.subject) + '</b><small>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(r.category) + ' · ' + KridiyaAuth.statusLabel(r.status) + ' · ' + new Date(r.created_at).toLocaleDateString("en-GB")) + '</small>' + (r.resolution ? '<small>' + KridiyaAuth.escapeHTML(r.resolution) + '</small>' : '') + '</div>' + (canCancel ? '<button class="btn btn-outline" type="button" data-support-cancel="' + KridiyaAuth.escapeHTML(r.id) + '">Cancel</button>' : '') + '</div>';
      }).join("") + '</div>';
    }
    async function refresh() { rows = await KridiyaAuth.listMySupportRequests(); render(); }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!validateForm(form)) return;
      const parts = String(linked.value || "").split(":");
      banner(form, ""); busy(form, true, "Submitting...");
      try {
        await KridiyaAuth.createMySupportRequest({ category: form.category.value, urgency: form.urgency.value, subject: form.subject.value, description: form.description.value, bookingId: parts[0] === "booking" ? parts[1] : null, enquiryId: parts[0] === "enquiry" ? parts[1] : null });
        form.reset(); banner(form, "Your request has been sent.", "success"); await refresh();
      } catch (err) { banner(form, errorMessage(err, "Could not submit the request."), "error"); }
      busy(form, false);
    });
    list.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-support-cancel]"); if (!button) return;
      const row = rows.find(function (item) { return item.id === button.dataset.supportCancel; }); if (!row) return;
      if (!(window.KridiyaMotion && KridiyaMotion.confirm ? await KridiyaMotion.confirm("Cancel this support request?", { opener: button }) : window.confirm("Cancel this support request?"))) return;
      button.disabled = true;
      try { await KridiyaAuth.cancelMySupportRequest(row.id, row.updated_at); await refresh(); toast("Support request cancelled."); }
      catch (err) { button.disabled = false; toast(errorMessage(err, "Could not cancel the request.")); }
    });
    refresh().catch(function () { list.innerHTML = '<div class="form-banner error" role="alert">Could not load support requests.</div>'; });
  }

  if (page === "account") {
    document.addEventListener("DOMContentLoaded", async function () {
      const accountBody = document.body;
      document.getElementById("logout-btn").addEventListener("click", async function () {
        await KridiyaAuth.logout();
        location.href = "index.html";
      });

      let user;
      try { user = await KridiyaAuth.currentUser(); }
      catch (error) {
        accountBody.classList.remove("account-auth-loading");
        const host = document.querySelector("main");
        host.replaceChildren();
        const message = document.createElement("section"); message.className = "container section";
        message.innerHTML = '<h1>We could not load your account</h1><p>Please try again. Your saved details have not changed.</p><button class="btn btn-primary" type="button">Try again</button> <a class="btn btn-outline" href="contact.html">Contact support</a>';
        message.querySelector("button").addEventListener("click", () => location.reload());
        host.append(message); return;
      }
      if (!user) {
        const signedOutPhone = window.matchMedia("(max-width: 820px)").matches;
        if (signedOutPhone && (location.hash === "#support" || location.hash === "#contact-team")) {
          location.replace("contact.html");
          return;
        }
        const showBookingsGate = signedOutPhone && location.hash === "#bookings";
        if (showBookingsGate) {
          accountBody.classList.remove("account-auth-loading", "account-menu-view");
          accountBody.classList.add("account-signed-out-bookings");
          const gate = document.getElementById("signed-out-bookings");
          gate.hidden = false;
          const refresh = gate.querySelector("[data-bookings-refresh]");
          if (refresh) refresh.addEventListener("click", function () { location.reload(); });
          const bottom = document.querySelector(".account-bottom-nav");
          if (bottom) {
            bottom.querySelectorAll("a").forEach(function (link) {
              if (link.getAttribute("href") === "#bookings") link.setAttribute("aria-current", "page");
              else link.removeAttribute("aria-current");
            });
            const helpLink = bottom.querySelector('a[href="#support"]');
            const accountLink = bottom.querySelector('a[href="#account-menu"]');
            if (helpLink) helpLink.setAttribute("href", "contact.html");
            if (accountLink) accountLink.setAttribute("href", "login.html");
          }
          return;
        }
        accountBody.classList.remove("account-auth-loading");
        const accountHash = /^#[a-z-]+$/.test(location.hash) ? location.hash : "";
        location.replace("login.html?next=" + encodeURIComponent("account.html" + accountHash));
        return;
      }

      accountBody.classList.remove("account-auth-loading", "account-signed-out-bookings");
      accountBody.classList.add("account-authenticated");
      const givenName = String(user.name || "").trim().split(/\s+/)[0] || "Traveller";
      document.getElementById("acc-avatar").textContent = (user.name || "T").trim().charAt(0).toUpperCase();
      document.getElementById("acc-name").textContent = user.name;
      document.getElementById("acc-email").textContent = user.email;
      const since = user.createdAt ? new Date(user.createdAt) : null;
      const memberSince = since
        ? "Member since " + since.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : "";
      document.getElementById("acc-since").textContent = memberSince;
      document.getElementById("acc-given-name").textContent = givenName;
      document.getElementById("acc-head-since").textContent = memberSince;
      refreshHeaderName(user);
      if (new URLSearchParams(location.search).get("claimed") === "1") {
        toast("Enquiry connected to your verified account.");
        history.replaceState(null, "", "account.html");
      }

      const travellerForm = document.getElementById("traveller-form");
      const travellerList = document.getElementById("traveller-list");
      const travellerPanel = document.getElementById("travellers");
      const travellerAdd = document.getElementById("add-traveller-btn");
      const travellerAddActions = document.querySelector(".traveller-add-actions");
      const travellerAddLabel = travellerAdd && travellerAdd.querySelector("[data-traveller-add-label]");
      const travellerCancel = document.getElementById("traveller-cancel");
      let savedTravellers = [];
      function updateTravellerAddLabel() {
        if (travellerAddLabel) travellerAddLabel.textContent = savedTravellers.length ? "Add another traveller" : "Add traveller";
      }
      function syncTravellerLayoutState() {
        if (travellerPanel) travellerPanel.classList.toggle("traveller-empty-closed", !savedTravellers.length && travellerForm.hidden);
      }
      function resetTravellerForm() {
        travellerForm.reset();
        travellerForm.querySelectorAll(".date-field").forEach(function (field) { if (field._dateSet) field._dateSet("", true); });
        travellerForm.traveller_id.value = "";
        travellerForm.expected_updated_at.value = "";
        travellerCancel.hidden = true;
        banner(travellerForm, "");
      }
      function revealTravellerForm() {
        travellerForm.hidden = false;
        travellerCancel.hidden = false;
        if (travellerAddActions) travellerAddActions.hidden = true;
        if (travellerAdd) travellerAdd.setAttribute("aria-expanded", "true");
        syncTravellerLayoutState();
      }
      function concealTravellerForm(restoreFocus) {
        resetTravellerForm();
        travellerForm.hidden = true;
        if (!travellerAdd) return;
        travellerAdd.setAttribute("aria-expanded", "false");
        if (travellerAddActions) travellerAddActions.hidden = false;
        syncTravellerLayoutState();
        if (restoreFocus) travellerAdd.focus({ preventScroll: true });
      }
      function renderTravellers() {
        updateTravellerAddLabel();
        if (travellerAddActions && travellerForm.hidden) travellerAddActions.hidden = false;
        syncTravellerLayoutState();
        if (!savedTravellers.length) {
          travellerList.innerHTML = '<div class="empty-state"><p><b>No saved travellers yet.</b><br>Add yourself or a frequent traveller below.</p></div>';
          return;
        }
        travellerList.innerHTML = '<div class="customer-doc-list">' + savedTravellers.map(function (t) {
          const details = [t.date_of_birth ? "Born " + t.date_of_birth : "", t.nationality || "", t.passport_masked || "No passport saved", t.passport_expiry ? "Expires " + t.passport_expiry : ""].filter(Boolean).join(" · ");
          return '<div class="customer-doc-row"><div><b>' + KridiyaAuth.escapeHTML(t.full_name) + '</b><small>' + KridiyaAuth.escapeHTML(details) + '</small></div><div class="account-actions"><button class="btn btn-outline" type="button" data-traveller-edit="' + KridiyaAuth.escapeHTML(t.id) + '">Edit</button><button class="btn btn-outline" type="button" data-traveller-archive="' + KridiyaAuth.escapeHTML(t.id) + '">Remove</button></div></div>';
        }).join("") + "</div>";
      }
      async function refreshTravellers() {
        savedTravellers = await KridiyaAuth.listMyTravellers();
        renderTravellers();
      }
      travellerList.addEventListener("click", async function (event) {
        const edit = event.target.closest("[data-traveller-edit]");
        const archive = event.target.closest("[data-traveller-archive]");
        const id = edit ? edit.dataset.travellerEdit : archive ? archive.dataset.travellerArchive : "";
        const row = savedTravellers.find(function (item) { return item.id === id; });
        if (!row) return;
        if (edit) {
          revealTravellerForm();
          travellerForm.traveller_id.value = row.id;
          travellerForm.expected_updated_at.value = row.updated_at;
          travellerForm.full_name.value = row.full_name || "";
          if (travellerForm.date_of_birth.closest(".date-field")._dateSet) travellerForm.date_of_birth.closest(".date-field")._dateSet(row.date_of_birth || "", true);
          else travellerForm.date_of_birth.value = row.date_of_birth || "";
          travellerForm.nationality.value = row.nationality || "";
          travellerForm.passport_number.value = "";
          if (travellerForm.passport_expiry.closest(".date-field")._dateSet) travellerForm.passport_expiry.closest(".date-field")._dateSet(row.passport_expiry || "", true);
          else travellerForm.passport_expiry.value = row.passport_expiry || "";
          travellerForm.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (!(window.KridiyaMotion && KridiyaMotion.confirm ? await KridiyaMotion.confirm("Remove " + row.full_name + " from your saved travellers?", { opener: archive }) : window.confirm("Remove " + row.full_name + " from your saved travellers?"))) return;
        try {
          await KridiyaAuth.archiveMyTraveller(row.id, row.updated_at);
          await refreshTravellers();
          concealTravellerForm(true);
          toast("Traveller removed.");
        } catch (err) { toast(errorMessage(err, "Could not remove traveller.")); }
      });
      travellerCancel.addEventListener("click", function () { concealTravellerForm(true); });
      if (travellerAdd) {
        travellerAdd.addEventListener("click", function () {
          resetTravellerForm();
          revealTravellerForm();
          travellerForm.scrollIntoView({ behavior: "smooth", block: "center" });
          requestAnimationFrame(function () {
            travellerForm.full_name.focus({ preventScroll: true });
          });
        });
      }
      travellerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!validateForm(travellerForm)) return;
        banner(travellerForm, "");
        busy(travellerForm, true, "Saving...");
        try {
          await KridiyaAuth.saveMyTraveller({
            id: travellerForm.traveller_id.value,
            expectedUpdatedAt: travellerForm.expected_updated_at.value,
            fullName: travellerForm.full_name.value,
            dateOfBirth: travellerForm.date_of_birth.value,
            nationality: travellerForm.nationality.value,
            passportNumber: travellerForm.passport_number.value,
            passportExpiry: travellerForm.passport_expiry.value
          });
          await refreshTravellers();
          concealTravellerForm(true);
          toast("Traveller saved.");
        } catch (err) { banner(travellerForm, errorMessage(err, "Could not save traveller."), "error"); }
        busy(travellerForm, false);
      });
      try { await refreshTravellers(); } catch (err) {
        travellerList.innerHTML = '<div class="form-banner error" role="alert">Could not load saved travellers.</div>';
        if (travellerAddActions) travellerAddActions.hidden = false;
      }

      const listEl = document.getElementById("enq-list");
      const paymentList = document.getElementById("account-payment-list");
      const refreshTravel = document.getElementById("refresh-travel");
      const accountStats = document.querySelector(".account-side-stats");
      const accountTotalsStatus = document.querySelector("[data-account-totals-status]");
      const travelLoadingStatus = document.getElementById("travel-loading-status");
      const travelSkeletonHTML = '<div class="account-travel-skeleton enq-item" aria-hidden="true">' +
        '<div class="account-skeleton-top"><span class="account-skeleton-shape account-skeleton-chip"></span><span class="account-skeleton-shape account-skeleton-title"></span><span class="account-skeleton-shape account-skeleton-date"></span></div>' +
        '<div class="account-skeleton-status"><span class="account-skeleton-shape"></span><span class="account-skeleton-shape"></span></div>' +
        '<div class="account-skeleton-facts">' +
          '<span><i class="account-skeleton-shape"></i><i class="account-skeleton-shape"></i></span>' +
          '<span><i class="account-skeleton-shape"></i><i class="account-skeleton-shape"></i></span>' +
          '<span><i class="account-skeleton-shape"></i><i class="account-skeleton-shape"></i></span>' +
          '<span class="account-skeleton-detail"><i class="account-skeleton-shape"></i><i class="account-skeleton-shape"></i></span>' +
        '</div></div>';
      function setTravelLoadingState() {
        listEl.dataset.loaded = "false";
        listEl.innerHTML = travelSkeletonHTML;
        listEl.setAttribute("aria-busy", "true");
        if (travelLoadingStatus) travelLoadingStatus.textContent = "Loading your bookings and enquiries.";
        if (accountStats) accountStats.setAttribute("aria-busy", "true");
        if (accountTotalsStatus) accountTotalsStatus.textContent = "Loading your travel totals.";
        document.querySelectorAll("[data-account-total]").forEach(function (node) {
          node.textContent = "";
          node.classList.add("account-total-skeleton");
          node.setAttribute("aria-hidden", "true");
          node.removeAttribute("aria-label");
        });
        if (refreshTravel) {
          refreshTravel.hidden = true;
          refreshTravel.disabled = true;
        }
        document.dispatchEvent(new CustomEvent("kridiya:travel-updated"));
      }
      function setTravelTotals(totals) {
        document.querySelectorAll("[data-account-total]").forEach(function (node) {
          node.textContent = String(totals[node.dataset.accountTotal]);
          node.classList.remove("account-total-skeleton");
          node.removeAttribute("aria-hidden");
          node.removeAttribute("aria-label");
        });
        if (accountStats) accountStats.setAttribute("aria-busy", "false");
        if (accountTotalsStatus) accountTotalsStatus.textContent = "Travel totals loaded.";
      }
      function setTravelTotalsUnavailable() {
        document.querySelectorAll("[data-account-total]").forEach(function (node) {
          node.textContent = "—";
          node.classList.remove("account-total-skeleton");
          node.removeAttribute("aria-hidden");
          node.setAttribute("aria-label", "Unavailable");
        });
        if (accountStats) accountStats.setAttribute("aria-busy", "false");
        if (accountTotalsStatus) accountTotalsStatus.textContent = "Travel totals unavailable.";
      }
      let supportInitialized = false;
      let travelLoading = false;
      listEl.refresh = async function () {
      if (travelLoading) return;
      travelLoading = true;
      const oldFocus = document.activeElement;
      const restoreListFocus = listEl.contains(oldFocus);
      const oldScroll = window.scrollY;
      setTravelLoadingState();
      paymentList.setAttribute("aria-busy", "true");
      try {
        let results = await Promise.all([
          KridiyaAuth.listBookings(),
          KridiyaAuth.listEnquiries(),
          KridiyaAuth.listRequests(),
          KridiyaAuth.listQuotes(),
          KridiyaAuth.listBookingDocuments()
        ]);
        const bookings = results[0];
        const enquiries = results[1];
        if (!supportInitialized) { initCustomerSupport(bookings, enquiries); supportInitialized = true; }
        const docs = results[4] || [];
        const payments = await KridiyaAuth.listCustomerPayments(
          bookings.map(function (b) { return b.id; }),
          enquiries.map(function (e) { return e.id; })
        );
        const requestsByEnquiry = {};
        results[2].forEach(function (r) {
          if (!requestsByEnquiry[r.enquiry_id]) requestsByEnquiry[r.enquiry_id] = [];
          requestsByEnquiry[r.enquiry_id].push(r);
        });
        const quotesByEnquiry = {};
        results[3].forEach(function (q) {
          if (!quotesByEnquiry[q.enquiry_id]) quotesByEnquiry[q.enquiry_id] = [];
          quotesByEnquiry[q.enquiry_id].push(q);
        });
        const docsByBooking = {};
        docs.forEach(function (d) {
          if (!docsByBooking[d.booking_id]) docsByBooking[d.booking_id] = [];
          docsByBooking[d.booking_id].push(d);
        });
        const paymentsByBooking = {};
        const paymentsByEnquiry = {};
        payments.forEach(function (p) {
          if (p.booking_id) {
            if (!paymentsByBooking[p.booking_id]) paymentsByBooking[p.booking_id] = [];
            paymentsByBooking[p.booking_id].push(p);
          }
          if (p.enquiry_id) {
            if (!paymentsByEnquiry[p.enquiry_id]) paymentsByEnquiry[p.enquiry_id] = [];
            paymentsByEnquiry[p.enquiry_id].push(p);
          }
        });

        const activeQuotes = results[3].filter(function (q) {
          return !/declined|expired|cancelled/i.test(String(q.status || "")) && (!q.valid_until || new Date(q.valid_until).getTime() > Date.now());
        });

        const combined = enquiries.map(function (e) {
          return {
            id: e.id,
            isEnquiry: true,
            reference: e.reference,
            status: e.status,
            title: KridiyaAuth.statusLabel(e.service_type) + " enquiry",
            detail: e.summary,
            paxLabel: "",
            amount: "Quote pending",
            created_at: e.created_at
          };
        }).concat(bookings.map(function (booking) {
          const pax = (booking.adults || 0) + (booking.children || 0) + (booking.infants || 0);
          return {
            id: booking.id,
            isEnquiry: false,
            reference: booking.booking_reference,
            status: booking.status,
            title: booking.title,
            detail: booking.route_or_destination || booking.service_type,
            paxLabel: pax ? pax + " traveller" + (pax === 1 ? "" : "s") : "",
            amount: booking.amount ? (booking.currency + " " + Number(booking.amount).toLocaleString("en-GB")) : "Quote pending",
            paymentStatus: booking.payment_status,
            documentStatus: booking.document_status,
            created_at: booking.created_at
          };
        })).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });

        const totals = { bookings: bookings.length, enquiries: enquiries.length, quotes: activeQuotes.length };
        setTravelTotals(totals);
        function renderTravelItem(item) {
            const created = new Date(item.created_at);
            const requests = item.isEnquiry ? (requestsByEnquiry[item.id] || []) : [];
            const quotes = item.isEnquiry ? (quotesByEnquiry[item.id] || []) : [];
            const itemDocs = item.isEnquiry ? [] : (docsByBooking[item.id] || []);
            const itemPayments = item.isEnquiry ? (paymentsByEnquiry[item.id] || []) : (paymentsByBooking[item.id] || []);
            const itemType = item.isEnquiry ? "Enquiry" : "Booking";
            const attention = requests.length ? "Needs your reply" : quotes.length ? "Quote ready" : itemDocs.length ? "Documents released" : itemPayments.length ? "Payment updated" : "In progress";
            const detailText = item.detail || "Team will update";
            return '<article class="enq-item" data-travel-kind="' + (item.isEnquiry ? 'enquiry' : 'booking') + '">' +
              '<div class="enq-top"><div><span class="account-chip">' + KridiyaAuth.escapeHTML(itemType) + '</span><b>' + KridiyaAuth.escapeHTML(item.title || item.reference || itemType) + "</b></div>" +
              '<time datetime="' + KridiyaAuth.escapeHTML(item.created_at) + '">' +
              created.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) +
              "</time></div>" +
              '<div class="customer-status-strip"><span>' + KridiyaAuth.escapeHTML(attention) + '</span><small>' + KridiyaAuth.escapeHTML(item.reference || "Reference pending") + '</small></div>' +
              '<div class="account-item-grid">' +
                '<span class="account-fact"><small>Reference</small><b>' + KridiyaAuth.escapeHTML(item.reference || "Pending") + '</b></span>' +
                '<span class="account-fact"><small>Status</small><b>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(item.status)) + '</b></span>' +
                '<span class="account-fact account-fact-amount"><small>Amount</small><b>' + KridiyaAuth.escapeHTML(item.amount) + '</b></span>' +
                (item.paxLabel ? '<span class="account-fact"><small>Travellers</small><b>' + KridiyaAuth.escapeHTML(item.paxLabel) + '</b></span>' : "") +
                (item.paymentStatus ? '<span class="account-fact"><small>Payment</small><b>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(item.paymentStatus)) + '</b></span>' : "") +
                (item.documentStatus ? '<span class="account-fact"><small>Documents</small><b>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(item.documentStatus)) + '</b></span>' : "") +
                '<span class="account-detail"><small>Details</small><b>' + KridiyaAuth.escapeHTML(detailText) + '</b></span>' +
              '</div>' +
              ((requests.length || quotes.length || itemDocs.length || itemPayments.length) ? '<div class="account-item-alerts">' +
                (requests.length ? '<span>' + KridiyaAuth.escapeHTML(String(requests.length)) + ' request(s)</span>' : '') +
                (quotes.length ? '<span>' + KridiyaAuth.escapeHTML(String(quotes.length)) + ' quote(s)</span>' : '') +
                (itemDocs.length ? '<span>' + KridiyaAuth.escapeHTML(String(itemDocs.length)) + ' document(s)</span>' : '') +
                (itemPayments.length ? '<span>' + KridiyaAuth.escapeHTML(String(itemPayments.length)) + ' payment/refund update(s)</span>' : '') +
              '</div>' : '') +
              requestsHTML(requests) +
              quotesHTML(quotes) +
              (!item.isEnquiry ? customerDocsHTML(itemDocs) : '') +
              customerPaymentsHTML(itemPayments) +
              (!item.isEnquiry ? '<div class="enq-extra trip-timeline-wrap"><button class="btn btn-outline btn-sm" type="button" data-trip-timeline="' + KridiyaAuth.escapeHTML(item.id) + '">View trip timeline</button><div data-trip-timeline-box="' + KridiyaAuth.escapeHTML(item.id) + '" hidden></div></div>' : '') +
              "</article>";
        }
        listEl.innerHTML = combined.length ? combined.map(renderTravelItem).join("")
          : '<div class="empty-state"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12h-4a3 3 0 0 1-6 0H5V5h14v10z"/></svg><p><b>No bookings linked yet.</b><br>Send an enquiry while signed in, or ask our team to attach an existing booking to this account.</p><div class="empty-actions"><a class="btn btn-primary" href="index.html">Start planning</a><a class="btn btn-outline" href="https://wa.me/971509413873" target="_blank" rel="noopener">WhatsApp support</a></div></div>';
        if (travelLoadingStatus) travelLoadingStatus.textContent = "Bookings and enquiries loaded.";
        listEl.dataset.loaded = "true";
        paymentList.innerHTML = customerPaymentsHTML(payments);
        paymentList.refresh = listEl.refresh;
        wireEnquiryExtras(paymentList);
        wireEnquiryExtras(listEl);
      } catch (err) {
        listEl.dataset.loaded = "false";
        listEl.innerHTML = '<div class="form-banner error" role="alert">Could not load your travel: ' + KridiyaAuth.escapeHTML(errorMessage(err, "Please try again.")) + '</div><button type="button" class="btn btn-outline" data-retry-travel>Try again</button>';
        paymentList.innerHTML = '<div class="form-banner error" role="alert">Could not load payment records. Please try again.</div><button type="button" class="btn btn-outline" data-retry-travel>Try again</button>';
        if (travelLoadingStatus) travelLoadingStatus.textContent = "Bookings and enquiries could not be loaded.";
        setTravelTotalsUnavailable();
      } finally {
        travelLoading = false;
        listEl.setAttribute("aria-busy", "false");
        paymentList.setAttribute("aria-busy", "false");
        if (refreshTravel) {
          refreshTravel.hidden = false;
          refreshTravel.disabled = false;
        }
        document.dispatchEvent(new CustomEvent("kridiya:travel-updated"));
      }

      if (restoreListFocus) {
        listEl.tabIndex = -1; listEl.focus({ preventScroll: true });
        window.scrollTo({ top: oldScroll, behavior: "instant" });
      }
      };
      document.querySelector('.account-content-stack').addEventListener('click', function (event) {
        if (event.target.closest('[data-retry-travel]')) listEl.refresh();
      });
      if (refreshTravel) refreshTravel.addEventListener("click", function () { listEl.refresh(); });
      await listEl.refresh();

      const pf = document.getElementById("profile-form");
      pf.name.value = user.name || "";
      pf.phone.value = user.phone || "";
      const profileEmail = document.getElementById("pf-email");
      if (profileEmail) profileEmail.value = user.email || "";
      pf.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!validateForm(pf)) return;
        const btn = pf.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Saving…";
        banner(pf, "");
        try {
          const updated = await KridiyaAuth.updateProfile(user.email, { name: pf.name.value, phone: pf.phone.value });
          toast("Profile updated.");
          banner(pf, "Your details have been saved.", "success");
          document.getElementById("acc-name").textContent = updated.name;
          document.getElementById("acc-avatar").textContent = updated.name.trim().charAt(0).toUpperCase();
          document.getElementById("acc-given-name").textContent = String(updated.name || "").trim().split(/\s+/)[0] || "Traveller";
          refreshHeaderName(updated);
        } catch (err) {
          banner(pf, errorMessage(err, "Could not update your profile. Please try again."), "error");
        }
        btn.disabled = false;
        btn.textContent = "Save changes";
      });

      const nf = document.getElementById("notification-form");
      const communicationHistory = document.getElementById("communication-history");
      function renderCommunicationHistory(rows) {
        if (!rows.length) { communicationHistory.innerHTML = '<p class="form-note">No portal communications have been recorded yet.</p>'; return; }
        communicationHistory.innerHTML = '<div class="customer-doc-list">' + rows.map(function (row) {
          const at = row.delivered_at || row.sent_at || row.available_at;
          return '<div class="customer-doc-row"><div><b>' + KridiyaAuth.escapeHTML(row.subject) + '</b><small>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(row.category) + ' · ' + KridiyaAuth.statusLabel(row.channel) + ' · ' + new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })) + '</small></div><span class="customer-row-state">' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(row.delivery_status)) + '</span></div>';
        }).join("") + '</div>';
      }
      try {
        const notificationData = await Promise.all([KridiyaAuth.getMyNotificationPreferences(), KridiyaAuth.listMyCommunicationHistory(), KridiyaAuth.listMyTravelDisruptions()]);
        const prefs = notificationData[0];
        nf.email_enabled.checked = prefs.email_enabled !== false; nf.whatsapp_enabled.checked = prefs.whatsapp_enabled !== false;
        nf.booking_updates.checked = prefs.booking_updates !== false; nf.payment_updates.checked = prefs.payment_updates !== false;
        nf.document_updates.checked = prefs.document_updates !== false; nf.support_updates.checked = prefs.support_updates !== false;
        nf.marketing_email.checked = prefs.marketing_email === true; renderCommunicationHistory(notificationData[1]);
        if (window.KridiyaMotion && KridiyaMotion.syncChoices) KridiyaMotion.syncChoices(nf);
        const disruptionBox=document.getElementById("travel-disruption-updates"),disruptions=notificationData[2]||[];
        disruptionBox.innerHTML=disruptions.length?'<div class="customer-doc-list">'+disruptions.map(function(d){return '<div class="customer-doc-row"><div><b>'+KridiyaAuth.escapeHTML(d.title)+' — '+KridiyaAuth.escapeHTML(d.booking_reference)+'</b><small>'+KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(d.severity)+' · '+KridiyaAuth.statusLabel(d.status)+' · Next update '+(d.next_update_at?new Date(d.next_update_at).toLocaleString("en-GB"):"to be confirmed"))+'</small>'+(d.updates||[]).map(function(u){return '<p>'+KridiyaAuth.escapeHTML(u.message)+'</p>';}).join('')+'</div><span class="customer-row-state">'+KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(d.impact_status))+'</span></div>';}).join('')+'</div>':'<p class="form-note">No active travel disruption affects your bookings.</p>';
      } catch (err) { communicationHistory.innerHTML = '<div class="form-banner error" role="alert">Could not load communication settings.</div>'; }
      nf.addEventListener("submit", async function (event) {
        event.preventDefault(); busy(nf, true, "Saving..."); banner(nf, "");
        try { await KridiyaAuth.saveMyNotificationPreferences({ emailEnabled:nf.email_enabled.checked, whatsappEnabled:nf.whatsapp_enabled.checked, bookingUpdates:nf.booking_updates.checked, paymentUpdates:nf.payment_updates.checked, documentUpdates:nf.document_updates.checked, supportUpdates:nf.support_updates.checked, marketingEmail:nf.marketing_email.checked }); banner(nf, "Notification settings saved.", "success"); }
        catch (err) { banner(nf, errorMessage(err, "Could not save notification settings."), "error"); }
        busy(nf, false);
      });

      const pwf = document.getElementById("password-form");
      initPwToggles(pwf);
      pwf.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!validateForm(pwf)) return;
        const issue = KridiyaAuth.passwordIssue(pwf.newpass.value);
        if (issue) {
          setFieldError(pwf.newpass, issue);
          return;
        }
        banner(pwf, "");
        busy(pwf, true, "Updating...");
        try {
          await KridiyaAuth.changePassword(user.email, pwf.current.value, pwf.newpass.value);
          banner(pwf, "Password updated successfully.", "success");
          pwf.reset();
        } catch (err) {
          banner(pwf, errorMessage(err, "Could not update your password."), "error");
        }
        busy(pwf, false);
      });

    });
  }

  if (page === "corporate-account") {
    document.addEventListener("DOMContentLoaded", async function () {
      const user = await KridiyaAuth.currentUser();
      if (!user) {
        location.replace("login.html?next=corporate-account.html");
        return;
      }
      const gate = document.getElementById("corporate-account-gate");
      const app = document.getElementById("corporate-account-app");
      try {
        const companies = await KridiyaAuth.getMyCorporatePortal();
        if (!companies.length) {
          gate.innerHTML =
            '<div class="form-banner error" role="alert"><b>Corporate portal not activated yet.</b><br>Kridiya must approve your company and link your login before private company records appear here. You can still send a request below.</div>' +
            '<p><a class="btn btn-primary" href="corporate-booking.html">Send corporate request</a> <a class="btn btn-outline" href="https://wa.me/971509413873?text=Hello%20Kridiya%20Travel!%20Please%20activate%20my%20corporate%20portal%20access." target="_blank" rel="noopener">WhatsApp support</a></p>';
          return;
        }
        const activeCompany = companies[0];
        const bookings = await KridiyaAuth.listMyCorporateBookings(activeCompany.corporate_account_id);
        renderCorporatePortal(companies, bookings, activeCompany);
        initCorporatePortalRequest(activeCompany, function () {
          return KridiyaAuth.listMyCorporateBookings(activeCompany.corporate_account_id).then(function (fresh) {
            renderCorporatePortal(companies, fresh, activeCompany);
          });
        });
        gate.hidden = true;
        app.hidden = false;
      } catch (err) {
        gate.innerHTML = '<div class="form-banner error" role="alert">Could not load corporate portal yet: ' + KridiyaAuth.escapeHTML(errorMessage(err, "Please refresh and try again.")) + "</div>";
      }
    });
  }

  function renderCorporatePortal(companies, bookings, activeCompany) {
    const companyList = document.getElementById("corp-company-list");
    const bookingList = document.getElementById("corp-booking-list");
    document.getElementById("corp-visible-items").textContent = String(bookings.length);
    document.getElementById("corp-company-count").textContent = String(companies.length);
    document.getElementById("corp-company-name").textContent = activeCompany.company_name || "Approved company";
    document.getElementById("corp-member-role").textContent = KridiyaAuth.statusLabel(activeCompany.member_role || "Member");
    document.getElementById("corp-access-copy").textContent =
      (activeCompany.company_name || "Your company") + " is linked to this login. You can see portal-safe company booking status and create new requests.";

    companyList.innerHTML = companies.map(function (company) {
      const chips = [
        company.can_request ? "Can request" : "Request locked",
        company.can_approve_quotes ? "Can approve quotes" : "Approval by staff/company admin",
        company.can_view_finance ? "Finance visible" : "Finance hidden",
        company.lpo_required ? "LPO required" : "No LPO flag"
      ];
      return '<div class="corporate-company-card">' +
        '<b>' + KridiyaAuth.escapeHTML(company.company_name || "Company") + '</b>' +
        '<p>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(company.member_role || "member")) + ' access · ' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(company.status || "active")) + '</p>' +
        '<div>' + chips.map(function (chip) { return '<span>' + KridiyaAuth.escapeHTML(chip) + '</span>'; }).join("") + '</div>' +
      '</div>';
    }).join("");

    if (!bookings.length) {
      bookingList.innerHTML = '<div class="empty-state"><p>No corporate bookings are visible yet. Submit your first portal request or ask Kridiya to link existing company bookings.</p></div>';
      return;
    }

    bookingList.innerHTML = bookings.map(function (booking) {
      const amount = booking.amount ? '<strong>' + KridiyaAuth.escapeHTML(String(booking.currency || "AED")) + ' ' + KridiyaAuth.escapeHTML(String(booking.amount)) + '</strong>' : '<span>Finance restricted</span>';
      return '<article class="corporate-booking-card">' +
        '<div><b>' + KridiyaAuth.escapeHTML(booking.booking_reference || "Corporate request") + '</b><span>' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(booking.status)) + '</span></div>' +
        '<h3>' + KridiyaAuth.escapeHTML(booking.title || KridiyaAuth.statusLabel(booking.service_type)) + '</h3>' +
        '<p>' + KridiyaAuth.escapeHTML([booking.service_type, booking.route_or_destination].filter(Boolean).map(KridiyaAuth.statusLabel).join(" · ") || "Corporate travel request") + '</p>' +
        '<footer><small>Payment: ' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(booking.payment_status || "not_requested")) + '</small><small>Docs: ' + KridiyaAuth.escapeHTML(KridiyaAuth.statusLabel(booking.document_status || "not_started")) + '</small>' + amount + '</footer>' +
      '</article>';
    }).join("");
  }

  function initCorporatePortalRequest(activeCompany, refresh) {
    const form = document.getElementById("corp-portal-request-form");
    if (!form || form.dataset.ready === "true") return;
    form.dataset.ready = "true";
    if (!activeCompany.can_request) {
      form.innerHTML = '<div class="form-banner error" role="alert">Your login can view this company, but request creation is not enabled. Ask Kridiya admin to enable request access.</div>';
      return;
    }
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!validateForm(form)) return;
      banner(form, "");
      busy(form, true, "Submitting...");
      try {
        await KridiyaAuth.createMyCorporateRequest({
          corporateAccountId: activeCompany.corporate_account_id,
          serviceType: form.service.value,
          title: form.title.value,
          route: form.route.value,
          travelStart: form.start.value,
          travelEnd: form.end.value,
          notes: form.notes.value
        });
        banner(form, "Corporate request submitted. Kridiya admin can now see it under your company.", "success");
        form.reset();
        if (typeof refresh === "function") await refresh();
      } catch (err) {
        banner(form, errorMessage(err, "Could not submit corporate request."), "error");
      }
      busy(form, false);
    });
  }

  if (page === "reset-password") {
    document.addEventListener("DOMContentLoaded", async function () {
      const form = document.getElementById("reset-password-form");
      initPwToggles(form);
      const linkError = authLinkError();
      if (linkError) banner(form, linkError, "error");
      KridiyaAuth.client().catch(function () {});
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        const issue = KridiyaAuth.passwordIssue(form.password.value);
        if (issue) {
          setFieldError(form.password, issue);
          return;
        }
        if (form.password.value !== form.confirm.value) {
          setFieldError(form.confirm, "Passwords do not match.");
          form.confirm.focus();
          return;
        }
        banner(form, "");
        busy(form, true, "Saving...");
        try {
          await KridiyaAuth.completePasswordReset(form.password.value);
          banner(form, "Password updated. Taking you to your account...", "success");
          setTimeout(function () { location.href = "account.html"; }, 1000);
        } catch (err) {
          banner(form, errorMessage(err, "Could not update your password."), "error");
          busy(form, false);
        }
      });
    });
  }

  if (page === "forgot-password") {
    document.addEventListener("DOMContentLoaded", async function () {
      const form = document.getElementById("forgot-password-form");
      try { await KridiyaAuth.client(); } catch (e) {}
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!validateForm(form)) return;
        banner(form, "");
        busy(form, true, "Sending...");
        try {
          await KridiyaAuth.resetPassword(form.email.value);
          banner(form, "Password reset email sent. Check your inbox and use the newest link.", "success");
          form.reset();
        } catch (err) {
          banner(form, errorMessage(err, "Could not send the password reset email. Please try again."), "error");
        }
        busy(form, false);
      });
    });
  }
})();

window.__KRIDIYA_AUTH_RUNTIME_READY__ = true;
