/* Arumbu Cashews — Admin overview: today's numbers + sidebar badges. */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  if (!A) return;
  function badge(id, n) { var el = document.getElementById(id); if (!el) return; el.hidden = !n; el.textContent = n > 99 ? '99+' : n; }
  function load() {
    var c = A.client();
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    Promise.all([
      c.from('orders').select('id, created_at, order_status, payment_status, total').gte('created_at', new Date(Date.now() - 400 * 864e5).toISOString()).limit(5000),
      c.from('inventory').select('stock_qty, low_stock_threshold, track_stock, product_variants(is_active)'),
      c.from('wholesale_enquiries').select('id', { count: 'exact', head: true }).eq('pipeline_status', 'new'),
      c.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
      c.from('gifting_enquiries').select('id', { count: 'exact', head: true }).eq('status', 'new')
    ]).then(function (r) {
      var orders = r[0].data || [];
      var open = orders.filter(function (o) { return ['pending', 'confirmed', 'processing', 'packed'].indexOf(o.order_status) > -1; });
      var today = orders.filter(function (o) { return new Date(o.created_at) >= dayStart; });
      var monthPaid = orders.filter(function (o) { return o.payment_status === 'paid' && new Date(o.created_at) >= monthStart; })
        .reduce(function (s, o) { return s + Number(o.total || 0); }, 0);
      var inv = (r[1].data || []).filter(function (i) { var v = Array.isArray(i.product_variants) ? i.product_variants[0] : i.product_variants; return i.track_stock && (!v || v.is_active); });
      var low = inv.filter(function (i) { return i.stock_qty <= i.low_stock_threshold; }).length;
      var leads = (r[2].count || 0) + (r[3].count || 0) + (r[4].count || 0);
      var box = document.getElementById('adminStats');
      if (box) box.innerHTML = [
        ['Orders today', today.length, 'orders'], ['Orders to fulfil', open.length, 'orders'],
        ['Paid this month', A.money(monthPaid), 'orders'], ['Packs low / out of stock', low, 'inventory'], ['New leads', leads, 'messages']
      ].map(function (s) { return '<button type="button" class="admin-stat" data-go="' + s[2] + '"><strong>' + A.esc(s[1]) + '</strong><span>' + A.esc(s[0]) + '</span></button>'; }).join('');
      if (box) box.querySelectorAll('[data-go]').forEach(function (b) { b.addEventListener('click', function () { location.hash = b.getAttribute('data-go'); }); });
      badge('navBadgeOrders', open.length);
      badge('navBadgeStock', low);
      badge('navBadgeMsgs', (r[3].count || 0) + (r[4].count || 0));
    });
  }
  A.onSection('overview', load);
  A.ready.then(load);
})();
