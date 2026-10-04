/* Arumbu Cashews — login / signup / forgot / reset (Supabase Auth). */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var $ = function (id) { return document.getElementById(id); };
  var errEl = $('authError');

  // Only allow same-site relative redirects after login.
  function nextUrl() {
    var n = new URLSearchParams(window.location.search).get('next') || '';
    return /^[a-z0-9\-]+\.html([?#][^\s]*)?$/i.test(n) ? n : 'account.html';
  }
  document.querySelectorAll('[data-keep-next]').forEach(function (a) {
    var n = new URLSearchParams(window.location.search).get('next');
    if (n) a.href = a.getAttribute('href') + '?next=' + encodeURIComponent(n);
  });
  document.querySelectorAll('[data-toggle-pw]').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = $(b.getAttribute('data-toggle-pw'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? S.t('auth.hide', 'Hide') : S.t('auth.show', 'Show');
    });
  });

  function fail(err) { errEl.textContent = typeof err === 'string' ? err : S.errorText(err); }
  function busy(form, on) {
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = on;
    form.setAttribute('aria-busy', String(on));
  }
  function validEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim()); }

  var form = document.querySelector('form[data-auth]');
  if (!form || !S.client) { if (errEl) errEl.textContent = S.t('err.storeOffline', 'Accounts are not available right now.'); return; }
  var mode = form.getAttribute('data-auth');

  // Already signed in? Skip the login/signup forms.
  S.ready.then(function () {
    if ((mode === 'login' || mode === 'signup') && S.user()) window.location.replace(nextUrl());
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.textContent = '';
    if (mode === 'login') {
      if (!validEmail($('liEmail').value)) return fail(S.t('err.invalidEmail', 'Please enter a valid email address.'));
      if (!$('liPassword').value) return fail(S.t('auth.err.passwordRequired', 'Please enter your password.'));
      busy(form, true);
      S.auth.signIn($('liEmail').value, $('liPassword').value).then(function () {
        // store.js merges the guest cart + wishlist on SIGNED_IN; give it a moment.
        setTimeout(function () { window.location.href = nextUrl(); }, 600);
      }, function (err) { busy(form, false); fail(err); });
    }
    if (mode === 'signup') {
      var name = $('suName').value.trim();
      if (!name) return fail(S.t('err.invalidName', 'Please enter your name.'));
      if (!validEmail($('suEmail').value)) return fail(S.t('err.invalidEmail', 'Please enter a valid email address.'));
      if ($('suPassword').value.length < 8) return fail(S.t('auth.err.weakPassword', 'Password must be at least 8 characters.'));
      if (!$('suTerms').checked) return fail(S.t('checkout.agreeRequired', 'Please accept the terms to continue.'));
      busy(form, true);
      S.auth.signUp($('suEmail').value, $('suPassword').value, name, $('suPhone').value.trim()).then(function (data) {
        if (data && data.session) { setTimeout(function () { window.location.href = nextUrl(); }, 600); return; }
        form.hidden = true;
        $('signupDone').hidden = false;
      }, function (err) { busy(form, false); fail(err); });
    }
    if (mode === 'forgot') {
      if (!validEmail($('fpEmail').value)) return fail(S.t('err.invalidEmail', 'Please enter a valid email address.'));
      busy(form, true);
      S.auth.resetPassword($('fpEmail').value).then(function () {
        form.hidden = true; $('forgotDone').hidden = false;
      }, function (err) {
        // Don't reveal whether the email exists — show the same message,
        // except for rate limiting / network problems.
        if (/rate|network|fetch/i.test(String(err && err.message))) { busy(form, false); fail(err); }
        else { form.hidden = true; $('forgotDone').hidden = false; }
      });
    }
    if (mode === 'reset') {
      var p1 = $('rpPassword').value, p2 = $('rpPassword2').value;
      if (p1.length < 8) return fail(S.t('auth.err.weakPassword', 'Password must be at least 8 characters.'));
      if (p1 !== p2) return fail(S.t('auth.err.mismatch', 'The two passwords do not match.'));
      busy(form, true);
      S.auth.updatePassword(p1).then(function () {
        form.hidden = true; $('resetDone').hidden = false;
        setTimeout(function () { window.location.href = 'account.html'; }, 1500);
      }, function (err) { busy(form, false); fail(err); });
    }
  });

  // Reset page: the recovery link signs the user in with a temporary
  // session (detectSessionInUrl). Without it, the link is stale.
  if (mode === 'reset') {
    var gotRecovery = false;
    document.addEventListener('arumbu:recovery', function () { gotRecovery = true; $('resetNoSession').hidden = true; form.hidden = false; });
    S.ready.then(function () {
      setTimeout(function () {
        if (!gotRecovery && !S.user()) { $('resetNoSession').hidden = false; form.hidden = true; }
      }, 800);
    });
  }
})();
