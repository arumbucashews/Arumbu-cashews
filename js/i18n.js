/* ============================================================
   ARUMBU CASHEWS — i18n ENGINE
   ============================================================
   Reads ARUMBU_TRANSLATIONS (js/i18n-dictionary.js, must load
   BEFORE this file) and applies it across the page. Works the
   same way on every page — each is a full document load (this is
   a static multi-page site, not a single-page app), so this
   engine re-runs on every navigation and re-applies the saved
   language choice, which is how the "remember my language across
   pages" requirement is met without a server.

   Marking up translatable content:
     data-i18n="key"             -> element.textContent
     data-i18n-html="key"        -> element.innerHTML (only for
                                     entries that intentionally
                                     contain inline tags like <em>
                                     or <span>, defined in the
                                     dictionary itself — never for
                                     user input)
     data-i18n-placeholder="key" -> element.placeholder
     data-i18n-aria="key"        -> element.setAttribute('aria-label', ...)
     data-i18n-content="key"     -> element.setAttribute('content', ...)
                                     (meta tags)

   Adding a third language later: add the language to every entry
   in the dictionary, add one more <button data-lang="xx"> in the
   switcher markup in each page's header, done — nothing here
   needs to change.
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'arumbuLang';
  var DEFAULT_LANG = 'en';
  var SUPPORTED = ['en', 'ta'];

  function getStoredLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (err) { /* localStorage unavailable (private mode etc.) — fall back to default */ }
    return DEFAULT_LANG;
  }

  function storeLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (err) { /* non-fatal — language just won't persist this session */ }
  }

  function translate(key, lang) {
    var entry = window.ARUMBU_TRANSLATIONS && window.ARUMBU_TRANSLATIONS[key];
    if (!entry) return null;
    return entry[lang] || entry[DEFAULT_LANG] || null;
  }

  function applyTranslations(lang) {
    if (!window.ARUMBU_TRANSLATIONS) return; // dictionary not loaded — leave existing (English) text as-is

    document.documentElement.setAttribute('lang', lang === 'ta' ? 'ta' : 'en');

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n'), lang);
      if (value !== null) el.textContent = value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-html'), lang);
      if (value !== null) el.innerHTML = value;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-placeholder'), lang);
      if (value !== null) el.setAttribute('placeholder', value);
    });

    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-aria'), lang);
      if (value !== null) el.setAttribute('aria-label', value);
    });

    document.querySelectorAll('[data-i18n-content]').forEach(function (el) {
      var value = translate(el.getAttribute('data-i18n-content'), lang);
      if (value !== null) el.setAttribute('content', value);
    });

    // Keep the language-switcher buttons themselves showing which
    // one is active, on every page.
    document.querySelectorAll('.lang-switch-btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Re-render the header search results (they're built from JS,
    // not from data-i18n markup) so grade full-names switch too.
    if (typeof window.arumbuRefreshSearchResults === 'function') {
      window.arumbuRefreshSearchResults();
    }
  }

  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    storeLang(lang);
    applyTranslations(lang);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var current = getStoredLang();
    applyTranslations(current);

    document.querySelectorAll('.lang-switch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setLanguage(btn.getAttribute('data-lang'));
      });
    });
  });

  // Exposed in case other scripts (e.g. dynamically-built search
  // results) need to translate on demand.
  window.arumbuI18n = { translate: translate, getLang: getStoredLang, setLang: setLanguage };
})();
