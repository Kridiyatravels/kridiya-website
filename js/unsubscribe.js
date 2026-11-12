"use strict";

(function () {
  const form = document.getElementById("unsubscribe-form");
  const status = document.getElementById("unsubscribe-status");
  const heading = document.getElementById("unsubscribe-heading");
  const intro = document.getElementById("unsubscribe-intro");
  const farewell = document.getElementById("unsubscribe-farewell");
  const another = document.getElementById("unsubscribe-another");
  const home = document.getElementById("unsubscribe-home");
  if (!form || !status || !heading || !intro || !farewell || !another || !home) return;

  const arabic = document.documentElement.lang === "ar";
  const copy = arabic ? {
    title: "إلغاء الاشتراك في عروض السفر",
    intro: "أدخل عنوان بريدك الإلكتروني لإيقاف استلام عروض كريديا للسفر.",
    confirmed: "تم إلغاء اشتراكك",
    stopped: "لن تتلقى عروض السفر من كريديا عبر البريد الإلكتروني بعد الآن.",
    farewell: "شكراً لتواصلك مع كريديا. نتمنى لك رحلات سعيدة.",
    inbox: "تحقق من بريدك الإلكتروني",
    confirm: "استخدم رابط التأكيد لإتمام إلغاء الاشتراك. تنتهي صلاحية الرابط خلال 24 ساعة.",
    sending: "جارٍ طلب رابط التأكيد…",
    confirming: "جارٍ تأكيد إلغاء الاشتراك…",
    invalid: "رابط إلغاء الاشتراك غير صالح أو منتهي الصلاحية. أدخل بريدك الإلكتروني لطلب رابط جديد.",
    error: "تعذر تحديث تفضيلاتك. يرجى المحاولة مجدداً أو مراسلتنا على deals@kridiyatravel.com.",
    another: "استخدام عنوان بريد إلكتروني آخر",
    home: "العودة إلى كريديا"
  } : {
    title: "Unsubscribe from travel offers",
    intro: "Enter the email address to stop receiving Kridiya Travel offers.",
    confirmed: "You’re unsubscribed",
    stopped: "You’ll no longer receive Kridiya travel offers by email.",
    farewell: "Thank you for staying in touch with Kridiya. Wishing you happy travels.",
    inbox: "Check your inbox",
    confirm: "Use the confirmation link to finish unsubscribing. It expires in 24 hours.",
    sending: "Requesting your confirmation link…",
    confirming: "Confirming your unsubscribe request…",
    invalid: "This unsubscribe link is invalid or expired. Enter your email to request a new one.",
    error: "We could not update your preference. Please try again or email deals@kridiyatravel.com.",
    another: "Use another email address",
    home: "Back to Kridiya"
  };
  let busy = false;
  another.textContent = copy.another;
  home.querySelector("a").textContent = copy.home;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = "preference-status " + (type || "");
  }

  function showResult(confirmed) {
    form.hidden = true;
    heading.textContent = confirmed ? copy.confirmed : copy.inbox;
    intro.textContent = confirmed ? copy.stopped : copy.confirm;
    farewell.textContent = confirmed ? copy.farewell : "";
    farewell.hidden = !confirmed;
    home.hidden = !confirmed;
    another.hidden = confirmed;
    setStatus("", "");
    heading.focus();
  }

  async function submitPreference(body, expected) {
    const client = await window.KridiyaAuth.client();
    const result = await client.functions.invoke("marketing-unsubscribe", { body: body });
    if (result.error) throw result.error;
    // Never show a completed unsubscribe for a pending or malformed response.
    if (!result.data || result.data.ok !== true || result.data[expected] !== true) {
      throw new Error("Unexpected preference response");
    }
  }

  another.addEventListener("click", function () {
    heading.textContent = copy.title;
    intro.textContent = copy.intro;
    another.hidden = true;
    form.hidden = false;
    form.elements.email.focus();
  });

  const url = new URL(window.location.href);
  const linkToken = url.searchParams.get("token");
  if (linkToken) {
    // Remove the bearer token from the address bar on both success and failure.
    url.searchParams.delete("token");
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    busy = true;
    form.hidden = true;
    setStatus(copy.confirming, "pending");
    submitPreference({ token: linkToken }, "confirmed").then(function () {
      showResult(true);
    }).catch(function (error) {
      form.hidden = false;
      setStatus(error && error.context && error.context.status === 400 ? copy.invalid : copy.error, "error");
    }).finally(function () { busy = false; });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (busy) return;
    const emailInput = form.elements.email;
    const honeypot = form.elements.company;
    const button = form.querySelector('button[type="submit"]');
    const email = String(emailInput.value || "").trim().toLowerCase();

    if (honeypot && honeypot.value) {
      form.reset();
      showResult(false);
      return;
    }
    if (!emailInput.checkValidity()) {
      emailInput.reportValidity();
      return;
    }

    busy = true;
    button.disabled = true;
    setStatus(copy.sending, "pending");
    try {
      await submitPreference({ email: email }, "pending_confirmation");
      form.reset();
      showResult(false);
    } catch (_) {
      setStatus(copy.error, "error");
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
})();
