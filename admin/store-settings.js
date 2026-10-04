/* Arumbu Cashews — Admin: Store settings, coupons and notifications.
   Settings are rows in site_settings (public-readable except internal admin notification email, admin-writable).
   Never put secret keys here — the Razorpay key SECRET, webhook secret
   and email API key belong in Supabase Edge Function secrets only. */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('storeSettingsRoot');
  if (!A || !root) return;
  var esc = A.esc;
  var state = { tab: 'settings', settings: {}, coupons: [], outbox: [] };

  var GROUPS = [
    ['Ordering & delivery', [
      ['whatsapp_orders_enabled', 'WhatsApp ordering at checkout', 'bool'],
      ['delivery_fee', 'Delivery fee (₹, blank = confirm per order on WhatsApp)', 'money'],
      ['free_delivery_threshold', 'Free delivery above (₹, optional)', 'money'],
      ['site_url', 'Website address (used in links and emails)', 'url']
    ]],
    ['Online payments (Razorpay)', [
      ['payments_razorpay_enabled', 'Accept online payments', 'bool'],
      ['razorpay_key_id', 'Razorpay Key ID (public, starts with rzp_)', 'text']
    ]],
    ['GST & invoices', [
      ['gst_enabled', 'Charge / show GST', 'bool'],
      ['gst_rate', 'GST rate (%)', 'money'],
      ['gst_prices_inclusive', 'Prices already include GST', 'bool'],
      ['gstin', 'GSTIN', 'text'],
      ['invoice_business_name', 'Business name on invoice', 'text'],
      ['invoice_address', 'Address on invoice', 'textarea'],
      ['invoice_footer', 'Invoice footer note', 'textarea']
    ]],
    ['Notifications & analytics', [
      ['notify_admin_email', 'Email for new orders / enquiries', 'email'],
      ['ga_measurement_id', 'Google Analytics 4 Measurement ID (G-XXXX)', 'text']
    ]],
    ['More social links (footer)', [
      ['social_youtube_url', 'YouTube URL', 'url'],
      ['social_linkedin_url', 'LinkedIn URL', 'url'],
      ['social_x_url', 'X (Twitter) URL', 'url']
    ]]
  ];

  function shell() {
    var tabs = [['settings', 'Store settings'], ['coupons', 'Coupons'], ['outbox', 'Notifications']];
    root.innerHTML = '<div class="content-subtabs">' + tabs.map(function (t) {
      return '<button type="button" class="content-subtab' + (state.tab === t[0] ? ' is-active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="ssPanel"><div class="products-message">Loading…</div></div>';
    root.querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); shell(); load(); }); });
  }

  function renderSettings(p) {
    p.innerHTML = '<p class="cell-muted admin-help">These values drive pricing, delivery and tax in the database checkout — the site cannot charge anything that is not configured here. Secret keys are not stored here.</p>' +
      GROUPS.map(function (g) {
        return '<div class="content-card"><h3>' + g[0] + '</h3>' + g[1].map(function (f) {
          var v = state.settings[f[0]] == null ? '' : state.settings[f[0]];
          var input = f[2] === 'bool'
            ? '<select id="set_' + f[0] + '"><option value="true"' + (v === 'true' ? ' selected' : '') + '>Yes</option><option value="false"' + (v !== 'true' ? ' selected' : '') + '>No</option></select>'
            : f[2] === 'textarea' ? '<textarea id="set_' + f[0] + '" rows="3">' + esc(v) + '</textarea>'
            : '<input id="set_' + f[0] + '" value="' + esc(v) + '"' + (f[2] === 'money' ? ' inputmode="decimal"' : '') + '>';
          return '<div class="settings-row"><label for="set_' + f[0] + '">' + esc(f[1]) + '</label>' + input + '</div>';
        }).join('') + '</div>';
      }).join('') +
      '<div class="content-save-bar"><button type="button" class="product-form-submit" id="ssSave">Save settings</button><span class="upload-status" id="ssSt"></span></div>';
    document.getElementById('ssSave').addEventListener('click', save);
  }

  function save() {
    var st = document.getElementById('ssSt');
    var updates = [], problem = null;
    GROUPS.forEach(function (g) {
      g[1].forEach(function (f) {
        var v = document.getElementById('set_' + f[0]).value.trim();
        if (f[2] === 'money' && v && !/^[0-9]+(\.[0-9]{1,2})?$/.test(v)) problem = f[1] + ': use a number like 60 or 60.50';
        if (f[2] === 'url' && v && !/^https:\/\/[^\s]+$/.test(v)) problem = f[1] + ': must start with https://';
        if (f[2] === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) problem = f[1] + ': not a valid email';
        if (f[0] === 'ga_measurement_id' && v && !/^G-[A-Z0-9]{4,}$/i.test(v)) problem = 'GA4 ID must look like G-XXXXXXX';
        if (f[0] === 'razorpay_key_id' && v && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(v)) problem = 'Razorpay Key ID must start with rzp_test_ or rzp_live_';
        if (f[0] === 'gstin' && v && !/^[0-9]{2}[A-Z0-9]{13}$/.test(v)) problem = 'GSTIN should be 15 characters';
        if (f[0] === 'gst_rate' && v && Number(v) > 28) problem = 'GST rate looks too high';
        if (v !== (state.settings[f[0]] || '')) updates.push({ key: f[0], value: v });
      });
    });
    var rz = document.getElementById('set_payments_razorpay_enabled').value === 'true';
    if (rz && !document.getElementById('set_razorpay_key_id').value.trim()) problem = 'Add the Razorpay Key ID before enabling online payments.';
    if (rz && !document.getElementById('set_delivery_fee').value.trim()) problem = 'Online payments need a fixed delivery fee (0 for free delivery), so the amount charged is final.';
    if (document.getElementById('set_gst_enabled').value === 'true' && !document.getElementById('set_gst_rate').value.trim()) problem = 'Enter the GST rate or switch GST off.';
    if (problem) { st.textContent = problem; st.className = 'upload-status is-error'; return; }
    if (!updates.length) { st.textContent = 'No changes.'; st.className = 'upload-status'; return; }
    st.textContent = 'Saving…'; st.className = 'upload-status';
    A.client().from('site_settings').upsert(updates, { onConflict: 'key' }).then(function (res) {
      if (res.error) { st.textContent = A.errMsg(res.error); st.className = 'upload-status is-error'; return; }
      updates.forEach(function (u) { state.settings[u.key] = u.value; });
      st.textContent = 'Saved ' + updates.length + ' setting' + (updates.length > 1 ? 's' : '') + '.'; st.className = 'upload-status is-success';
    });
  }

  /* ---------- coupons ---------- */
  function renderCoupons(p) {
    p.innerHTML = '<div class="products-toolbar"><span class="products-count">' + state.coupons.length + ' coupons</span><button type="button" class="products-add-btn" id="cpAdd">Add coupon</button></div>' +
      (state.coupons.length ? '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Valid</th><th>Used</th><th>Active</th><th></th></tr></thead><tbody>' +
        state.coupons.map(function (c) {
          return '<tr><td><strong>' + esc(c.code) + '</strong><div class="cell-muted">' + esc(c.description || '') + '</div></td>' +
            '<td>' + (c.discount_type === 'percent' ? esc(Number(c.value)) + '%' + (c.max_discount ? ' (max ' + A.money(c.max_discount) + ')' : '') : A.money(c.value)) + '</td>' +
            '<td>' + A.money(c.min_order_amount) + '</td><td class="cell-muted">' + (c.starts_at ? A.date(c.starts_at) : 'now') + ' → ' + (c.ends_at ? A.date(c.ends_at) : 'no end') + '</td>' +
            '<td>' + esc(c.used_count) + (c.usage_limit ? ' / ' + esc(c.usage_limit) : '') + '</td><td>' + (c.is_active ? 'Yes' : 'No') + '</td>' +
            '<td class="cell-actions"><button type="button" class="product-form-cancel" data-edit="' + esc(c.id) + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="products-message">No coupons.</div>');
    document.getElementById('cpAdd').addEventListener('click', function () { couponForm(null); });
    p.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { couponForm(state.coupons.filter(function (c) { return c.id === b.getAttribute('data-edit'); })[0]); }); });
  }
  function couponForm(c) {
    c = c || { code: '', description: '', discount_type: 'percent', value: '', min_order_amount: 0, max_discount: null, starts_at: null, ends_at: null, usage_limit: null, is_active: true };
    var d = function (x) { return x ? String(x).slice(0, 10) : ''; };
    var m = A.modal({ title: c.id ? 'Edit coupon' : 'Add coupon', body: '<p class="product-form-error" id="cpErr"></p><div class="product-form-grid">' +
      '<div class="form-field"><label>Code</label><input id="cpCode" value="' + esc(c.code) + '" maxlength="30"' + (c.id ? ' readonly' : '') + ' style="text-transform:uppercase"></div>' +
      '<div class="form-field"><label>Description (internal)</label><input id="cpDesc" value="' + esc(c.description || '') + '" maxlength="160"></div>' +
      '<div class="form-field"><label>Type</label><select id="cpType"><option value="percent"' + (c.discount_type === 'percent' ? ' selected' : '') + '>Percent</option><option value="fixed"' + (c.discount_type === 'fixed' ? ' selected' : '') + '>Fixed ₹</option></select></div>' +
      '<div class="form-field"><label>Value</label><input id="cpVal" type="number" min="0" step="0.01" value="' + esc(c.value) + '"></div>' +
      '<div class="form-field"><label>Minimum order ₹</label><input id="cpMin" type="number" min="0" step="0.01" value="' + esc(c.min_order_amount) + '"></div>' +
      '<div class="form-field"><label>Max discount ₹ (percent only)</label><input id="cpMax" type="number" min="0" step="0.01" value="' + esc(c.max_discount == null ? '' : c.max_discount) + '"></div>' +
      '<div class="form-field"><label>Starts</label><input id="cpStart" type="date" value="' + d(c.starts_at) + '"></div>' +
      '<div class="form-field"><label>Ends</label><input id="cpEnd" type="date" value="' + d(c.ends_at) + '"></div>' +
      '<div class="form-field"><label>Usage limit (blank = unlimited)</label><input id="cpLimit" type="number" min="1" step="1" value="' + esc(c.usage_limit == null ? '' : c.usage_limit) + '"></div>' +
      '<div class="product-form-checks"><label class="product-form-check"><input type="checkbox" id="cpActive"' + (c.is_active ? ' checked' : '') + '> Active</label></div>' +
      '<div class="product-form-actions"><button type="button" class="product-form-cancel" data-close>Cancel</button><button type="button" class="product-form-submit" id="cpSave">Save</button></div></div>' });
    m.querySelector('#cpSave').addEventListener('click', function () {
      var num = function (id) { var v = m.querySelector(id).value; return v === '' ? null : Number(v); };
      var row = { description: m.querySelector('#cpDesc').value.trim() || null, discount_type: m.querySelector('#cpType').value, value: num('#cpVal'),
        min_order_amount: num('#cpMin') || 0, max_discount: num('#cpMax'), usage_limit: num('#cpLimit'), is_active: m.querySelector('#cpActive').checked,
        starts_at: m.querySelector('#cpStart').value ? m.querySelector('#cpStart').value + 'T00:00:00+05:30' : null,
        ends_at: m.querySelector('#cpEnd').value ? m.querySelector('#cpEnd').value + 'T23:59:59+05:30' : null };
      var err = m.querySelector('#cpErr');
      var fail = function (t) { err.textContent = t; err.classList.add('is-visible'); };
      if (!c.id) row.code = m.querySelector('#cpCode').value.trim().toUpperCase();
      if (!c.id && !/^[A-Z0-9_-]{3,30}$/.test(row.code)) return fail('Code: 3–30 letters, numbers, - or _.');
      if (!(row.value > 0)) return fail('Value must be more than 0.');
      if (row.discount_type === 'percent' && row.value > 100) return fail('Percent cannot exceed 100.');
      (c.id ? A.client().from('coupons').update(row).eq('id', c.id) : A.client().from('coupons').insert(row)).then(function (res) {
        if (res.error) return fail(/duplicate|unique/i.test(res.error.message) ? 'That code already exists.' : A.errMsg(res.error));
        A.closeModal(); A.toast('Saved'); load();
      });
    });
  }

  /* ---------- notifications outbox ---------- */
  function renderOutbox(p) {
    var queued = state.outbox.filter(function (n) { return n.status === 'queued'; }).length;
    p.innerHTML = '<p class="cell-muted admin-help">Order and enquiry notifications are queued here. Emails are sent by the “notify” server function once an email provider (Resend) is configured in Supabase secrets; WhatsApp/SMS providers are not connected. Rows without a recipient email are skipped.</p>' +
      '<div class="admin-toolbar"><button type="button" class="product-form-submit" id="obSend"' + (queued ? '' : ' disabled') + '>Send ' + queued + ' queued</button><span class="upload-status" id="obSt"></span></div>' +
      (state.outbox.length ? '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>When</th><th>Event</th><th>To</th><th>Status</th><th>Error</th></tr></thead><tbody>' +
        state.outbox.map(function (n) {
          return '<tr><td class="cell-muted">' + esc(A.date(n.created_at, true)) + '</td><td>' + esc(A.label(n.event)) + '<div class="cell-muted">' + esc((n.payload && n.payload.order_number) || '') + '</div></td><td>' + esc(n.audience) + ' · ' + esc(n.recipient || '—') + '</td><td>' + esc(A.label(n.status)) + '</td><td class="cell-muted">' + esc(String(n.last_error || '').slice(0, 80)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="products-message">No notifications yet.</div>');
    document.getElementById('obSend').addEventListener('click', function () {
      var btn = this, st = document.getElementById('obSt');
      btn.disabled = true; st.textContent = 'Sending…'; st.className = 'upload-status';
      A.client().auth.getSession().then(function (r) {
        var tok = r.data.session && r.data.session.access_token;
        return fetch(window.ARUMBU_FUNCTIONS_URL + '/notify', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, apikey: window.ARUMBU_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' });
      }).then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok) { st.textContent = 'Could not run: ' + (r.j.error || r.j.message || 'error'); st.className = 'upload-status is-error'; btn.disabled = false; return; }
          if (r.j.configured === false) { st.textContent = 'Email provider not configured yet (RESEND_API_KEY / NOTIFY_FROM_EMAIL).'; st.className = 'upload-status is-error'; btn.disabled = false; return; }
          st.textContent = 'Sent ' + r.j.sent + ', failed ' + r.j.failed + ', skipped ' + r.j.skipped + '.'; st.className = 'upload-status is-success';
          load();
        }, function () { st.textContent = 'The notify function is not reachable (not deployed?).'; st.className = 'upload-status is-error'; btn.disabled = false; });
    });
  }

  function load() {
    var p = document.getElementById('ssPanel');
    if (state.tab === 'settings') return A.client().from('site_settings').select('key, value').then(function (res) {
      if (res.error) { p.innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
      state.settings = {}; (res.data || []).forEach(function (r) { state.settings[r.key] = r.value; });
      renderSettings(p);
    });
    if (state.tab === 'coupons') return A.client().from('coupons').select('*').order('created_at', { ascending: false }).then(function (res) {
      if (res.error) { p.innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
      state.coupons = res.data || []; renderCoupons(p);
    });
    return A.client().from('notification_outbox').select('*').order('created_at', { ascending: false }).limit(300).then(function (res) {
      if (res.error) { p.innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
      state.outbox = res.data || []; renderOutbox(p);
    });
  }

  var started = false;
  A.onSection('store-settings', function () { if (!started) { started = true; shell(); } load(); });
})();
