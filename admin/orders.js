/* Arumbu Cashews — Admin: Orders.
   Reads orders through RLS (admins see all). Every change goes through
   admin_update_order(), which enforces the lifecycle rules, records
   status history, assigns the invoice number, restocks on cancel /
   refund and queues the customer notification. Order items are
   immutable snapshots — prices are never edited here. */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('ordersRoot');
  if (!A || !root) return;
  var esc = A.esc;

  var STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'];
  var PAY = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
  var NEXT = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'packed', 'shipped', 'cancelled'],
    processing: ['packed', 'shipped', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery', 'delivered', 'cancelled'],
    out_for_delivery: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: ['refunded'],
    refunded: []
  };
  var state = { rows: [], filter: 'all', q: '', pay: 'all', from: '', to: '', loading: false };

  function chip(s) { return '<span class="product-status-pill" data-status="' + esc(s) + '">' + esc(A.label(s)) + '</span>'; }

  function shell() {
    root.innerHTML =
      '<div class="status-filter-pills" id="ordFilters">' +
        ['all'].concat(STATUSES).map(function (s) { return '<button type="button" class="status-filter-pill' + (s === state.filter ? ' is-active' : '') + '" data-f="' + s + '">' + A.label(s) + ' <span class="pill-count" data-count="' + s + '"></span></button>'; }).join('') +
      '</div>' +
      '<div class="admin-toolbar">' +
        '<input type="search" id="ordSearch" placeholder="Search order no., name, phone, email" value="' + esc(state.q) + '">' +
        '<select id="ordPay"><option value="all">All payments</option>' + PAY.map(function (p) { return '<option value="' + p + '"' + (state.pay === p ? ' selected' : '') + '>' + A.label(p) + '</option>'; }).join('') + '</select>' +
        '<label class="admin-inline-label">From <input type="date" id="ordFrom" value="' + esc(state.from) + '"></label>' +
        '<label class="admin-inline-label">To <input type="date" id="ordTo" value="' + esc(state.to) + '"></label>' +
        '<button type="button" class="product-form-cancel" id="ordCsv">Export CSV</button>' +
        '<button type="button" class="product-form-cancel" id="ordRefresh">Refresh</button>' +
      '</div>' +
      '<div id="ordTable"><div class="products-message">Loading orders…</div></div>';
    root.querySelectorAll('[data-f]').forEach(function (b) {
      b.addEventListener('click', function () { state.filter = b.getAttribute('data-f'); shell(); render(); });
    });
    var t;
    document.getElementById('ordSearch').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { state.q = v; render(); }, 200); });
    document.getElementById('ordPay').addEventListener('change', function () { state.pay = this.value; render(); });
    document.getElementById('ordFrom').addEventListener('change', function () { state.from = this.value; render(); });
    document.getElementById('ordTo').addEventListener('change', function () { state.to = this.value; render(); });
    document.getElementById('ordRefresh').addEventListener('click', load);
    document.getElementById('ordCsv').addEventListener('click', exportCsv);
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.rows.filter(function (o) {
      if (state.filter !== 'all' && o.order_status !== state.filter) return false;
      if (state.pay !== 'all' && o.payment_status !== state.pay) return false;
      if (state.from && String(o.created_at).slice(0, 10) < state.from) return false;
      if (state.to && String(o.created_at).slice(0, 10) > state.to) return false;
      if (q && [o.order_number, o.customer_name, o.contact_phone, o.customer_email, o.invoice_number].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function render() {
    var box = document.getElementById('ordTable');
    if (!box) return;
    STATUSES.concat(['all']).forEach(function (s) {
      var el = root.querySelector('[data-count="' + s + '"]');
      if (el) el.textContent = '(' + state.rows.filter(function (o) { return s === 'all' || o.order_status === s; }).length + ')';
    });
    var list = filtered();
    if (!list.length) { box.innerHTML = '<div class="products-message">No orders match.</div>'; return; }
    box.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (o) {
        var n = (o.order_items || []).reduce(function (s, i) { return s + i.quantity; }, 0);
        return '<tr><td><strong>' + esc(o.order_number) + '</strong>' + (o.invoice_number ? '<div class="cell-muted">' + esc(o.invoice_number) + '</div>' : '') + '</td>' +
          '<td class="cell-muted">' + esc(A.date(o.created_at, true)) + '</td>' +
          '<td>' + esc(o.customer_name) + '<div class="cell-muted">' + esc(o.contact_phone || '') + '</div></td>' +
          '<td>' + n + '</td><td>' + esc(A.money(o.total)) + '</td>' +
          '<td>' + chip(o.payment_status) + '<div class="cell-muted">' + esc(o.payment_method === 'razorpay' ? 'Online' : 'WhatsApp') + '</div></td>' +
          '<td>' + chip(o.order_status) + '</td>' +
          '<td class="cell-actions"><button type="button" class="product-form-cancel" data-open="' + esc(o.id) + '">Open</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    box.querySelectorAll('[data-open]').forEach(function (b) { b.addEventListener('click', function () { openOrder(b.getAttribute('data-open')); }); });
  }

  function load() {
    state.loading = true;
    var box = document.getElementById('ordTable');
    if (box) box.innerHTML = '<div class="products-message">Loading orders…</div>';
    return A.client().from('orders')
      .select('id, order_number, invoice_number, created_at, customer_name, customer_email, contact_phone, order_status, payment_status, payment_method, total, order_items(quantity)')
      .order('created_at', { ascending: false }).limit(1000)
      .then(function (res) {
        state.loading = false;
        if (res.error) { box.innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
        state.rows = res.data || [];
        render();
      });
  }

  function exportCsv() {
    var list = filtered();
    A.client().from('orders').select('*, order_items(grade_name_snapshot, pack_label_snapshot, quantity, unit_price, line_total)')
      .in('id', list.map(function (o) { return o.id; }).slice(0, 500)).then(function (res) {
        if (res.error) return A.toast(A.errMsg(res.error), true);
        var rows = [['Order', 'Invoice', 'Date', 'Customer', 'Phone', 'Email', 'City', 'State', 'PIN', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Payment method', 'Payment status', 'Order status', 'Courier', 'Tracking']];
        (res.data || []).forEach(function (o) {
          rows.push([o.order_number, o.invoice_number, o.created_at, o.customer_name, o.contact_phone, o.customer_email, o.city, o.state, o.pincode,
            (o.order_items || []).map(function (i) { return i.grade_name_snapshot + ' ' + i.pack_label_snapshot + ' x' + i.quantity; }).join('; '),
            o.subtotal, o.discount, o.delivery_fee, o.tax, o.total, o.payment_method, o.payment_status, o.order_status, o.courier_name, o.tracking_number]);
        });
        A.downloadCsv('arumbu-orders-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
      });
  }

  function openOrder(id) {
    A.modal({ title: 'Order', wide: true, body: '<div class="products-message">Loading…</div>' });
    Promise.all([
      A.client().from('orders').select('*, order_items(*), order_status_history(*), payments(*)').eq('id', id).single(),
      A.client().from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false })
    ]).then(function (r) {
      if (r[0].error) { A.modal({ title: 'Order', body: '<p class="products-message is-error">' + esc(A.errMsg(r[0].error)) + '</p>' }); return; }
      renderOrder(r[0].data, r[1].data || []);
    });
  }

  function renderOrder(o, notes) {
    var next = NEXT[o.order_status] || [];
    var items = (o.order_items || []).map(function (i) {
      return '<tr><td>' + esc(i.grade_name_snapshot) + '<div class="cell-muted">' + esc(i.product_name_snapshot || '') + (i.sku_snapshot ? ' · ' + esc(i.sku_snapshot) : '') + '</div></td><td>' + esc(i.pack_label_snapshot || '') + '</td><td>' + esc(i.quantity) + '</td><td>' + esc(A.money(i.unit_price)) + '</td><td>' + esc(A.money(i.line_total)) + '</td></tr>';
    }).join('');
    var hist = (o.order_status_history || []).slice().sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); }).map(function (h) {
      return '<li>' + esc(A.date(h.created_at, true)) + ' — ' + (h.field === 'payment_status' ? 'Payment: ' : '') + esc(A.label(h.from_status || '—')) + ' → <strong>' + esc(A.label(h.to_status)) + '</strong>' + (h.note ? '<span class="meta">' + esc(h.note) + '</span>' : '') + '</li>';
    }).join('');
    var wa = A.waLink(o.contact_phone, 'Hello ' + (o.customer_name || '') + ', this is Arumbu Cashews about your order ' + o.order_number + '.');
    var body =
      '<div class="order-admin-grid">' +
        '<div>' +
          '<p><strong>' + esc(o.order_number) + '</strong> · ' + esc(A.date(o.created_at, true)) + ' · ' + '<span class="product-status-pill" data-status="' + esc(o.order_status) + '">' + esc(A.label(o.order_status)) + '</span> <span class="product-status-pill">Payment: ' + esc(A.label(o.payment_status)) + '</span></p>' +
          '<div class="enquiry-detail"><dl>' +
            '<dt>Customer</dt><dd>' + esc(o.customer_name) + '</dd>' +
            '<dt>Phone</dt><dd><a href="tel:+91' + esc(o.contact_phone) + '">' + esc(o.contact_phone) + '</a>' + (wa ? ' · <a href="' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</dd>' +
            '<dt>Email</dt><dd>' + (o.customer_email ? '<a href="mailto:' + esc(o.customer_email) + '">' + esc(o.customer_email) + '</a>' : '—') + '</dd>' +
            '<dt>Address</dt><dd>' + esc([o.address_line1, o.address_line2, o.landmark, o.city, o.state, o.pincode].filter(Boolean).join(', ')) + '</dd>' +
            (o.delivery_instructions ? '<dt>Instructions</dt><dd>' + esc(o.delivery_instructions) + '</dd>' : '') +
            '<dt>Payment</dt><dd>' + esc(o.payment_method === 'razorpay' ? 'Online (Razorpay)' : 'Confirm on WhatsApp') + (o.razorpay_payment_id ? ' · ' + esc(o.razorpay_payment_id) : '') + '</dd>' +
            (o.coupon_code ? '<dt>Coupon</dt><dd>' + esc(o.coupon_code) + '</dd>' : '') +
            (o.cancellation_reason ? '<dt>Cancellation</dt><dd>' + esc(o.cancellation_reason) + '</dd>' : '') +
          '</dl></div>' +
          '<div class="admin-table-wrap"><table class="admin-table" style="min-width:0"><thead><tr><th>Item</th><th>Pack</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
          '<dl class="order-totals"><dt>Subtotal</dt><dd>' + A.money(o.subtotal) + '</dd>' +
            (Number(o.discount) > 0 ? '<dt>Discount</dt><dd>− ' + A.money(o.discount) + '</dd>' : '') +
            '<dt>Delivery</dt><dd>' + (o.delivery_confirmed ? A.money(o.delivery_fee) : 'To be confirmed') + '</dd>' +
            (o.tax_rate != null ? '<dt>GST ' + esc(Number(o.tax_rate)) + '%' + (o.tax_inclusive ? ' (incl.)' : '') + '</dt><dd>' + A.money(o.tax) + '</dd>' : '') +
            '<dt><strong>Total</strong></dt><dd><strong>' + A.money(o.total) + '</strong></dd></dl>' +
          '<h3 class="admin-subhead">History</h3><ul class="rate-history-list">' + (hist || '<li>No history</li>') + '</ul>' +
        '</div>' +
        '<div>' +
          '<div class="content-card"><h3>Update order</h3>' +
            '<p class="product-form-error" id="ouErr"></p>' +
            '<div class="form-field"><label for="ouStatus">Order status</label><select id="ouStatus"><option value="">— no change —</option>' +
              next.map(function (s) { return '<option value="' + s + '">' + A.label(s) + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-field"><label for="ouPay">Payment status</label><select id="ouPay"><option value="">— no change —</option>' +
              PAY.filter(function (p) { return p !== o.payment_status; }).map(function (p) { return '<option value="' + p + '">' + A.label(p) + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-field"><label for="ouCourier">Courier</label><input id="ouCourier" value="' + esc(o.courier_name || '') + '" maxlength="80"></div>' +
            '<div class="form-field"><label for="ouTracking">Tracking number</label><input id="ouTracking" value="' + esc(o.tracking_number || '') + '" maxlength="80"></div>' +
            '<div class="form-field" id="ouReasonWrap" hidden><label for="ouReason">Cancellation / refund reason</label><input id="ouReason" maxlength="300"></div>' +
            '<div class="form-field"><label for="ouNote">Internal note (optional)</label><textarea id="ouNote" rows="2" maxlength="500"></textarea></div>' +
            '<div class="product-form-actions"><button type="button" class="product-form-submit" id="ouSave">Save update</button></div>' +
            '<p class="cell-muted" style="margin-top:.6rem">Cancelling or refunding returns tracked stock to inventory automatically. Refunds of online payments must also be issued in the Razorpay dashboard.</p>' +
          '</div>' +
          '<div class="content-card"><h3>Documents & contact</h3>' +
            '<p><a class="product-form-cancel" href="../invoice.html?order=' + esc(o.id) + '" target="_blank" rel="noopener">' + (o.invoice_number ? 'Print invoice ' + esc(o.invoice_number) : 'Print order summary') + '</a></p>' +
            (wa ? '<p style="margin-top:.6rem"><a class="product-form-cancel" target="_blank" rel="noopener" href="' + esc(wa) + '">Message customer on WhatsApp</a></p>' : '') +
          '</div>' +
          '<div class="content-card"><h3>Internal notes</h3><ul class="rate-history-list">' +
            (notes.length ? notes.map(function (n) { return '<li>' + esc(n.note) + '<span class="meta">' + esc(A.date(n.created_at, true)) + '</span></li>'; }).join('') : '<li class="rate-history-empty">No notes yet.</li>') +
          '</ul></div>' +
        '</div>' +
      '</div>';
    var m = A.modal({ title: 'Order ' + o.order_number, wide: true, body: body });
    var st = m.querySelector('#ouStatus');
    st.addEventListener('change', function () { m.querySelector('#ouReasonWrap').hidden = ['cancelled', 'refunded'].indexOf(st.value) === -1; });
    m.querySelector('#ouSave').addEventListener('click', function () {
      var btn = this;
      var status = st.value || null;
      var pay = m.querySelector('#ouPay').value || null;
      var reason = m.querySelector('#ouReason').value.trim();
      var err = m.querySelector('#ouErr');
      err.classList.remove('is-visible');
      if (status === 'shipped' && !m.querySelector('#ouTracking').value.trim() && !window.confirm('No tracking number entered. Mark as shipped anyway?')) return;
      if ((status === 'cancelled' || status === 'refunded') && !window.confirm('Mark order ' + o.order_number + ' as ' + status + '? This cannot be undone.')) return;
      if (status === 'refunded' && !pay) pay = o.payment_status === 'paid' ? 'refunded' : null;
      btn.disabled = true;
      A.client().rpc('admin_update_order', {
        p_order_id: o.id, p_status: status, p_payment_status: pay,
        p_courier_name: m.querySelector('#ouCourier').value, p_tracking_number: m.querySelector('#ouTracking').value,
        p_note: m.querySelector('#ouNote').value || null, p_cancellation_reason: reason || null
      }).then(function (res) {
        btn.disabled = false;
        if (res.error) { err.textContent = A.errMsg(res.error); err.classList.add('is-visible'); return; }
        A.toast('Order updated');
        load();
        openOrder(o.id);
      });
    });
  }

  var started = false;
  A.onSection('orders', function () {
    if (!started) { started = true; shell(); }
    load();
  });
  window.ArumbuAdminOrders = { open: openOrder, reload: load };
})();
