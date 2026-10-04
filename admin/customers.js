/* Arumbu Cashews — Admin: Customers (read-only view of registered
   customers, their orders and saved addresses). */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('customersRoot');
  if (!A || !root) return;
  var esc = A.esc;
  var state = { rows: [], orders: [], q: '' };

  function shell() {
    root.innerHTML = '<div class="admin-toolbar"><input type="search" id="cuSearch" placeholder="Search name, email or phone">' +
      '<button type="button" class="product-form-cancel" id="cuCsv">Export CSV</button></div><div id="cuTable"><div class="products-message">Loading…</div></div>';
    var t;
    document.getElementById('cuSearch').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { state.q = v; render(); }, 150); });
    document.getElementById('cuCsv').addEventListener('click', function () {
      var out = [['Name', 'Email', 'Phone', 'Language', 'Joined', 'Orders', 'Paid total']];
      list().forEach(function (c) { out.push([c.full_name, c.email, c.phone, c.preferred_language, c.created_at, c.orderCount, c.paidTotal]); });
      A.downloadCsv('arumbu-customers-' + new Date().toISOString().slice(0, 10) + '.csv', out);
    });
  }

  function list() {
    var q = state.q.trim().toLowerCase();
    return state.rows.map(function (c) {
      var os = state.orders.filter(function (o) { return o.customer_id === c.id; });
      c.orderCount = os.length;
      c.paidTotal = os.filter(function (o) { return o.payment_status === 'paid'; }).reduce(function (s, o) { return s + Number(o.total || 0); }, 0);
      c.lastOrder = os[0] ? os[0].created_at : null;
      return c;
    }).filter(function (c) { return !q || [c.full_name, c.email, c.phone].join(' ').toLowerCase().indexOf(q) > -1; });
  }

  function render() {
    var rows = list();
    var box = document.getElementById('cuTable');
    if (!rows.length) { box.innerHTML = '<div class="products-message">No customers yet.</div>'; return; }
    box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Customer</th><th>Phone</th><th>Joined</th><th>Orders</th><th>Paid</th><th></th></tr></thead><tbody>' +
      rows.map(function (c) {
        return '<tr><td>' + esc(c.full_name || '—') + '<div class="cell-muted">' + esc(c.email || '') + '</div></td><td>' + esc(c.phone || '—') + '</td>' +
          '<td class="cell-muted">' + esc(A.date(c.created_at)) + '</td><td>' + c.orderCount + '</td><td>' + esc(A.money(c.paidTotal)) + '</td>' +
          '<td class="cell-actions"><button type="button" class="product-form-cancel" data-open="' + esc(c.id) + '">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    box.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { open(b.getAttribute('data-open')); }); });
  }

  function open(id) {
    var c = state.rows.filter(function (x) { return x.id === id; })[0];
    var os = state.orders.filter(function (o) { return o.customer_id === id; });
    A.client().from('customer_addresses').select('*').eq('customer_id', id).then(function (res) {
      var addrs = res.data || [];
      var wa = A.waLink(c.phone);
      var m = A.modal({ title: c.full_name || c.email, wide: true, body:
        '<div class="enquiry-detail"><dl><dt>Email</dt><dd>' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '—') + '</dd>' +
        '<dt>Phone</dt><dd>' + esc(c.phone || '—') + (wa ? ' · <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</dd>' +
        '<dt>Language</dt><dd>' + esc(c.preferred_language === 'ta' ? 'Tamil' : 'English') + '</dd><dt>Joined</dt><dd>' + esc(A.date(c.created_at)) + '</dd></dl></div>' +
        '<h3 class="admin-subhead">Orders</h3>' + (os.length ? '<div class="admin-table-wrap"><table class="admin-table" style="min-width:0"><tbody>' + os.map(function (o) {
          return '<tr><td><button type="button" class="link-like" data-order="' + esc(o.id) + '">' + esc(o.order_number) + '</button></td><td class="cell-muted">' + esc(A.date(o.created_at)) + '</td><td>' + esc(A.money(o.total)) + '</td><td>' + esc(A.label(o.order_status)) + '</td><td>' + esc(A.label(o.payment_status)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="rate-history-empty">No orders.</p>') +
        '<h3 class="admin-subhead">Saved addresses</h3>' + (addrs.length ? addrs.map(function (a) {
          return '<p class="cell-muted">' + esc([a.label, a.full_name, a.line1, a.line2, a.city, a.state, a.pincode, a.phone].filter(Boolean).join(', ')) + (a.is_default ? ' (default)' : '') + '</p>';
        }).join('') : '<p class="rate-history-empty">None saved.</p>') });
      m.querySelectorAll('[data-order]').forEach(function (b) {
        b.addEventListener('click', function () { location.hash = 'orders'; setTimeout(function () { window.ArumbuAdminOrders.open(b.getAttribute('data-order')); }, 300); });
      });
    });
  }

  function load() {
    return Promise.all([
      A.client().from('customer_profiles').select('*').order('created_at', { ascending: false }).limit(2000),
      A.client().from('orders').select('id, customer_id, order_number, created_at, total, order_status, payment_status').order('created_at', { ascending: false }).limit(5000)
    ]).then(function (r) {
      if (r[0].error) { document.getElementById('cuTable').innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(r[0].error)) + '</div>'; return; }
      state.rows = r[0].data || []; state.orders = r[1].data || [];
      render();
    });
  }

  var started = false;
  A.onSection('customers', function () { if (!started) { started = true; shell(); } load(); });
})();
