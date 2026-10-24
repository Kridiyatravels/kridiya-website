/* Customer navigation presents existing features; auth.js owns data and writes. */
"use strict";
(function () {
  const groups = [
    { title: 'My details', links: [
      ['#bookings','Bookings','suitcase'], ['#profile','Personal information','passport'], ['#travellers','Saved travellers','passport'], ['#security','Security','shield']
    ] },
    { title: 'Payments', links: [['#payments','Payments & refunds','payment']] },
    { title: 'Preferences', links: [['#travel-updates','Travel updates','plane'], ['#notifications','Notifications','mail']] },
    { title: 'Help and information', links: [
      ['#support','Help & requests','phone'], ['#contact-team','Contact the team','whatsapp'],
      ['track-enquiry.html','Track an enquiry','search'], ['guides/index.html','Travel guides','document']
    ] },
    { title: 'Legal', links: [['privacy.html','Privacy policy','shield'], ['terms.html','Terms & conditions','document']] }
  ];
  const travelLinks = [
    ['flights.html','Flights','plane'],
    ['hotels.html','Hotels','hotel'],
    ['holidays.html','Holidays','suitcase'],
    ['visa.html','Visa','passport'],
    ['umrah.html','Umrah','kaaba'],
    ['cruise.html','Cruise','ship'],
    ['https://corporate.kridiyatravel.com','Business Travel','briefcase']
  ];
  function currentReturnDestination() {
    const path = location.pathname.replace(/^\/+/, '') || 'index.html';
    return path + location.search + location.hash;
  }
  function safeAuthDestination(value, fallback) {
    if (window.KridiyaAuth && typeof KridiyaAuth.safeReturnDestination === 'function') {
      return KridiyaAuth.safeReturnDestination(value, fallback || 'account.html');
    }
    return 'account.html';
  }
  function accountIcon(name) {
    const paths = {
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
      home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
      suitcase: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M8 10v7m8-7v7"/>',
      passport: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
      payment: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
      shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
      plane: '<path d="m3 10 8 2 8-8c3-2 3 1 1 3l-8 8 2 6-3-1-3-5-5-3Z"/>',
      hotel: '<path d="M3 20V5m18 15V9M3 16h18M6 12h5a3 3 0 0 1 3 3v1M6 8h3v4H6Z"/>',
      kaaba: '<path d="M4 8h16v12H4Zm0 0 3-4h10l3 4M8 8v12m8-12v12M8 12h8"/>',
      ship: '<path d="M4 14 6 5h12l2 9-8 5Zm2-5h12M9 5V2h6v3M3 20c2 1 4 1 6 0 2 1 4 1 6 0 2 1 4 1 6 0"/>',
      briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/>',
      search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
      document: '<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6m-6 4h6"/>',
      phone: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3m0 3h.01"/>',
      whatsapp: '<path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4c0 4-8 2-13-3S1 3 5 3Z"/>',
      back: '<path d="m10 5-7 7 7 7M3 12h18"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.passport) + '</svg>';
  }
  function primaryNavigationIcon(name) {
    const paths = {
      home: 'M12 2.5 2 11h2v10h6v-6h4v6h6V11h2L12 2.5z',
      suitcase: 'M9 6V4c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v2h3c1.1 0 2 .9 2 2v11c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V8c0-1.1.9-2 2-2h3zm2-2v2h2V4h-2zM8 9v9h1.5V9H8zm6.5 0v9H16V9h-1.5z',
      help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 17.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm1.5-5.2v.6h-3v-1c0-1.8.9-2.7 2-3.5.8-.6 1.3-1 1.3-1.8 0-1-.7-1.7-1.9-1.7-1.1 0-2 .6-2.8 1.6L7 7.1A6 6 0 0 1 12 4.8c3 0 5 1.6 5 4 0 2.1-1.2 3.2-2.5 4.1-.7.6-1 .9-1 1.7z',
      account: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5z'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + paths[name] + '"></path></svg>';
  }
  function routeLinks(prefix) {
    const accountLinks = groups.map(group => '<h3>' + group.title + '</h3>' + group.links.map(([target, label, symbol]) => {
      const href = target.startsWith('#') ? prefix + target : prefix ? new URL(target, prefix).href : target;
      return '<a href="' + href + '">' + accountIcon(symbol) + '<span>' + label + '</span></a>';
    }).join('')).join('');
    const publicLinks = travelLinks.map(([href, label, symbol]) => {
      const resolvedHref = prefix ? new URL(href, prefix).href : href;
      return '<a href="' + resolvedHref + '">' + accountIcon(symbol) + '<span>' + label + '</span></a>';
    }).join('');
    return accountLinks + '<div class="consumer-account-travel"><h3>Plan travel</h3>' + publicLinks + '</div>';
  }
  function initializeAccountDrawer() {
    const trigger = document.getElementById('account-btn');
    if (!trigger || !document.body.classList.contains('consumer-site')) return;
    const hasAuthHint = window.KridiyaAuth && (
      (typeof KridiyaAuth.session === 'function' && KridiyaAuth.session()) ||
      (typeof KridiyaAuth.hasPersistedAuth === 'function' && KridiyaAuth.hasPersistedAuth())
    );
    if (!hasAuthHint) return;
    if (document.querySelector('.consumer-account-drawer')) return;
    const drawer = document.createElement('dialog');
    drawer.className = 'consumer-account-drawer';
    drawer.setAttribute('aria-labelledby', 'account-drawer-title');
    // Resolve from the header URL so this also works on /guides/ pages.
    const accountUrl = new URL('account.html', trigger.href).href;
    const loginUrl = new URL('login.html', accountUrl).href;
    const registerUrl = new URL('register.html', accountUrl).href;
    drawer.innerHTML = '<div class="account-drawer-heading"><h2 id="account-drawer-title">My Kridiya</h2><button type="button" aria-label="Close account menu">×</button></div>' +
      '<div class="account-drawer-identity" aria-busy="true"><div class="account-drawer-loading" aria-hidden="true"><span class="auth-restore-shape account-drawer-loading-name"></span><span class="auth-restore-shape account-drawer-loading-action"></span><span class="auth-restore-shape account-drawer-loading-copy"></span></div><b data-drawer-name hidden></b><a class="btn btn-primary" data-drawer-action href="' + loginUrl + '" hidden></a><p data-drawer-description hidden><span data-drawer-description-copy></span><a data-drawer-signup href="' + registerUrl + '">Sign up</a></p></div><span class="visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-drawer-status>Loading your account.</span>' +
      '<nav class="consumer-account-nav" aria-label="Account menu">' + routeLinks(accountUrl) + '</nav>';
    document.body.append(drawer);
    trigger.setAttribute('aria-haspopup', 'dialog');
    let previousOverflow = null;
    let restoreTrigger = true;
    function finishClose() {
      // A previous native close event may arrive after the drawer reopens.
      if (drawer.open || !previousOverflow) return;
      const saved = previousOverflow;
      previousOverflow = null;
      document.body.style.setProperty('overflow', saved.value, saved.priority);
      if (restoreTrigger) trigger.focus({ preventScroll: true });
    }
    function closeDrawer() {
      drawer.close();
      // Native close events are queued; release our lock in the same task.
      finishClose();
    }
    drawer.querySelector('button').addEventListener('click', closeDrawer);
    drawer.addEventListener('cancel', event => {
      event.preventDefault();
      closeDrawer();
    });
    drawer.addEventListener('click', event => {
      if (event.target !== drawer) return;
      const rect = drawer.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDrawer();
    });
    drawer.addEventListener('close', finishClose);
    drawer.querySelector('nav').addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link.pathname === location.pathname && document.querySelector('[data-account-section]')) {
        event.preventDefault(); restoreTrigger = false;
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
        closeDrawer();
        document.dispatchEvent(new CustomEvent('kridiya:account-route'));
      } else closeDrawer();
    });
    trigger.addEventListener('click', async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (drawer.open) return;
      restoreTrigger = true;
      const savedOverflow = {
        value: document.body.style.getPropertyValue('overflow'),
        priority: document.body.style.getPropertyPriority('overflow')
      };
      drawer.showModal();
      previousOverflow = savedOverflow;
      document.body.style.overflow = 'hidden';
      const identity = drawer.querySelector('.account-drawer-identity');
      const loading = drawer.querySelector('.account-drawer-loading');
      const name = drawer.querySelector('[data-drawer-name]');
      const description = drawer.querySelector('[data-drawer-description]');
      const descriptionCopy = drawer.querySelector('[data-drawer-description-copy]');
      const action = drawer.querySelector('[data-drawer-action]');
      const signup = drawer.querySelector('[data-drawer-signup]');
      const status = drawer.querySelector('[data-drawer-status]');
      function showLoading() {
        identity.setAttribute('aria-busy', 'true');
        loading.hidden = false;
        name.hidden = true; action.hidden = true; description.hidden = true;
        status.textContent = 'Loading your account.';
      }
      function showResolved(user) {
        loading.hidden = true;
        name.hidden = false; action.hidden = false; description.hidden = false;
        if (user) {
          name.textContent = user.name || 'My account';
          descriptionCopy.textContent = user.email || '';
          signup.hidden = true;
          action.textContent = 'Open my account'; action.href = accountUrl;
          status.textContent = 'Account loaded.';
        } else {
          name.textContent = 'Log in to manage your bookings';
          descriptionCopy.textContent = 'Don\'t have an account? ';
          signup.hidden = false;
          action.textContent = 'Log in'; action.href = loginUrl;
          status.textContent = 'Account options loaded.';
        }
        identity.setAttribute('aria-busy', 'false');
      }
      function showVerificationError() {
        loading.hidden = true;
        name.hidden = false; action.hidden = false; description.hidden = false;
        name.textContent = 'Could not load your account';
        descriptionCopy.textContent = 'Check your connection and try again.';
        signup.hidden = true;
        action.textContent = 'Try again';
        action.href = location.href;
        status.textContent = 'Account verification failed. Try again.';
        identity.setAttribute('aria-busy', 'false');
      }
      showLoading();
      try {
        const user = await KridiyaAuth.currentUser();
        if (!drawer.open) return;
        showResolved(user);
      } catch (_) {
        // Do not expose a cached identity after the secure session could not be
        // verified. A reload retries verification without implying sign-out.
        if (drawer.open) showVerificationError();
      }
    });
  }
  function initializeAccountAccessDirectory() {
    document.querySelectorAll('.account-access-directory [data-account-icon]').forEach(control => {
      control.insertAdjacentHTML('afterbegin', accountIcon(control.dataset.accountIcon));
    });
    const trigger = document.querySelector('[data-language-menu-trigger]');
    const menu = document.getElementById('account-language-menu');
    if (!trigger || !menu) return;
    const options = [...menu.querySelectorAll('[data-site-language-switch]')];
    const current = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    options.forEach(option => {
      if (option.dataset.siteLanguageSwitch === current) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    });
    function closeLanguageMenu(restoreFocus) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
    trigger.addEventListener('click', () => {
      const opening = menu.hidden;
      menu.hidden = !opening;
      trigger.setAttribute('aria-expanded', String(opening));
      if (opening) options[0]?.focus();
    });
    document.addEventListener('click', event => {
      if (!menu.hidden && !event.target.closest('.account-access-language')) closeLanguageMenu(false);
    });
    menu.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeLanguageMenu(true);
    });
  }
  function initializeAccountNavigation() {
    const navigation = document.querySelector('.account-side .consumer-account-nav');
    if (!navigation) return;
    navigation.innerHTML = routeLinks('');
    const grid = document.querySelector('.account-grid');
    const panels = Array.from(document.querySelectorAll('[data-account-section]'));
    const links = Array.from(navigation.querySelectorAll('a[href^="#"]'));
    const narrow = window.matchMedia('(max-width: 820px)');
    const bottom = document.createElement('nav');
    bottom.className = 'account-bottom-nav'; bottom.setAttribute('aria-label', 'Customer navigation');
    bottom.innerHTML = '<a href="index.html">' + primaryNavigationIcon('home') + '<span>Home</span></a><a href="#bookings">' + primaryNavigationIcon('suitcase') + '<span>Bookings</span></a><a href="#support">' + primaryNavigationIcon('help') + '<span>Help</span></a><a href="#account-menu">' + primaryNavigationIcon('account') + '<span>My Kridiya</span></a>';
    const hasLocalSession = !!(window.KridiyaAuth && typeof KridiyaAuth.session === 'function' && KridiyaAuth.session());
    if (!hasLocalSession) {
      bottom.querySelector('a[href="#support"]').setAttribute('href', 'contact.html');
      bottom.querySelector('a[href="#account-menu"]').setAttribute('href', 'login.html');
    }
    document.querySelector('main').append(bottom);
    panels.forEach(panel => {
      const back = document.createElement('a');
      back.className = 'account-back'; back.href = '#account-menu';
      back.innerHTML = accountIcon('back') + '<span>Account</span>';
      panel.prepend(back);
    });
    document.body.classList.add('account-navigation-ready');
    function activate(focus) {
      let hash = location.hash.slice(1);
      if (hash === 'overview') { hash = 'bookings'; history.replaceState(null, '', '#bookings'); }
      let target = document.getElementById(hash);
      target = target && target.closest('[data-account-section]');
      const menu = narrow.matches && hash === 'account-menu';
      if (!target) target = document.getElementById('bookings');
      document.body.classList.toggle('account-menu-view', menu);
      panels.forEach(panel => { panel.hidden = menu || panel !== target; });
      links.forEach(link => {
        if (!menu && link.hash === '#' + target.id) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      const current = menu || !['bookings','support','contact-team'].includes(target.id) ? '#account-menu' : target.id === 'bookings' ? '#bookings' : '#support';
      bottom.querySelectorAll('a').forEach(link => {
        if (link.hash === current) link.setAttribute('aria-current','page');
        else link.removeAttribute('aria-current');
      });
      if (!narrow.matches) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        if (focus) grid.querySelector('.account-content-stack').scrollTop = 0;
      }
      if (focus) {
        const heading = menu ? document.querySelector('.account-head h1') : target.querySelector('h2');
        heading.tabIndex = -1; heading.focus({ preventScroll: true });
        if (narrow.matches) document.querySelector('main').scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }
    // Recovery actions populate support fields in auth.js after this capture handler.
    grid.addEventListener('click', event => {
      if (!event.target.closest('.customer-recovery')) return;
      history.pushState(null, '', '#support'); activate(false);
    }, true);
    document.querySelector('main').addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (link.hash !== '#account-menu' && (!target || !target.closest('[data-account-section]'))) return;
      event.preventDefault();
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      activate(true);
    });
    window.addEventListener('hashchange', () => activate(false));
    window.addEventListener('popstate', () => activate(false));
    document.addEventListener('kridiya:account-route', () => activate(true));
    narrow.addEventListener('change', () => activate(false));
    activate(false);

    let filter = 'all';
    const filterGroup = document.querySelector('.account-booking-filters');
    function filterTravel() {
      const items = [...document.querySelectorAll('#enq-list [data-travel-kind]')];
      const ready = document.querySelector('#enq-list').dataset.loaded === 'true';
      filterGroup.hidden = !ready || !items.length;
      let visible = 0;
      items.forEach(item => { item.hidden = filter !== 'all' && item.dataset.travelKind !== filter; if (!item.hidden) visible++; });
      filterGroup.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.travelFilter === filter)));
      document.getElementById('travel-filter-status').textContent = ready && items.length ? visible + ' of ' + items.length + ' items' : '';
      document.getElementById('travel-filter-empty').hidden = !ready || !items.length || visible > 0;
    }
    document.getElementById('bookings').addEventListener('click', event => {
      const button = event.target.closest('[data-travel-filter]');
      if (!button) return;
      filter = button.dataset.travelFilter; filterTravel();
      if (button.closest('#travel-filter-empty')) filterGroup.querySelector('[data-travel-filter="all"]').focus();
    });
    document.addEventListener('kridiya:travel-updated', filterTravel);
    filterTravel();
  }
  function initializeAuthClose() {
    const close = document.querySelector('[data-auth-close]');
    if (!close) return;
    const panel = close.closest('[role="dialog"]');
    if (panel) panel.tabIndex = -1;
    function closeAuth() {
      if (document.body.dataset.page === 'login' && location.hash === '#sign-in-form' && matchMedia('(max-width: 820px)').matches) {
        panel?.classList.remove('auth-sheet-expanded');
        document.body.classList.remove('auth-login-open');
        if (panel) panel.scrollTop = 0;
        history.replaceState(null, '', location.pathname + location.search);
        document.querySelector('.account-access-login')?.focus();
        return;
      }
      location.href = 'index.html';
    }
    close.addEventListener('click', closeAuth);
    if (document.body.dataset.page === 'login') {
      document.addEventListener('click', event => {
        const link = event.target.closest('a[href]');
        if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin || !url.pathname.endsWith('/login.html')) return;
        event.preventDefault();
        const next = url.searchParams.get('next');
        const form = panel?.querySelector('form');
        if (form) form.dataset.authNext = safeAuthDestination(next, 'account.html');
        if (location.hash !== '#sign-in-form') location.hash = 'sign-in-form';
        else focusAuth();
      });
    }
    function panelIsVisible() {
      return !!panel && panel.getClientRects().length > 0 && getComputedStyle(panel).visibility !== 'hidden';
    }
    function focusAuth() {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.toggle('auth-login-open', location.hash === '#sign-in-form');
        if (panel && location.hash === '#sign-in-form') {
          panel.classList.remove('auth-sheet-expanded');
          panel.scrollTop = 0;
        }
        if (panelIsVisible()) {
          (matchMedia('(max-width: 640px)').matches ? panel : close).focus({ preventScroll: true });
        }
      }));
    }
    panel?.addEventListener('scroll', () => {
      if (document.body.dataset.page !== 'login' || !matchMedia('(max-width: 640px)').matches) return;
      if (panel.scrollTop > 1 && !panel.classList.contains('auth-sheet-expanded')) {
        panel.classList.add('auth-sheet-expanded');
        panel.scrollTop = 0;
      }
    }, { passive: true });
    window.addEventListener('hashchange', focusAuth);
    window.addEventListener('load', focusAuth, { once: true });
    focusAuth();
    document.addEventListener('keydown', event => {
      if (!panelIsVisible()) return;
      if (event.key === 'Escape') { event.preventDefault(); closeAuth(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
      if (!controls.length) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  function initializeInlineLoginDialog() {
    if (!document.body.classList.contains('consumer-site') || document.body.dataset.page === 'login') return;
    if (window.KridiyaAuth && (
      (typeof KridiyaAuth.session === 'function' && KridiyaAuth.session()) ||
      (typeof KridiyaAuth.hasPersistedAuth === 'function' && KridiyaAuth.hasPersistedAuth())
    )) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'consumer-login-dialog t-panel-slide';
    dialog.dataset.open = 'false';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'inline-sign-in-title');
    dialog.innerHTML = '<section class="auth-card auth-card--login">' +
      '<div class="auth-sheet-head"><span class="auth-sheet-handle" aria-hidden="true"></span><h1 id="inline-sign-in-title">Sign in</h1><button class="auth-close" type="button" aria-label="Close sign in"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<p class="auth-intro">Use the email address or mobile number saved on your Kridiya account.</p>' +
      '<form class="form-grid" method="post" data-mode="otp-request" novalidate>' +
        '<div class="form-banner error" hidden role="alert"></div>' +
        '<div class="field"><label for="inline-lg-identifier">EMAIL OR PHONE</label><input id="inline-lg-identifier" name="identifier" type="text" autocomplete="username" required aria-describedby="inline-login-identifier-hint" dir="ltr" placeholder="name@example.com / +971 50 123 4567"><span class="field-hint" id="inline-login-identifier-hint">Include the country code for mobile numbers.</span></div>' +
        '<div class="field" id="login-password-field" hidden><label for="inline-lg-pass">PASSWORD</label><div class="pw-wrap"><input id="inline-lg-pass" name="password" type="password" autocomplete="current-password" placeholder="Your password"><button type="button" class="pw-toggle" aria-label="Show password">SHOW</button></div></div>' +
        '<div class="field" id="login-code-field" hidden><label for="inline-lg-code">ONE-TIME CODE</label><input id="inline-lg-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" dir="ltr" placeholder="6-digit code"></div>' +
        '<div class="auth-form-row auth-form-row--end" id="login-forgot-row" hidden><a href="forgot-password.html">Forgot password?</a></div>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit" data-label="Send one-time code">Send one-time code</button>' +
        '<div class="auth-method-row"><button class="auth-method-toggle" id="auth-method-toggle" type="button">Use password instead</button><button class="auth-method-toggle" id="otp-change-identifier" type="button" hidden>Change email or phone</button></div>' +
      '</form>' +
      '<div class="auth-provider-divider" role="separator" aria-label="Alternative sign-in option"><span>or</span></div>' +
      '<button class="auth-google-btn" id="google-login-btn" type="button"><svg aria-hidden="true" viewBox="0 0 18 18" focusable="false"><path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.259h2.909c1.702-1.567 2.684-3.876 2.684-6.615Z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.91-2.259c-.805.54-1.835.859-3.046.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.706A5.42 5.42 0 0 1 3.681 9c0-.592.102-1.167.282-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z"/><path fill="#EA4335" d="M9 3.58c1.322 0 2.508.455 3.441 1.346l2.582-2.582C13.463.892 11.427 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"/></svg><span class="auth-provider-label">Continue with Google</span></button>' +
      '<div class="auth-actions" aria-label="Other account options"><a href="register.html">Create account</a><a href="track-enquiry.html">Track an enquiry</a></div>' +
    '</section>';
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const close = dialog.querySelector('.auth-close');
    let trigger = null;
    let previousOverflow = '';
    let closeTimer = 0;
    let openFrame = 0;
    function motionDuration(property) {
      const value = getComputedStyle(dialog).getPropertyValue(property).trim();
      return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
    }
    function closeDialog() {
      if (!dialog.open) return;
      dialog.dataset.open = 'false';
      window.cancelAnimationFrame(openFrame);
      window.clearTimeout(closeTimer);
      const animate = matchMedia('(max-width: 640px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!animate) { dialog.close(); return; }
      closeTimer = window.setTimeout(() => dialog.close(), motionDuration('--panel-close-dur'));
    }
    close.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
    });
    dialog.addEventListener('close', () => {
      window.cancelAnimationFrame(openFrame);
      window.clearTimeout(closeTimer);
      dialog.dataset.open = 'false';
      dialog.classList.remove('auth-sheet-expanded');
      dialog.scrollTop = 0;
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
      trigger = null;
    });
    dialog.addEventListener('scroll', () => {
      if (!matchMedia('(max-width: 640px)').matches || dialog.scrollTop <= 1 || dialog.classList.contains('auth-sheet-expanded')) return;
      dialog.classList.add('auth-sheet-expanded');
      dialog.scrollTop = 0;
    }, { passive: true });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !url.pathname.endsWith('/login.html')) return;
      event.preventDefault();
      trigger = link;
      form.dataset.authNext = safeAuthDestination(url.searchParams.get('next') || currentReturnDestination(), 'account.html');
      window.clearTimeout(closeTimer);
      if (!dialog.open) {
        dialog.classList.remove('auth-sheet-expanded');
        dialog.scrollTop = 0;
        previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        if (matchMedia('(max-width: 640px)').matches) dialog.focus({ preventScroll: true });
      }
      window.cancelAnimationFrame(openFrame);
      dialog.dataset.open = 'false';
      openFrame = requestAnimationFrame(() => {
        openFrame = requestAnimationFrame(() => {
          dialog.dataset.open = 'true';
          (matchMedia('(max-width: 640px)').matches ? dialog : close).focus({ preventScroll: true });
        });
      });
    });
    document.dispatchEvent(new CustomEvent('kridiya:login-dialog-ready', { detail: { form } }));
  }
  function initialize() { initializeAccountDrawer(); initializeAccountNavigation(); initializeAccountAccessDirectory(); initializeAuthClose(); initializeInlineLoginDialog(); }
  document.addEventListener('kridiya:auth-state', event => {
    if (event.detail && event.detail.user) initializeAccountDrawer();
  });
  document.addEventListener('kridiya:chrome-ready', initializeAccountDrawer);
  // Deferred scripts run while readyState is interactive, before main.js has
  // inserted the header in its DOMContentLoaded handler.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
