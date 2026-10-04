/* Arumbu Cashews — My Account (overview, orders, wishlist, cart,
   addresses, profile, password, settings). Every read/write goes
   through RLS: a customer only ever sees their own rows. */
(function () {
  'use strict';
  var S = window.ArumbuStore, C = window.ArumbuCards;
  if (!S) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.esc, t = S.t;
  var panel = $('acPanel');
  var TABS = ['overview', 'orders', 'wishlist', 'cart', 'addresses', 'profile', 'password', 'settings'];
  var cache = { orders: null };

  function tab() { var h = (window.location.hash || '').slice(1); return TABS.indexOf(h) > -1 ? h : 'overview'; }
  function statusLabel(s) { return t('order.status.' + s, String(s || '').replace(/_/g, ' ')); }
  function date(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(S.lang() === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return String(d).slice(0, 10); }
  }

  function loadOrders(force) {
    if (cache.orders && !force) return Promise.resolve(cache.orders);
    return S.client.from('orders')
      .select('id, order_number, created_at, order_status, payment_status, payment_method, total, subtotal, discount, delivery_fee, delivery_confirmed, tax, tax_rate, tax_inclusive, courier_name, tracking_number, invoice_number, address_line1, address_line2, city, state, pincode, order_items(grade_name_snapshot, pack_label_snapshot, quantity, unit_price, line_total), order_status_history(to_status, field, created_at)')
      .order('created_at', { ascending: false })
      .then(function (res) { if (res.error) throw res.error; cache.orders = res.data || []; return cache.orders; });
  }

  /* ---------- tabs ---------- */
  var views = {
    overview: function () {
      var p = S.profile() || {}, u = S.user();
      return loadOrders().then(function (orders) {
        var open = orders.filter(function (o) { return ['delivered', 'cancelled', 'refunded'].indexOf(o.order_status) === -1; }).length;
        var last = orders[0];
        panel.innerHTML = '<h2>' + esc(S.fmt(t('account.hello', 'Hello, {name}'), { name: p.full_name || u.email })) + '</h2>' +
          '<div class="stat-grid">' +
          '<div class="stat"><strong>' + orders.length + '</strong><span>' + esc(t('account.stat.orders', 'Orders')) + '</span></div>' +
          '<div class="stat"><strong>' + open + '</strong><span>' + esc(t('account.stat.open', 'In progress')) + '</span></div>' +
          '<div class="stat"><strong>' + S.wishlist.ids().length + '</strong><span>' + esc(t('account.stat.wishlist', 'Wishlist')) + '</span></div>' +
          '</div>' +
          (last ? '<h2 style="font-size:1.15rem">' + esc(t('account.latestOrder', 'Latest order')) + '</h2>' + orderCard(last) : '<p>' + esc(t('account.noOrders', 'You have not placed any orders yet.')) + ' <a class="link-btn" href="products.html">' + esc(t('products.browse', 'Browse Products')) + '</a></p>');
      });
    },
    orders: function () {
      return loadOrders(true).then(function (orders) {
        panel.innerHTML = '<h2>' + esc(t('account.nav.orders', 'My Orders')) + '</h2>' +
          (orders.length ? orders.map(orderCard).join('') : '<p>' + esc(t('account.noOrders', 'You have not placed any orders yet.')) + ' <a class="link-btn" href="products.html">' + esc(t('products.browse', 'Browse Products')) + '</a></p>');
      });
    },
    wishlist: function () {
      panel.innerHTML = '<h2>' + esc(t('wishlist.title', 'Your Wishlist')) + '</h2><div class="pgrid" id="acWish"></div>';
      return S.loadCatalog().then(function (list) {
        var ids = S.wishlist.ids();
        var items = (list || []).filter(function (p) { return ids.indexOf(p.id) > -1; });
        if (!items.length) { $('acWish').outerHTML = '<p>' + esc(t('wishlist.empty', 'Save the grades you love here and come back to them anytime.')) + ' <a class="link-btn" href="products.html">' + esc(t('products.browse', 'Browse Products')) + '</a></p>'; return; }
        if (C) C.renderInto($('acWish'), items, { headingLevel: 3, onWishChange: function () { render(); } });
      });
    },
    cart: function () {
      return S.cart.refresh().then(function (q) {
        var items = q.items || [];
        panel.innerHTML = '<h2>' + esc(t('cart.title', 'Your Cart')) + '</h2>' + (items.length
          ? '<div class="store-card"><ul class="panel-lines" style="list-style:none;padding:0;display:grid;gap:.5rem">' + items.map(function (i) {
              return '<li style="display:flex;justify-content:space-between;gap:.6rem"><span>' + esc(i.grade_name) + ' · ' + esc(i.pack_label) + ' × ' + esc(i.quantity) + '</span><span>' + (i.line_total != null ? esc(S.money(i.line_total)) : '') + '</span></li>';
            }).join('') + '</ul><p style="margin-top:1rem"><strong>' + esc(t('cart.subtotal', 'Subtotal')) + ': ' + esc(S.money(q.subtotal)) + '</strong></p>' +
            '<div class="enquiry-actions"><a class="btn btn-gold" href="checkout.html">' + esc(t('cart.checkout', 'Checkout')) + '</a><a class="btn btn-outline" href="cart.html">' + esc(t('cart.view', 'View Cart')) + '</a></div></div>'
          : '<p>' + esc(t('cart.empty', 'Your cart is empty.')) + '</p>');
      });
    },
    addresses: function () {
      return S.client.from('customer_addresses').select('*').order('is_default', { ascending: false }).order('created_at').then(function (res) {
        var list = res.data || [];
        panel.innerHTML = '<h2>' + esc(t('account.nav.addresses', 'Addresses')) + '</h2>' +
          '<div class="address-grid">' + list.map(function (a) {
            return '<div class="address-card" data-id="' + esc(a.id) + '"><strong>' + esc(a.label || a.full_name) + '</strong>' + (a.is_default ? ' <span class="stock-chip">' + esc(t('account.default', 'Default')) + '</span>' : '') +
              '<p style="color:inherit;margin:.4rem 0 0">' + esc(a.full_name) + '<br>' + esc([a.line1, a.line2, a.landmark].filter(Boolean).join(', ')) + '<br>' + esc(a.city + ', ' + a.state + ' ' + a.pincode) + '<br>' + esc(a.phone) + '</p>' +
              '<div class="actions"><button type="button" class="link-btn" data-edit>' + esc(t('account.edit', 'Edit')) + '</button>' +
              (a.is_default ? '' : '<button type="button" class="link-btn" data-default>' + esc(t('account.makeDefault', 'Make default')) + '</button>') +
              '<button type="button" class="link-btn" data-delete>' + esc(t('account.delete', 'Delete')) + '</button></div></div>';
          }).join('') + '</div>' +
          '<button type="button" class="btn btn-outline" id="acAddNew" style="margin-top:1rem">' + esc(t('account.addAddress', 'Add an address')) + '</button>' +
          '<div id="acAddrForm"></div>';
        $('acAddNew').addEventListener('click', function () { addressForm(null); });
        panel.querySelectorAll('.address-card').forEach(function (card) {
          var a = list.filter(function (x) { return x.id === card.getAttribute('data-id'); })[0];
          card.querySelector('[data-edit]').addEventListener('click', function () { addressForm(a); });
          var d = card.querySelector('[data-default]');
          if (d) d.addEventListener('click', function () { S.client.from('customer_addresses').update({ is_default: true }).eq('id', a.id).then(done); });
          card.querySelector('[data-delete]').addEventListener('click', function () {
            if (window.confirm(t('account.deleteConfirm', 'Delete this address?'))) S.client.from('customer_addresses').delete().eq('id', a.id).then(done);
          });
        });
      });
    },
    profile: function () {
      var p = S.profile() || {};
      panel.innerHTML = '<h2>' + esc(t('account.nav.profile', 'Profile')) + '</h2>' +
        '<form class="store-card store-form" id="acProfile" novalidate>' +
        field('pfName', t('checkout.name', 'Full name *'), p.full_name, 'name') +
        field('pfPhone', t('checkout.phone', 'Mobile number'), p.phone, 'tel', 'tel') +
        '<div><label>' + esc(t('auth.email', 'Email')) + '</label><input value="' + esc(S.user().email) + '" disabled><p class="hint">' + esc(t('account.emailHint', 'To change your email address, contact us.')) + '</p></div>' +
        '<p class="form-error" role="alert" id="pfErr"></p><button class="btn btn-gold" type="submit">' + esc(t('account.save', 'Save changes')) + '</button></form>';
      $('acProfile').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('pfName').value.trim(), phone = $('pfPhone').value.replace(/[^0-9]/g, '');
        if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
        if (!name) { $('pfErr').textContent = t('err.invalidName', 'Please enter your name.'); return; }
        if (phone && !/^[6-9][0-9]{9}$/.test(phone)) { $('pfErr').textContent = t('err.invalidPhone', 'Please enter a valid 10-digit mobile number.'); return; }
        S.client.from('customer_profiles').update({ full_name: name.slice(0, 120), phone: phone || null }).eq('id', S.user().id)
          .then(function (res) { if (res.error) throw res.error; return S.reloadProfile(); })
          .then(function () { S.renderHeader(); S.toast(t('account.saved', 'Saved')); }, function (err) { $('pfErr').textContent = S.errorText(err); });
      });
      return Promise.resolve();
    },
    password: function () {
      panel.innerHTML = '<h2>' + esc(t('account.nav.password', 'Password')) + '</h2>' +
        '<form class="store-card store-form" id="acPw" novalidate>' +
        '<div><label for="pw1">' + esc(t('auth.newPassword', 'New password')) + '</label><input id="pw1" type="password" autocomplete="new-password" minlength="8" required></div>' +
        '<div><label for="pw2">' + esc(t('auth.confirmPassword', 'Confirm new password')) + '</label><input id="pw2" type="password" autocomplete="new-password" minlength="8" required></div>' +
        '<p class="form-error" role="alert" id="pwErr"></p><button class="btn btn-gold" type="submit">' + esc(t('auth.savePassword', 'Save password')) + '</button></form>';
      $('acPw').addEventListener('submit', function (e) {
        e.preventDefault();
        var a = $('pw1').value, b = $('pw2').value;
        if (a.length < 8) { $('pwErr').textContent = t('auth.err.weakPassword', 'Password must be at least 8 characters.'); return; }
        if (a !== b) { $('pwErr').textContent = t('auth.err.mismatch', 'The two passwords do not match.'); return; }
        S.auth.updatePassword(a).then(function () { $('acPw').reset(); S.toast(t('auth.passwordSaved', 'Password updated.')); }, function (err) { $('pwErr').textContent = S.errorText(err); });
      });
      return Promise.resolve();
    },
    settings: function () {
      var p = S.profile() || {};
      var cur = p.preferred_language || S.lang();
      panel.innerHTML = '<h2>' + esc(t('account.nav.settings', 'Settings')) + '</h2>' +
        '<form class="store-card store-form" id="acSettings">' +
        '<div><label for="stLang">' + esc(t('account.language', 'Preferred language')) + '</label><select id="stLang"><option value="en"' + (cur === 'en' ? ' selected' : '') + '>English</option><option value="ta"' + (cur === 'ta' ? ' selected' : '') + '>தமிழ்</option></select></div>' +
        '<button class="btn btn-gold" type="submit">' + esc(t('account.save', 'Save changes')) + '</button></form>' +
        '<div class="store-card" style="margin-top:1rem"><h2 style="font-size:1.1rem">' + esc(t('account.deleteTitle', 'Delete my account')) + '</h2><p>' +
        esc(t('account.deleteDesc', 'To close your account and remove your personal data, send us a request. Order records may need to be kept for accounting.')) +
        '</p><a class="btn btn-outline btn-sm" href="contact.html">' + esc(t('nav.contact', 'Contact')) + '</a></div>';
      $('acSettings').addEventListener('submit', function (e) {
        e.preventDefault();
        var lang = $('stLang').value;
        S.client.from('customer_profiles').update({ preferred_language: lang }).eq('id', S.user().id).then(function (res) {
          if (res.error) throw res.error;
          if (window.arumbuI18n) window.arumbuI18n.setLang(lang);
          return S.reloadProfile();
        }).then(function () { S.toast(t('account.saved', 'Saved')); }, function (err) { S.toast(S.errorText(err), 'error'); });
      });
      return Promise.resolve();
    }
  };

  function field(id, label, value, auto, type) {
    return '<div><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + (type || 'text') + '" autocomplete="' + (auto || 'off') + '" value="' + esc(value || '') + '"></div>';
  }

  function orderCard(o) {
    var items = (o.order_items || []).map(function (i) {
      return '<li>' + esc(i.grade_name_snapshot) + ' · ' + esc(i.pack_label_snapshot || '') + ' × ' + esc(i.quantity) + (i.line_total != null ? ' — ' + esc(S.money(i.line_total)) : '') + '</li>';
    }).join('');
    var hist = (o.order_status_history || []).filter(function (h) { return h.field === 'order_status' || !h.field; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); })
      .map(function (h) { return '<li>' + esc(statusLabel(h.to_status)) + ' — ' + esc(date(h.created_at)) + '</li>'; }).join('');
    var canCancel = o.order_status === 'pending' && o.payment_status !== 'paid';
    var payAgain = o.payment_method === 'razorpay' && o.payment_status !== 'paid' && o.order_status === 'pending';
    return '<article class="order-card" data-order="' + esc(o.id) + '"><header><div><h3>' + esc(o.order_number) + '</h3>' +
      '<p class="order-meta">' + esc(date(o.created_at)) + ' · ' + esc(S.money(o.total)) + '</p></div>' +
      '<span class="status-chip" data-status="' + esc(o.order_status) + '">' + esc(statusLabel(o.order_status)) + '</span></header>' +
      '<ul>' + items + '</ul>' +
      (o.tracking_number ? '<p class="order-meta">' + esc(t('account.tracking', 'Tracking')) + ': ' + esc((o.courier_name || '') + ' ' + o.tracking_number) + '</p>' : '') +
      '<details><summary>' + esc(t('account.details', 'Details')) + '</summary>' +
      '<p class="order-meta">' + esc(t('confirm.payment', 'Payment')) + ': ' + esc(t('payment.status.' + o.payment_status, o.payment_status)) + ' (' + esc(o.payment_method === 'razorpay' ? t('checkout.payOnline', 'Online') : 'WhatsApp') + ')</p>' +
      '<p class="order-meta">' + esc([o.address_line1, o.address_line2, o.city, o.state, o.pincode].filter(Boolean).join(', ')) + '</p>' +
      (hist ? '<ul class="timeline">' + hist + '</ul>' : '') + '</details>' +
      '<div class="enquiry-actions">' +
      (payAgain ? '<a class="btn btn-gold btn-sm" href="order-confirmation.html?order=' + esc(o.id) + '">' + esc(t('confirm.payNow', 'Pay now')) + '</a>' : '') +
      (o.invoice_number ? '<a class="btn btn-outline btn-sm" href="invoice.html?order=' + esc(o.id) + '" target="_blank" rel="noopener">' + esc(t('account.invoice', 'Invoice')) + '</a>' : '') +
      (canCancel ? '<button type="button" class="btn btn-outline btn-sm" data-cancel="' + esc(o.id) + '">' + esc(t('account.cancelOrder', 'Cancel order')) + '</button>' : '') +
      '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + esc(S.whatsappUrl('Hi Arumbu Cashews, I have a question about order ' + o.order_number + '.')) + '">' + esc(t('account.help', 'Need help?')) + '</a>' +
      '</div></article>';
  }

  function addressForm(a) {
    a = a || {};
    var box = $('acAddrForm');
    box.innerHTML = '<form class="store-card store-form" id="adForm" style="margin-top:1rem" novalidate>' +
      '<div class="form-row">' + field('adLabel', t('account.addrLabel', 'Label (e.g. Home, Office)'), a.label) + field('adName', t('checkout.name', 'Full name *'), a.full_name, 'name') + '</div>' +
      '<div class="form-row">' + field('adPhone', t('checkout.phone', 'Mobile number *'), a.phone, 'tel', 'tel') + field('adPin', t('checkout.pincode', 'PIN code *'), a.pincode, 'postal-code') + '</div>' +
      field('adLine1', t('checkout.line1', 'House / flat, street *'), a.line1, 'address-line1') +
      field('adLine2', t('checkout.line2', 'Area / locality'), a.line2, 'address-line2') +
      field('adLandmark', t('checkout.landmark', 'Landmark'), a.landmark) +
      '<div class="form-row">' + field('adCity', t('checkout.city', 'City / town *'), a.city, 'address-level2') + field('adState', t('checkout.state', 'State *'), a.state || 'Tamil Nadu', 'address-level1') + '</div>' +
      '<label class="check"><input type="checkbox" id="adDefault"' + (a.is_default ? ' checked' : '') + '> <span>' + esc(t('account.makeDefault', 'Make default')) + '</span></label>' +
      '<p class="form-error" role="alert" id="adErr"></p>' +
      '<div class="enquiry-actions"><button class="btn btn-gold" type="submit">' + esc(t('account.save', 'Save changes')) + '</button><button class="btn btn-outline" type="button" id="adCancel">' + esc(t('account.cancel', 'Cancel')) + '</button></div></form>';
    $('adName').focus();
    $('adCancel').addEventListener('click', function () { box.innerHTML = ''; });
    $('adForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = $('adPhone').value.replace(/[^0-9]/g, '');
      if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
      var row = {
        label: $('adLabel').value.trim().slice(0, 40) || null, full_name: $('adName').value.trim(), phone: phone,
        line1: $('adLine1').value.trim(), line2: $('adLine2').value.trim() || null, landmark: $('adLandmark').value.trim() || null,
        city: $('adCity').value.trim(), state: $('adState').value.trim(), pincode: $('adPin').value.trim(), is_default: $('adDefault').checked
      };
      var err = !row.full_name ? 'err.invalidName' : !/^[6-9][0-9]{9}$/.test(phone) ? 'err.invalidPhone'
        : (!row.line1 || !row.city || !row.state) ? 'err.invalidAddress' : !/^[1-9][0-9]{5}$/.test(row.pincode) ? 'err.invalidPincode' : null;
      if (err) { $('adErr').textContent = t(err, 'Please check the address.'); return; }
      var q = a.id ? S.client.from('customer_addresses').update(row).eq('id', a.id)
                   : S.client.from('customer_addresses').insert(Object.assign({ customer_id: S.user().id }, row));
      q.then(function (res) { if (res.error) throw res.error; done(); }, function (e2) { $('adErr').textContent = S.errorText(e2); })
        .catch(function (e3) { $('adErr').textContent = S.errorText(e3); });
    });
  }
  function done(res) {
    if (res && res.error) { S.toast(S.errorText(res.error), 'error'); return; }
    S.toast(t('account.saved', 'Saved'));
    render();
  }

  panel.addEventListener('click', function (e) {
    var c = e.target.closest('[data-cancel]');
    if (!c) return;
    if (!window.confirm(t('account.cancelConfirm', 'Cancel this order?'))) return;
    c.disabled = true;
    S.client.rpc('cancel_my_order', { p_order_id: c.getAttribute('data-cancel'), p_reason: null }).then(function (res) {
      if (res.error) throw res.error;
      S.toast(t('account.cancelled', 'Order cancelled'));
      cache.orders = null; render();
    }).catch(function (err) { c.disabled = false; S.toast(S.errorText(err), 'error'); });
  });

  function render() {
    var name = tab();
    document.querySelectorAll('.account-nav [data-tab]').forEach(function (a) {
      if (a.getAttribute('data-tab') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    panel.innerHTML = '<p class="store-loading">' + esc(t('store.loading', 'Loading…')) + '</p>';
    views[name]().catch(function (err) { panel.innerHTML = '<p class="store-note is-error">' + esc(S.errorText(err)) + '</p>'; });
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('arumbu:lang', render);
  S.ready.then(function () {
    if (!S.user()) { window.location.replace('login.html?next=account.html'); return; }
    $('acLoading').hidden = true;
    $('acLayout').hidden = false;
    render();
  });
  document.addEventListener('arumbu:auth', function (e) { if (!e.detail.user) window.location.replace('login.html'); });
})();
