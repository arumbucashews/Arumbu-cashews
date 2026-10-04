/* Arumbu Cashews — printable invoice. Works for the customer who owns
   the order (site session) and for admins (admin session). The order
   is read through RLS, so nobody else can open it. GST lines appear
   only when GST is enabled in Admin → Settings. */
(function () {
  'use strict';
  var box = document.getElementById('inv');
  var id = new URLSearchParams(window.location.search).get('order') || '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return n == null ? '' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fail(msg) { box.innerHTML = '<p>' + esc(msg) + '</p>'; }
  if (!window.supabase || !/^[0-9a-f-]{36}$/i.test(id)) return fail('Invoice not found.');

  var url = window.ARUMBU_PUBLIC_SUPABASE_URL, key = window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY;
  var site = window.supabase.createClient(url, key, { auth: { storageKey: 'arumbu-auth' } });
  var admin = window.supabase.createClient(url, key); // admin panel session (default storage key)

  function pickClient() {
    return site.auth.getSession().then(function (r) {
      if (r.data && r.data.session) return site;
      return admin.auth.getSession().then(function (r2) {
        if (r2.data && r2.data.session) { document.getElementById('invBack').href = 'admin/dashboard.html#orders'; return admin; }
        return null;
      });
    });
  }

  pickClient().then(function (client) {
    if (!client) { window.location.replace('login.html?next=' + encodeURIComponent('invoice.html?order=' + id)); return; }
    return Promise.all([
      client.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle(),
      client.from('site_settings').select('key, value')
    ]).then(function (r) {
      var o = r[0].data;
      if (!o) return fail('Invoice not found for this account.');
      var st = {};
      (r[1].data || []).forEach(function (x) { st[x.key] = x.value; });
      var gst = st.gst_enabled === 'true';
      var isInvoice = !!o.invoice_number;
      var date = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      var rows = (o.order_items || []).map(function (i, n) {
        return '<tr><td>' + (n + 1) + '</td><td>' + esc(i.grade_name_snapshot) + ' — ' + esc(i.product_name_snapshot || '') +
          (i.sku_snapshot ? '<br><span class="muted">SKU ' + esc(i.sku_snapshot) + '</span>' : '') + '</td><td>' + esc(i.pack_label_snapshot || '') +
          '</td><td class="num">' + esc(i.quantity) + '</td><td class="num">' + money(i.unit_price) + '</td><td class="num">' + money(i.line_total) + '</td></tr>';
      }).join('');
      var totals = '<div><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' +
        (Number(o.discount) > 0 ? '<div><span>Discount' + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') + '</span><span>− ' + money(o.discount) + '</span></div>' : '') +
        '<div><span>Delivery</span><span>' + (o.delivery_confirmed ? money(o.delivery_fee) : 'To be confirmed') + '</span></div>' +
        (gst && o.tax_rate != null ? '<div><span>GST ' + esc(Number(o.tax_rate)) + '%' + (o.tax_inclusive ? ' (included)' : '') + '</span><span>' + money(o.tax) + '</span></div>' : '') +
        '<div class="grand"><span>Total</span><span>' + money(o.total) + '</span></div>';
      box.innerHTML =
        (isInvoice ? '' : '<p class="note">Order summary — a tax invoice number is assigned once the order is confirmed or paid.</p>') +
        '<header><div class="brand"><img src="images/brand/arumbu-cashews-logo.png" alt=""><div><h1>' + esc(st.invoice_business_name || 'Arumbu Cashews') + '</h1>' +
        '<div class="muted" style="white-space:pre-line">' + esc(st.invoice_address || '') + '</div>' +
        (gst && st.gstin ? '<div>GSTIN: ' + esc(st.gstin) + '</div>' : '') + '</div></div>' +
        '<div class="doc-title"><h2>' + (isInvoice ? (gst ? 'Tax Invoice' : 'Invoice') : 'Order Summary') + '</h2>' +
        (isInvoice ? '<div>No. <strong>' + esc(o.invoice_number) + '</strong></div>' : '') +
        '<div>Order ' + esc(o.order_number) + '</div><div class="muted">' + esc(date) + '</div></div></header>' +
        '<section class="parties"><div><h3>Bill to / Ship to</h3><strong>' + esc(o.customer_name) + '</strong><br>' +
        esc([o.address_line1, o.address_line2, o.landmark].filter(Boolean).join(', ')) + '<br>' + esc([o.city, o.state, o.pincode].filter(Boolean).join(', ')) +
        '<br>' + esc(o.contact_phone || '') + (o.customer_email ? '<br>' + esc(o.customer_email) : '') + '</div>' +
        '<div><h3>Payment</h3>' + esc(o.payment_method === 'razorpay' ? 'Online (Razorpay)' : 'Confirmed on WhatsApp') + '<br>Status: ' + esc(o.payment_status) +
        (o.razorpay_payment_id ? '<br><span class="muted">Ref ' + esc(o.razorpay_payment_id) + '</span>' : '') + '</div></section>' +
        '<table><thead><tr><th>#</th><th>Item</th><th>Pack</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="totals">' + totals + '</div>' +
        '<footer>' + esc(st.invoice_footer || 'Thank you for choosing Arumbu Cashews.') + '</footer>';
      document.title = (o.invoice_number || o.order_number) + ' | Arumbu Cashews';
    });
  }).catch(function () { fail('Could not load the invoice. Please try again.'); });
})();
