/* Arumbu Cashews — shared helpers for the admin modules added for the
   commerce platform (orders, inventory, customers, messages, CMS,
   store settings). Uses the same authenticated client as the rest of
   the admin (window.ArumbuAdminAuth). Every write goes through RLS
   (is_admin()) or an admin-only database function. */
(function () {
  'use strict';

  function client() { return window.ArumbuAdminAuth.getClient(); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function date(d, withTime) {
    if (!d) return '—';
    var dt = new Date(d);
    var s = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return withTime ? s + ', ' + dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : s;
  }
  function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  /* ---------- modal ---------- */
  var overlay = null;
  function closeModal() {
    if (overlay) { overlay.remove(); overlay = null; document.body.style.overflow = ''; }
  }
  // opts: { title, body (html), wide, onOpen(el) }
  function modal(opts) {
    closeModal();
    overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML =
      '<div class="admin-modal' + (opts.wide ? ' admin-modal-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="acmTitle">' +
        '<div class="admin-modal-head"><h2 id="acmTitle">' + esc(opts.title) + '</h2>' +
        '<button type="button" class="admin-modal-close" aria-label="Close" data-close>&times;</button></div>' +
        '<div class="acm-body">' + opts.body + '</div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.closest('[data-close]')) closeModal();
    });
    var first = overlay.querySelector('input, select, textarea, button:not([data-close])');
    if (first) first.focus();
    if (opts.onOpen) opts.onOpen(overlay.querySelector('.admin-modal'));
    return overlay.querySelector('.admin-modal');
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay) closeModal(); });

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(msg, isError) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'admin-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'admin-toast is-visible' + (isError ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'admin-toast'; }, 3200);
  }

  function errMsg(err) {
    var m = (err && (err.message || err.error)) || String(err || 'Unknown error');
    var map = {
      invalid_transition: 'That status change is not allowed from the current status.',
      not_admin: 'Your account is not authorised for this action.',
      order_not_found: 'Order not found.',
      invalid_stock: 'Stock must be a whole number of 0 or more.'
    };
    var code = m.split(':')[0].trim();
    return map[code] || m;
  }

  /* ---------- CSV ---------- */
  function downloadCsv(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (v) {
        var s = v == null ? '' : String(v);
        if (/^[=+\-@]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function waLink(phone, text) {
    var d = String(phone || '').replace(/[^0-9]/g, '');
    if (d.length === 10) d = '91' + d;
    return d ? 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '') : null;
  }

  /* ---------- section loader: render a module when its section opens ---------- */
  // Modules render only after the dashboard's auth guard confirms an
  // authorised admin session (markReady), so no query runs signed-out.
  var loaders = {};
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });
  function onSection(name, fn) { loaders[name] = fn; }
  function sectionShown(name) { ready.then(function () { if (loaders[name]) loaders[name](); }); }
  function markReady() { readyResolve(); }

  window.ArumbuAdmin = {
    client: client, esc: esc, money: money, date: date, label: label, modal: modal, closeModal: closeModal,
    toast: toast, errMsg: errMsg, downloadCsv: downloadCsv, waLink: waLink, onSection: onSection, sectionShown: sectionShown, markReady: markReady, ready: ready
  };
})();
