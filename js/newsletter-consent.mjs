export async function submitNewsletterSubscription({ persistConsent, sendNotification }) {
  let persisted;
  try {
    persisted = await persistConsent();
  } catch {
    return {
      ok: false,
      status: "consent_failed",
      consentPersisted: false,
      notificationSent: false,
      retainInput: true,
      message: "We couldn't save your subscription. Your email was not added. Please try again.",
    };
  }

  const decision = persisted && persisted.decision;
  if (!decision) {
    return {
      ok: false,
      status: "consent_failed",
      consentPersisted: false,
      notificationSent: false,
      retainInput: true,
      message: "We couldn't confirm your subscription. Your email was not added. Please try again.",
    };
  }

  if (decision === "duplicate") {
    return {
      ok: true,
      status: "already_recorded",
      consentPersisted: true,
      notificationSent: false,
      retainInput: false,
      message: "This subscription choice was already recorded.",
    };
  }

  try {
    await sendNotification();
  } catch {
    return {
      ok: true,
      status: "subscribed_notification_failed",
      consentPersisted: true,
      notificationSent: false,
      retainInput: false,
      message: "You're subscribed.",
    };
  }

  return {
    ok: true,
    status: decision === "resubscribed" ? "resubscribed" : "subscribed",
    consentPersisted: true,
    notificationSent: true,
    retainInput: false,
    message: decision === "resubscribed"
      ? "Welcome back. Your new subscription choice has been recorded."
      : "Thank you. Your email preferences have been recorded.",
  };
}
