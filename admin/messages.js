/* Arumbu Cashews — Admin: Contact messages & gifting enquiries.
   Both tables are insert-only for the public and readable/updatable
   only by admins (RLS). */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('messagesRoot');
  if (!A || !root) return;
  var esc = A.esc;
  var TABS = {
    contact: { table: 'contact_messages', title: 'Contact messages', statuses: ['new', 'contacted', 'closed'] },
    gifting: { table: 'gifting_enquiries', title: 'Gifting enquiries', statuses: ['new', 'contacted', 'quotation_sent', 'negotiation', 'converted', 'closed'] }
  };
  var state = { tab: 'contact', filter: 'all', rows: [] };

  function shell() {
    root.innerHTML = '<div class="content-subtabs">' + Object.keys(TABS).map(function (k) {
      return '<button type="button" class="content-subtab' + (state.tab === k ? ' is-active' : '') + '" data-tab="' + k + '">' + TABS[k].title + '</button>';
    }).join('') + '</div><div id="msgFilters"></div><div id="msgTable"><div class="products-message">Loading…</div></div>';
    root.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); state.filter = 'all'; shell(); load(); });
    });
  }

  function render() {
    var cfg = TABS[state.tab];
    document.getElementById('msgFilters').innerHTML = '<div class="status-filter-pills">' + ['all'].concat(cfg.statuses).map(function (s) {
      var n = state.rows.filter(function (r) { return s === 'all' || r.status === s; }).length;
      return '<button type="button" class="status-filter-pill' + (state.filter === s ? ' is-active' : '') + '" data-f="' + s + '">' + A.label(s) + ' (' + n + ')</button>';
    }).join('') + '</div>';
    document.querySelectorAll('#msgFilters [data-f]').forEach(function (b) { b.addEventListener('click', function () { state.filter = b.getAttribute('data-f'); render(); }); });
    var list = state.rows.filter(function (r) { return state.filter === 'all' || r.status === state.filter; });
    var box = document.getElementById('msgTable');
    if (!list.length) { box.innerHTML = '<div class="products-message">Nothing here yet.</div>'; return; }
    box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Received</th><th>From</th><th>' + (state.tab === 'gifting' ? 'Occasion / qty' : 'Message') + '</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (r) {
        var unread = state.tab === 'contact' && !r.is_read;
        return '<tr' + (unread ? ' class="row-unread"' : '') + '><td class="cell-muted">' + esc(A.date(r.created_at, true)) + '</td>' +
          '<td>' + (unread ? '<strong>' : '') + esc(r.name) + (unread ? '</strong>' : '') + '<div class="cell-muted">' + esc(r.phone || '') + (r.company ? ' · ' + esc(r.company) : '') + '</div></td>' +
          '<td class="cell-muted">' + (state.tab === 'gifting' ? esc(A.label(r.occasion)) + (r.quantity ? ' · ' + esc(r.quantity) : '') : esc(String(r.message || '').slice(0, 90))) + '</td>' +
          '<td><span class="product-status-pill" data-status="' + (r.status === 'new' ? 'draft' : r.status === 'closed' ? 'hidden' : 'active') + '">' + esc(A.label(r.status)) + '</span></td>' +
          '<td class="cell-actions"><button type="button" class="product-form-cancel" data-open="' + esc(r.id) + '">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    box.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-open')); }); });
  }

  function open(id) {
    var cfg = TABS[state.tab];
    var r = state.rows.filter(function (x) { return x.id === id; })[0];
    var wa = A.waLink(r.phone);
    var fields = state.tab === 'gifting'
      ? [['Company', r.company], ['Occasion', A.label(r.occasion)], ['Quantity', r.quantity], ['Needed by', r.required_by], ['Location', r.location]]
      : [['Subject', r.subject]];
    var m = A.modal({ title: r.name, body:
      '<div class="enquiry-detail"><dl>' +
        '<dt>Phone</dt><dd><a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' + (wa ? ' · <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</dd>' +
        '<dt>Email</dt><dd>' + (r.email ? '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>' : '—') + '</dd>' +
        fields.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + esc(f[1] || '—') + '</dd>'; }).join('') +
        '<dt>Received</dt><dd>' + esc(A.date(r.created_at, true)) + '</dd>' +
      '</dl>' + (r.message ? '<div class="message-box">' + esc(r.message) + '</div>' : '') +
      '<p class="product-form-error" id="msgErr"></p>' +
      '<div class="product-form-grid">' +
        '<div class="form-field"><label for="msgStatus">Status</label><select id="msgStatus">' + cfg.statuses.map(function (s) { return '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + A.label(s) + '</option>'; }).join('') + '</select></div>' +
        '<div class="form-field form-field-full"><label for="msgNotes">Internal notes</label><textarea id="msgNotes" rows="3" maxlength="4000">' + esc(r.admin_notes || '') + '</textarea></div>' +
        '<div class="product-form-actions"><button type="button" class="product-icon-btn is-danger" id="msgDel" style="width:auto;padding:.6rem 1rem">Delete</button><button type="button" class="product-form-cancel" data-close>Close</button><button type="button" class="product-form-submit" id="msgSave">Save</button></div>' +
      '</div></div>' });
    if (state.tab === 'contact' && !r.is_read) {
      A.client().from(cfg.table).update({ is_read: true }).eq('id', r.id).then(function () { r.is_read = true; render(); });
    }
    m.querySelector('#msgSave').addEventListener('click', function () {
      A.client().from(cfg.table).update({ status: m.querySelector('#msgStatus').value, admin_notes: m.querySelector('#msgNotes').value.trim() || null }).eq('id', r.id).then(function (res) {
        if (res.error) { var e = m.querySelector('#msgErr'); e.textContent = A.errMsg(res.error); e.classList.add('is-visible'); return; }
        A.closeModal(); A.toast('Saved'); load();
      });
    });
    m.querySelector('#msgDel').addEventListener('click', function () {
      if (!window.confirm('Delete this ' + (state.tab === 'gifting' ? 'enquiry' : 'message') + ' from ' + r.name + '? This cannot be undone.')) return;
      A.client().from(cfg.table).delete().eq('id', r.id).then(function (res) {
        if (res.error) return A.toast(A.errMsg(res.error), true);
        A.closeModal(); A.toast('Deleted'); load();
      });
    });
  }

  function load() {
    var cfg = TABS[state.tab];
    return A.client().from(cfg.table).select('*').order('created_at', { ascending: false }).limit(1000).then(function (res) {
      if (res.error) { document.getElementById('msgTable').innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
      state.rows = res.data || [];
      render();
    });
  }

  var started = false;
  A.onSection('messages', function () { if (!started) { started = true; shell(); } load(); });
})();
