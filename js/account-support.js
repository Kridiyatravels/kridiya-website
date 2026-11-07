(function () {
  "use strict";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function text(en, ar) { return document.documentElement.lang === "ar" ? ar : en; }
  const escape = function (value) { return window.KridiyaAuth.escapeHTML(String(value || "")); };

  function init(form, list, bookings, enquiries) {
    const auth = window.KridiyaAuth;
    const linked = form.elements.linked_item;
    const submit = form.querySelector('[type="submit"]');
    const notice = form.querySelector(".form-banner");
    const historyNotice = document.getElementById("support-history-status");
    const startNew = form.querySelector("[data-support-new]");
    const reload = document.querySelector("[data-support-refresh]");
    const older = document.querySelector("[data-support-older]");
    const newest = document.querySelector("[data-support-newest]");
    const section = document.getElementById("support");
    const tabs = Array.from(section.querySelectorAll("[data-support-view]"));
    const user = auth.session();
    const retryKey = "kridiya_support_retry_v2:" + user.id;
    let rows = [], pending = null, submitting = false;
    let currentCursor = null, nextCursor = null, loading = false;
    let historyLoaded = false;
    const messagePages = new Map();
    const copy = {
      heading: ["Help & requests", "المساعدة والطلبات"], requestHelp: ["Request help", "طلب المساعدة"], yourRequests: ["Your requests", "طلباتك"],
      urgentLink: ["Urgent travel help on WhatsApp", "مساعدة عاجلة للسفر عبر واتساب"],
      topic: ["What do you need help with?", "بماذا تحتاج إلى المساعدة؟"], chooseTopic: ["Choose a topic", "اختر الموضوع"], subject: ["Subject", "الموضوع"], message: ["How can we help?", "كيف يمكننا مساعدتك؟"],
      linked: ["Booking or enquiry (optional)", "الحجز أو الاستفسار (اختياري)"], urgentCheck: ["This is urgent", "هذا الطلب عاجل"],
      send: ["Send request", "إرسال الطلب"], loading: ["Loading your requests…", "جارٍ تحميل طلباتك…"]
    };
    section.querySelectorAll("[data-support-text]").forEach(function (node) { const value = copy[node.dataset.supportText]; node.textContent = text(value[0], value[1]); });
    section.setAttribute("aria-label", text("Help & requests", "المساعدة والطلبات"));
    section.querySelector('[role="tablist"]').setAttribute("aria-label", text("Help & requests", "المساعدة والطلبات"));
    function view(name, focus) {
      tabs.forEach(function (tab) {
        const selected = tab.dataset.supportView === name;
        tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
        if (selected && focus) tab.focus();
      });
      if (name === "history" && !historyLoaded) refresh(null);
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { view(tab.dataset.supportView, false); });
      tab.addEventListener("keydown", function (event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
        view(tabs[next].dataset.supportView, true);
      });
    });
    form.addEventListener("support:compose", function () { form.elements.urgent.checked = form.elements.urgency.value !== "normal"; view("compose", false); });
    form.elements.urgent.addEventListener("change", function () { form.elements.urgency.value = form.elements.urgent.checked ? "urgent" : "normal"; });
    try {
      const saved = JSON.parse(sessionStorage.getItem(retryKey) || "null");
      if (saved && uuid.test(saved.id) && /^[a-f0-9]{64}$/.test(saved.fingerprint)) pending = saved;
    } catch (_) { /* Storage can be unavailable; same-page retries still retain their key. */ }
    function remember(value) {
      pending = value;
      try { if (value) sessionStorage.setItem(retryKey, JSON.stringify(value)); else sessionStorage.removeItem(retryKey); } catch (_) {}
    }
    function show(message, kind, reference) {
      notice.hidden = false;
      notice.className = "form-banner " + kind;
      notice.setAttribute("data-no-localize", "");
      notice.setAttribute("role", kind === "error" ? "alert" : "status");
      notice.textContent = message;
      if (reference) {
        const slot = document.createElement("span");
        notice.append(" ", slot);
        window.KridiyaReferenceCopy.mount(slot, reference);
        const button = document.createElement("button");
        button.type = "button"; button.className = "support-text-action";
        button.textContent = text("View your requests", "عرض طلباتك");
        button.addEventListener("click", function () { view("history", true); });
        notice.appendChild(button);
      }
    }
    function showHistory(message, kind) {
      historyNotice.className = "form-banner " + kind;
      historyNotice.setAttribute("role", kind === "error" ? "alert" : "status");
      historyNotice.textContent = message;
      historyNotice.hidden = false;
      historyNotice.focus();
    }
    function date(value) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(document.documentElement.lang === "ar" ? "ar-AE" : "en-GB");
    }
    function label(value) {
      const categories = { amendment: ["Change a booking", "تعديل الحجز"], cancellation: ["Cancel a booking", "إلغاء الحجز"], complaint: ["Complaint", "شكوى"], privacy: ["Privacy request", "طلب متعلق بالخصوصية"], emergency: ["Urgent travel help", "مساعدة عاجلة للسفر"], other: ["Other", "أخرى"], payment: ["Payment question", "استفسار عن الدفع"], refund: ["Refund request", "طلب استرداد"] };
      if (categories[value]) return text(categories[value][0], categories[value][1]);
      const arabic = { submitted: "تم الاستلام", acknowledged: "قيد المتابعة", in_progress: "قيد المعالجة", waiting_customer: "بانتظار ردك", resolved: "تم الحل", closed: "مغلق", cancelled: "ملغى" };
      return document.documentElement.lang === "ar" && arabic[value] ? arabic[value] : auth.statusLabel(value);
    }
    linked.innerHTML = '<option value="">' + text("No booking linked", "دون ربط بحجز") + '</option>' +
      bookings.filter(function (b) { return !b.corporate_account_id && b.booking_kind !== "corporate"; }).map(function (b) { return '<option value="booking:' + escape(b.id) + '">' + text("Booking ", "حجز ") + escape(b.booking_reference) + '</option>'; }).join("") +
      enquiries.filter(function (e) { return !e.corporate_account_id && e.enquiry_type !== "corporate"; }).map(function (e) { return '<option value="enquiry:' + escape(e.id) + '">' + text("Enquiry ", "استفسار ") + escape(e.reference || text("Reference pending", "المرجع قيد التخصيص")) + '</option>'; }).join("");
    linked.setAttribute("data-no-localize", "");
    ["amendment", "cancellation", "complaint", "privacy", "payment", "refund", "emergency", "other"].forEach(function (value) { form.elements.category.querySelector('[value="' + value + '"]').textContent = label(value); });
    startNew.textContent = text("Start a different request", "بدء طلب مختلف");
    reload.textContent = text("Refresh", "تحديث");
    older.textContent = text("Older requests", "طلبات أقدم");
    newest.textContent = text("Newest requests", "أحدث الطلبات");
    list.tabIndex = -1;
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", text("Support requests", "طلبات الدعم"));
    startNew.hidden = !pending;
    if (pending) show(text("An earlier request may have been saved. Refresh your requests first. To retry, enter the same details; the original submission key will be reused.", "قد يكون طلب سابق قد حُفظ. حدّث قائمة طلباتك أولًا. لإعادة المحاولة، أدخل التفاصيل نفسها ليُستخدم معرّف الإرسال الأصلي."), "error");
    function render() {
      list.setAttribute("data-no-localize", "");
      if (!rows.length) { list.innerHTML = '<p class="form-note">' + text("No support requests submitted from this account.", "لا توجد طلبات دعم مقدمة من هذا الحساب.") + '</p>'; return; }
      list.innerHTML = '<div class="customer-doc-list">' + rows.map(function (row) {
        return '<article class="customer-doc-row support-case"><div><button class="support-case-toggle" type="button" data-support-detail="' + escape(row.id) + '" aria-expanded="false" aria-controls="support-body-' + escape(row.id) + '"><span dir="auto">' + escape(row.subject) + '</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
          (typeof row.reference === "string" && row.reference.trim() ? window.KridiyaReferenceCopy.html(row.reference) : '<small>' + text("Reference pending", "المرجع قيد التخصيص") + '</small>') +
          '<small>' + escape(label(row.status) + ' · ' + date(row.created_at)) + '</small>' +
          '<div id="support-body-' + escape(row.id) + '" class="support-case-body" hidden><p class="support-message" dir="auto">' + escape(row.description) + '</p>' +
          '<div id="support-replies-' + escape(row.id) + '" tabindex="-1" aria-label="' + text("Replies", "الردود") + '"></div>' +
          (row.resolution ? '<p class="support-message" dir="auto">' + escape(row.resolution) + '</p>' : '') +
          (/^(submitted|acknowledged)$/.test(row.status) ? '<button class="support-text-action support-cancel" type="button" aria-label="' + escape(text("Cancel request ", "إلغاء الطلب ") + (row.reference || row.subject)) + '" data-support-cancel="' + escape(row.id) + '">' + text("Cancel request", "إلغاء الطلب") + '</button>' : '') + '</div></div></article>';
      }).join("") + '</div>';
    }
    async function refresh(cursor) {
      if (loading) return false;
      loading = true; reload.disabled = true; older.disabled = true; newest.disabled = true;
      list.setAttribute("aria-busy", "true");
      try {
        const result = await auth.listMySupportRequestsV2(cursor || null);
        rows = result.items; currentCursor = cursor || null; nextCursor = result.next_cursor; historyLoaded = true;
        messagePages.clear(); render(); older.hidden = !nextCursor; newest.hidden = !currentCursor;
        return true;
      } catch (_) {
        list.innerHTML = '<p class="form-banner error" role="alert" data-no-localize>' + text("Could not refresh requests. Try Refresh requests again.", "تعذّر تحديث الطلبات. اضغط على تحديث الطلبات للمحاولة مجددًا.") + '</p>';
        older.hidden = true; newest.hidden = true; return false;
      } finally { loading = false; reload.disabled = false; older.disabled = false; newest.disabled = false; list.removeAttribute("aria-busy"); }
    }
    reload.addEventListener("click", function () { refresh(null); });
    older.addEventListener("click", async function () { if (nextCursor && await refresh(nextCursor)) list.focus({ preventScroll: true }); });
    newest.addEventListener("click", async function () { if (await refresh(null)) list.focus({ preventScroll: true }); });
    async function loadMessages(id, cursor, focus) {
      const target = document.getElementById("support-replies-" + id);
      const prior = messagePages.get(id);
      if (!target || (prior && prior.loading)) return;
      const state = { cursor: cursor || null, next: null, loading: true };
      messagePages.set(id, state);
      target.setAttribute("aria-busy", "true");
      target.innerHTML = '<p class="form-note" role="status">' + text("Loading replies…", "جارٍ تحميل الردود…") + '</p>';
      try {
        const result = await auth.listMySupportMessagesV2(id, cursor || null);
        if (!target.isConnected) return;
        state.next = result.next_cursor;
        const replies = result.items.filter(function (m) { return m.delivery_status === "available_in_account" && typeof m.body === "string"; });
        target.innerHTML = (replies.length ? replies.map(function (m) { return '<div class="support-reply"><small>' + text("Kridiya reply · ", "رد كريديا · ") + escape(date(m.created_at)) + '</small><p class="support-message" dir="auto">' + escape(m.body) + '</p></div>'; }).join("") : '<p class="form-note">' + text("No replies on this page.", "لا توجد ردود في هذه الصفحة.") + '</p>') +
          '<div class="support-page-actions">' + (state.next ? '<button type="button" class="btn btn-outline" data-replies-older="' + escape(id) + '">' + text("Older replies", "ردود أقدم") + '</button>' : '') +
          (state.cursor ? '<button type="button" class="btn btn-outline" data-replies-newest="' + escape(id) + '">' + text("Newest replies", "أحدث الردود") + '</button>' : '') + '</div>';
      } catch (_) {
        if (target.isConnected) target.innerHTML = '<p class="form-note" role="alert">' + text("Could not load replies.", "تعذّر تحميل الردود.") + '</p><button type="button" class="btn btn-outline" data-replies-retry="' + escape(id) + '">' + text("Try again", "حاول مجددًا") + '</button>';
      } finally { state.loading = false; target.removeAttribute("aria-busy"); if (focus && target.isConnected) target.focus({ preventScroll: true }); }
    }
    list.addEventListener("click", function (event) {
      const button = event.target.closest("[data-support-detail]");
      if (!button) return;
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      document.getElementById(button.getAttribute("aria-controls")).hidden = !open;
      if (open && !messagePages.has(button.dataset.supportDetail)) loadMessages(button.dataset.supportDetail, null, false);
    });
    list.addEventListener("click", function (event) {
      const button = event.target.closest("[data-replies-older], [data-replies-newest], [data-replies-retry]");
      if (!button) return;
      const id = button.dataset.repliesOlder || button.dataset.repliesNewest || button.dataset.repliesRetry;
      const state = messagePages.get(id);
      if (!state || state.loading) return;
      loadMessages(id, button.hasAttribute("data-replies-older") ? state.next : button.hasAttribute("data-replies-retry") ? state.cursor : null, true);
    });
    startNew.addEventListener("click", async function () {
      if (submitting) return;
      const message = text("The earlier request may already be saved. Check your requests before starting another. Start a different request?", "قد يكون الطلب السابق محفوظًا بالفعل. راجع قائمة طلباتك قبل إنشاء طلب آخر. هل تريد بدء طلب مختلف؟");
      const confirmed = window.KridiyaMotion && window.KridiyaMotion.confirm ? await window.KridiyaMotion.confirm(message, { opener: startNew }) : window.confirm(message);
      if (!confirmed) return;
      remember(null); form.reset(); notice.hidden = true; startNew.hidden = true; form.elements.subject.focus();
    });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (submitting || !form.reportValidity()) return;
      const parts = String(linked.value || "").split(":");
      const payload = { category: form.elements.category.value, urgency: form.elements.category.value === "emergency" ? "emergency" : form.elements.urgent.checked ? "urgent" : "normal", subject: form.elements.subject.value.trim(), description: form.elements.description.value.trim(), bookingId: parts[0] === "booking" ? parts[1] : null, enquiryId: parts[0] === "enquiry" ? parts[1] : null };
      if (payload.subject.length < 3 || payload.description.length < 10) { show(text("Enter a subject of at least 3 characters and details of at least 10 characters.", "أدخل موضوعًا من 3 أحرف على الأقل وتفاصيل من 10 أحرف على الأقل."), "error"); return; }
      submitting = true; submit.disabled = true; startNew.disabled = true;
      form.setAttribute("aria-busy", "true");
      form.querySelectorAll("input, select, textarea").forEach(function (field) { field.disabled = true; });
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
        const fingerprint = Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
        if (pending && pending.fingerprint !== fingerprint) {
          show(text("The earlier attempt may already be saved. Retry with the original details, or check your requests and choose Start a different request.", "قد تكون المحاولة السابقة قد حُفظت. أعد المحاولة بالتفاصيل الأصلية، أو راجع طلباتك ثم اختر بدء طلب مختلف."), "error");
          return;
        }
        if (!pending) remember({ id: crypto.randomUUID(), fingerprint: fingerprint });
        const receipt = await auth.createMySupportRequestV2(Object.assign({ submissionId: pending.id }, payload));
        if (!receipt || !uuid.test(receipt.id) || typeof receipt.reference !== "string" || !receipt.reference.trim()) throw new Error("Invalid saved receipt");
        remember(null); form.reset();
        show(text("Your request is saved in your account. Keep this reference:", "حُفظ طلبك في حسابك. احتفظ بهذا المرجع:"), "success", receipt.reference);
        await refresh(); // A list refresh failure must not turn a confirmed save into a failed submission.
      } catch (_) {
        show(text("We could not confirm that your request was saved. Refresh your requests, then retry with the same details if needed. Your submission key will be reused.", "تعذّر تأكيد حفظ طلبك. حدّث قائمة طلباتك، ثم أعد المحاولة بالتفاصيل نفسها عند الحاجة. سيُستخدم معرّف الإرسال نفسه."), "error");
      } finally {
        submitting = false; submit.disabled = false; startNew.disabled = false; startNew.hidden = !pending;
        form.removeAttribute("aria-busy");
        form.querySelectorAll("input, select, textarea").forEach(function (field) { field.disabled = false; });
      }
    });
    list.addEventListener("click", async function (event) {
      const button = event.target.closest("[data-support-cancel]");
      if (!button || button.disabled) return;
      const row = rows.find(function (r) { return r.id === button.dataset.supportCancel; });
      if (!row) return;
      const question = text("Cancel this support request?", "هل تريد إلغاء طلب الدعم هذا؟");
      const confirmed = window.KridiyaMotion && window.KridiyaMotion.confirm ? await window.KridiyaMotion.confirm(question, { opener: button }) : window.confirm(question);
      if (!confirmed) return;
      button.disabled = true;
      try {
        if (!await auth.cancelMySupportRequest(row.id, row.updated_at)) throw new Error("Cancellation not confirmed");
        showHistory(text("Support request cancelled.", "أُلغي طلب الدعم."), "success"); await refresh(currentCursor);
      } catch (_) { button.disabled = false; showHistory(text("Could not cancel this request. Refresh the list and try again.", "تعذّر إلغاء الطلب. حدّث القائمة وحاول مجددًا."), "error"); }
    });
    submit.disabled = false;
    view("compose", false);
  }
  window.KridiyaCustomerSupport = Object.freeze({ init: init });
})();
