"use strict";

(function () {
  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && location.hostname !== "corporate.kridiyatravel.com") {
    const canonical = new URL("https://corporate.kridiyatravel.com/corporate-invitation.html");
    const legacyToken = new URLSearchParams(location.search).get("token");
    if (legacyToken) canonical.searchParams.set("token", legacyToken);
    location.replace(canonical.href);
    return;
  }
  const form = document.getElementById("invitation-auth-form");
  const token = new URLSearchParams(location.search).get("token") || "";
  const status = document.getElementById("invitation-status");
  const signedIn = document.getElementById("invitation-signed-in");
  const submit = form.querySelector('button[type="submit"]');

  function show(message, kind) {
    status.hidden = !message;
    status.textContent = message || "";
    status.className = "form-banner " + (kind || "error");
  }

  function busy(on, label) {
    submit.disabled = on;
    if (window.KridiyaMotion && KridiyaMotion.label) KridiyaMotion.label(submit, on ? label : submit.dataset.label, on);
    else submit.textContent = on ? label : submit.dataset.label;
  }

  function readable(error, fallback) {
    const message = error && (error.message || error.details || error.hint);
    return String(message || fallback);
  }

  async function accept() {
    if (!token) {
      show("This invitation link is incomplete. Ask your Kridiya reviewer to resend it.");
      return false;
    }
    const client = await KridiyaAuth.client();
    const result = await client.rpc("accept_corporate_portal_invitation", { p_token: token });
    if (result.error) throw result.error;
    if (!result.data || result.data.ok !== true) {
      show(result.data && result.data.status === "expired" ? "This invitation has expired. Ask your reviewer to resend it." : "This invitation cannot be accepted.");
      return false;
    }
    show("Invitation accepted. Your company membership is active.", "success");
    form.hidden = true;
    form.style.display = "none";
    signedIn.hidden = false;
    signedIn.style.display = "grid";
    signedIn.innerHTML = '<a class="btn btn-primary btn-block" href="corporate-account.html">Open company portal</a>';
    return true;
  }

  async function initialize() {
    try {
      const user = await KridiyaAuth.currentUser();
      if (user) {
        signedIn.hidden = false;
        signedIn.style.display = "grid";
        signedIn.textContent = "Signed in as " + user.email + ". Verifying your invitation…";
        form.hidden = true;
        form.style.display = "none";
        await accept();
      }
    } catch (error) {
      show(readable(error, "Could not verify your invitation."));
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    show("");
    busy(true, "Signing in…");
    try {
      await KridiyaAuth.login(form.email.value, form.password.value);
      await accept();
    } catch (error) {
      show(readable(error, "Could not sign in or accept this invitation."));
    } finally {
      busy(false);
    }
  });

  initialize();
})();
