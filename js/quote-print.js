(function () {
  'use strict';
  const fitted = new WeakSet();
  function fitDocument(viewport) {
    const sheet = viewport.querySelector('.quotation-sheet');
    if (!sheet) return;
    viewport.setAttribute('data-sized', '');
    const scale = viewport.dataset.fullSize === 'true' ? 1 : Math.min(1, viewport.clientWidth / 775);
    sheet.style.transform = 'scale(' + scale + ')';
    viewport.style.height = Math.ceil(sheet.offsetHeight * scale) + 'px';
  }
  const sizeObserver = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      const viewport = entry.target.matches('.quotation-document-viewport') ? entry.target : entry.target.parentElement;
      if (viewport && viewport.isConnected) fitDocument(viewport);
    });
  });
  function registerDocuments(root) {
    if (!(root instanceof Element)) return;
    const viewports = root.matches('.quotation-document-viewport') ? [root] : root.querySelectorAll('.quotation-document-viewport');
    viewports.forEach(function (viewport) {
      if (fitted.has(viewport)) return;
      const sheet = viewport.querySelector('.quotation-sheet');
      if (!sheet) return;
      fitted.add(viewport); fitDocument(viewport); sizeObserver.observe(viewport); sizeObserver.observe(sheet);
    });
  }
  registerDocuments(document.body);
  new MutationObserver(function (records) {
    records.forEach(function (record) { record.addedNodes.forEach(registerDocuments); record.removedNodes.forEach(function (node) {
      if (!(node instanceof Element)) return;
      const viewports = node.matches('.quotation-document-viewport') ? [node] : node.querySelectorAll('.quotation-document-viewport');
      viewports.forEach(function (viewport) { sizeObserver.unobserve(viewport); const sheet=viewport.querySelector('.quotation-sheet'); if(sheet)sizeObserver.unobserve(sheet); fitted.delete(viewport); });
    }); });
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', function (event) {
    const sizeButton = event.target.closest('[data-quote-size]');
    if (sizeButton) {
      const viewport = sizeButton.closest('.quotation').querySelector('.quotation-document-viewport');
      const full = viewport.dataset.fullSize !== 'true'; viewport.dataset.fullSize = String(full);
      sizeButton.setAttribute('aria-pressed', String(full));
      sizeButton.querySelector('.quotation-english').textContent = full ? 'Fit to screen' : 'View full size';
      sizeButton.querySelector('.quotation-arabic').textContent = full ? 'ملاءمة الشاشة' : 'عرض بالحجم الكامل';
      fitDocument(viewport); return;
    }
    const review = event.target.closest('[data-review-quote-terms]');
    if (review) {
      const terms = review.parentElement.querySelector('.quotation-terms-review');
      terms.hidden = !terms.hidden;
      review.setAttribute('aria-expanded', String(!terms.hidden));
      return;
    }
    const button = event.target.closest('[data-quote-print]');
    if (!button || document.querySelector('.quotation-print-view')) return;
    const quote = button.closest('.quotation');
    const sheet = quote && quote.querySelector('.quotation-sheet');
    if (!sheet) return;
    const arabic = document.documentElement.lang === 'ar';
    const dialog = document.createElement('dialog');
    dialog.className = 'quotation-print-view';
    dialog.setAttribute('aria-label', arabic ? 'معاينة عرض السعر للطباعة' : 'Quotation print preview');
    const toolbar = document.createElement('div');
    toolbar.className = 'quotation-print-toolbar';
    const print = document.createElement('button');
    print.type = 'button'; print.disabled = true;
    print.textContent = arabic ? 'طباعة / حفظ PDF' : 'Print / Save PDF';
    const status = document.createElement('span');
    status.setAttribute('role', 'status'); status.textContent = arabic ? 'جارٍ إعداد عرض السعر…' : 'Preparing quotation…';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = arabic ? 'إغلاق' : 'Close';
    toolbar.append(print, status, close);
    const wrapper = document.createElement('main');
    wrapper.className = 'quotation';
    // Copy this document only. Navigation, decisions and other customer records stay out.
    const copy = sheet.cloneNode(true);
    copy.removeAttribute('style');
    copy.querySelectorAll('button,input,script,iframe').forEach(function (node) { node.remove(); });
    wrapper.appendChild(copy);
    const sample = document.querySelector('[data-quote-sample]');
    if (sample) {
      const notice = document.createElement('p');
      notice.className = 'quotation-local-times'; notice.textContent = sample.textContent;
      wrapper.prepend(notice);
    }
    dialog.append(toolbar, wrapper);
    document.body.appendChild(dialog);
    const originalTitle = document.title;
    const title = sheet.querySelector('.quotation-overview h5');
    document.title = 'Kridiya quotation - ' + (title ? title.textContent : 'Travel');
    document.body.classList.add('quotation-print-active');
    dialog.showModal();
    const artworkReady = Array.from(copy.querySelectorAll('img')).map(function (img) {
      img.loading = 'eager';
      return new Promise(function (resolve, reject) {
        function loaded() { img.naturalWidth ? resolve() : reject(new Error(arabic ? 'تعذّر تحميل إحدى الصور. أغلق المعاينة وحاول مرة أخرى.' : 'An image could not load. Close this preview and try again.')); }
        img.onload = loaded; img.onerror = loaded;
        if (img.complete) loaded();
      });
    });
    const timeout = setTimeout(function () { status.textContent = arabic ? 'استغرق تحميل عرض السعر وقتًا أطول من المتوقع. أغلق المعاينة وحاول مرة أخرى.' : 'The quotation is taking too long to load. Close this preview and try again.'; }, 15000);
    Promise.all(artworkReady).then(function () {
      clearTimeout(timeout);
      if (!dialog.isConnected) return;
      status.textContent = arabic ? 'اختر حفظ بصيغة PDF في نافذة الطباعة.' : 'Choose Save as PDF in the print window.';
      print.disabled = false;
    }).catch(function (err) { clearTimeout(timeout); if (dialog.isConnected) status.textContent = err.message; });
    print.addEventListener('click', function () { window.print(); });
    close.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () {
      clearTimeout(timeout);
      document.body.classList.remove('quotation-print-active');
      document.title = originalTitle;
      dialog.remove(); button.focus({ preventScroll: true });
    });
  });
})();
