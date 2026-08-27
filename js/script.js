/* ============================================
   ARUMBU CASHEWS — CORE INTERACTIONS
============================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Mobile menu / off-canvas drawer ---------- */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  var navOverlay = document.getElementById('navOverlay');
  var navDrawerClose = document.getElementById('navDrawerClose');

  function openDrawer() {
    if (!mainNav || !navToggle) return;
    mainNav.classList.add('is-open');
    navToggle.classList.add('is-active');
    navToggle.setAttribute('aria-expanded', 'true');
    if (navOverlay) navOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!mainNav || !navToggle) return;
    mainNav.classList.remove('is-open');
    navToggle.classList.remove('is-active');
    navToggle.setAttribute('aria-expanded', 'false');
    if (navOverlay) navOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      if (mainNav.classList.contains('is-open')) closeDrawer(); else openDrawer();
    });

    if (navDrawerClose) navDrawerClose.addEventListener('click', closeDrawer);
    if (navOverlay) navOverlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    /* Close the drawer when a plain nav link (not the Products
       dropdown trigger itself) is tapped. */
    mainNav.querySelectorAll('.nav-link:not(.nav-dropdown-trigger), .nav-call, .nav-dropdown-menu a').forEach(function (link) {
      link.addEventListener('click', closeDrawer);
    });
  }

  /* ---------- Header action popovers (Account / Cart / Wishlist) ----------
     Simple toggle buttons, each opening its own small flyout panel.
     Only one panel (and the search panel) is ever open at a time. */
  var actionToggles = [
    { btn: document.getElementById('accountToggle'), panel: document.getElementById('accountPanel') },
    { btn: document.getElementById('cartToggle'), panel: document.getElementById('cartPanel') },
    { btn: document.getElementById('wishlistToggle'), panel: document.getElementById('wishlistPanel') }
  ].filter(function (pair) { return pair.btn && pair.panel; });

  function closeAllActionPanels(except) {
    actionToggles.forEach(function (pair) {
      if (pair.panel === except) return;
      pair.panel.classList.remove('is-open');
      pair.btn.setAttribute('aria-expanded', 'false');
    });
  }

  actionToggles.forEach(function (pair) {
    pair.btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = pair.panel.classList.contains('is-open');
      closeSearchPanel();
      closeAllActionPanels(isOpen ? null : pair.panel);
      pair.panel.classList.toggle('is-open', !isOpen);
      pair.btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
  });

  /* Account panel's Log In / Create Account are placeholders until
     real Supabase Auth is wired in — they intentionally do nothing
     destructive yet, just signal where that hook will go. */
  document.querySelectorAll('[data-auth-action]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
    });
  });

  /* ---------- Products dropdown (desktop flyout) ----------
     Native <details>/<summary> gives free keyboard + accessibility
     behaviour, but it doesn't close on an outside click by default —
     add that, and make sure opening it closes the action/search
     panels so only one thing is ever open. */
  var productsDropdown = document.querySelector('.nav-dropdown');
  if (productsDropdown) {
    var productsSummary = productsDropdown.querySelector('summary');
    if (productsSummary) {
      productsSummary.addEventListener('click', function () {
        // fires before native toggle applies, so check the inverse
        if (!productsDropdown.hasAttribute('open')) {
          closeAllActionPanels(null);
          closeSearchPanel();
        }
      });
    }
    document.addEventListener('click', function (e) {
      if (!productsDropdown.contains(e.target)) productsDropdown.removeAttribute('open');
    });
  }

  /* Click anywhere outside an open action panel closes it. */
  document.addEventListener('click', function (e) {
    var withinAction = actionToggles.some(function (pair) {
      return pair.btn.contains(e.target) || pair.panel.contains(e.target);
    });
    if (!withinAction) closeAllActionPanels(null);
  });

  /* ---------- Search panel ----------
     Filters against the real, confirmed 13-grade list — no invented
     product data, and no external search service since there's no
     backend yet. Each result links to the Products page. */
  var searchToggle = document.getElementById('searchToggle');
  var searchPanel = document.getElementById('searchPanel');
  var searchInput = document.getElementById('searchInput');
  var searchResults = document.getElementById('searchResults');
  var searchEmpty = document.getElementById('searchEmpty');
  var searchClose = document.getElementById('searchClose');

  var GRADE_CODES = ['WW180', 'WW210', 'WW240', 'WW320', 'WW400', 'SW', 'SSW', 'LWP', 'CSP', 'BB', 'JH', 'SJH', 'JK'];

  function currentGradeName(code) {
    var lang = (window.arumbuI18n && window.arumbuI18n.getLang()) || 'en';
    var translated = window.arumbuI18n && window.arumbuI18n.translate('grade.' + code, lang);
    return translated || code;
  }

  var lastSearchQuery = '';

  function renderSearchResults(query) {
    if (!searchResults || !searchEmpty) return;
    lastSearchQuery = query;
    var q = query.trim().toUpperCase();
    var grades = GRADE_CODES.map(function (code) { return { code: code, name: currentGradeName(code) }; });
    var matches = q
      ? grades.filter(function (g) { return g.code.indexOf(q) !== -1 || g.name.toUpperCase().indexOf(q) !== -1; })
      : grades;

    searchResults.innerHTML = '';
    if (matches.length === 0) {
      searchEmpty.hidden = false;
      return;
    }
    searchEmpty.hidden = true;
    matches.forEach(function (grade) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = 'products.html';
      a.innerHTML = '<span class="search-result-code">' + grade.code + '</span>' +
                    '<span class="search-result-name">' + grade.name + '</span>';
      li.appendChild(a);
      searchResults.appendChild(li);
    });
  }

  // Called by i18n.js after a language switch, so open or freshly
  // rendered search results show grade names in the new language
  // without needing the user to retype their query.
  window.arumbuRefreshSearchResults = function () {
    if (searchResults) renderSearchResults(lastSearchQuery);
  };

  function closeSearchPanel() {
    if (!searchPanel || !searchToggle) return;
    searchPanel.classList.remove('is-open');
    searchToggle.setAttribute('aria-expanded', 'false');
  }

  if (searchToggle && searchPanel && searchInput) {
    searchToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = searchPanel.classList.contains('is-open');
      closeAllActionPanels(null);
      if (isOpen) {
        closeSearchPanel();
      } else {
        searchPanel.classList.add('is-open');
        searchToggle.setAttribute('aria-expanded', 'true');
        renderSearchResults('');
        window.setTimeout(function () { searchInput.focus(); }, 50);
      }
    });

    searchInput.addEventListener('input', function () { renderSearchResults(searchInput.value); });
    if (searchClose) searchClose.addEventListener('click', closeSearchPanel);

    document.addEventListener('click', function (e) {
      if (searchPanel.classList.contains('is-open') &&
          !searchPanel.contains(e.target) &&
          e.target !== searchToggle && !searchToggle.contains(e.target)) {
        closeSearchPanel();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearchPanel();
    });
  }

  /* ---------- Header ---------- */
  /* The Header is a normal part of the page flow everywhere (never
     fixed/sticky), so it simply scrolls away with the page — no
     scroll-based show/hide or background-swap logic is needed. */
  var siteHeader = document.getElementById('siteHeader');

  /* ---------- Back to top button ---------- */
  var backToTop = document.getElementById('backToTop');

  function updateBackToTop() {
    if (!backToTop) return;
    if (window.scrollY > 500) {
      backToTop.classList.add('is-visible');
    } else {
      backToTop.classList.remove('is-visible');
    }
  }

  if (backToTop) {
    updateBackToTop();
    window.addEventListener('scroll', updateBackToTop, { passive: true });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------- Reveal sections on scroll ---------- */
  var revealTargets = document.querySelectorAll(
    '.why-card, .product-card, .testimonial-card, .quality-step, .story-content, .story-media'
  );

  if ('IntersectionObserver' in window && revealTargets.length) {
    revealTargets.forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealTargets.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- WhatsApp floating button: hide near footer ---------- */
  var waFloat = document.querySelector('.whatsapp-float');
  var footer = document.querySelector('.site-footer');

  if (waFloat && footer && 'IntersectionObserver' in window) {
    var footerObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          waFloat.style.opacity = entry.isIntersecting ? '0' : '1';
          waFloat.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
        });
      },
      { threshold: 0.1 }
    );
    footerObserver.observe(footer);
    waFloat.style.transition = 'opacity 0.3s ease';
  }

  /* ---------- Smooth anchor scroll offset for fixed header ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId.length < 2) return;
      var target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      var headerHeight = siteHeader ? siteHeader.offsetHeight : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  /* ---------- Wholesale enquiry form ----------
     No backend on this static site, so the enquiry is sent through the
     same WhatsApp channel already used across the site: submitting the
     form opens a pre-filled WhatsApp chat with the enquiry details,
     then the page shows a clear on-page success message. */
  var wholesaleForm = document.getElementById('wholesaleForm');
  var wholesaleSuccess = document.getElementById('wholesaleSuccess');

  if (wholesaleForm) {
    wholesaleForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = wholesaleForm.name.value.trim();
      var company = wholesaleForm.company.value.trim();
      var phone = wholesaleForm.phone.value.trim();
      var whatsapp = wholesaleForm.whatsapp.value.trim();
      var email = wholesaleForm.email.value.trim();
      var grade = wholesaleForm.grade.value;
      var quantity = wholesaleForm.quantity.value.trim();
      var message = wholesaleForm.message.value.trim();

      var lines = ['Hi, I\'d like to make a wholesale enquiry.'];
      lines.push('Name: ' + name);
      if (company) lines.push('Company: ' + company);
      lines.push('Phone: ' + phone);
      if (whatsapp) lines.push('WhatsApp: ' + whatsapp);
      if (email) lines.push('Email: ' + email);
      lines.push('Grade: ' + grade);
      if (quantity) lines.push('Quantity: ' + quantity);
      if (message) lines.push('Message: ' + message);

      var waText = encodeURIComponent(lines.join('\n'));
      window.open('https://wa.me/919976055524?text=' + waText, '_blank', 'noopener');

      wholesaleForm.style.display = 'none';
      if (wholesaleSuccess) wholesaleSuccess.classList.add('is-visible');
      wholesaleForm.reset();
    });
  }

  /* ---------- Contact page form ----------
     Same pattern as the wholesale enquiry: no backend on this static
     site, so the message is sent through WhatsApp and the page shows
     an on-page success message. */
  var contactForm = document.getElementById('contactForm');
  var contactSuccess = document.getElementById('contactSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = contactForm.name.value.trim();
      var phone = contactForm.phone.value.trim();
      var email = contactForm.email.value.trim();
      var message = contactForm.message.value.trim();

      var lines = ['Hi, I have a question for Arumbu Cashews.'];
      lines.push('Name: ' + name);
      lines.push('Phone: ' + phone);
      if (email) lines.push('Email: ' + email);
      lines.push('Message: ' + message);

      var waText = encodeURIComponent(lines.join('\n'));
      window.open('https://wa.me/919080656477?text=' + waText, '_blank', 'noopener');

      contactForm.style.display = 'none';
      if (contactSuccess) contactSuccess.classList.add('is-visible');
      contactForm.reset();
    });
  }

  /* ---------- Opening / splash screen ----------
     Shows once per browser session on the homepage only — a repeat
     visit within the same session (e.g. clicking back to Home from
     another page) won't replay it. sessionStorage here is just UI
     state ("has this tab already seen the intro"), not a substitute
     for a real data store. */
  var splashScreen = document.getElementById('splashScreen');

  if (splashScreen) {
    var alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem('arumbuSplashSeen') === '1'; }
    catch (err) { /* sessionStorage unavailable (e.g. private mode) — just show it once, harmlessly */ }

    var dismissSplash = function () {
      document.body.classList.add('splash-done');
      splashScreen.setAttribute('aria-hidden', 'true');
      try { sessionStorage.setItem('arumbuSplashSeen', '1'); } catch (err) {}
    };

    if (alreadySeen) {
      document.body.classList.add('splash-done');
    } else {
      var skipBtn = document.getElementById('splashSkip');
      if (skipBtn) skipBtn.addEventListener('click', dismissSplash);

      // CSS drives the animation and its own fade-out; this just
      // unmounts the overlay from layout/AX tree once it's finished
      // (matches the ~2.3s + 0.5s fade defined in the CSS timeline).
      window.setTimeout(dismissSplash, 2900);
    }
  }

});
