/* Arumbu Cashews — checkout.
   The order is created by the database function place_order(), which
   re-reads the cart, re-prices every line, checks stock, applies the
   coupon/delivery/GST rules and deducts inventory atomically. Nothing
   price-related is sent from this page. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.esc;
  var coupon = '';
  var quote = null;
  var addresses = [];

  function show(id) {
    ['coLoading', 'coLogin', 'coEmpty', 'coForm'].forEach(function (x) { $(x).hidden = x !== id; });
  }

  function renderSummary(q) {
    quote = q;
    var items = q.items || [];
    if (!items.length) { show('coEmpty'); return; }
    $('coItems').innerHTML = items.map(function (i) {
      return '<li style="display:flex;justify-content:space-between;gap:.6rem"><span>' + esc(i.grade_name) + ' · ' + esc(i.pack_label) + ' × ' + esc(i.quantity) +
        (i.status !== 'available' ? ' <span class="stock-chip is-out">' + esc(S.t('store.unavailable', 'No longer available')) + '</span>' : '') +
        '</span><span>' + (i.line_total != null ? esc(S.money(i.line_total)) : '') + '</span></li>';
    }).join('');
    $('coSummary').innerHTML = S.summaryRows(q);
    $('coDeliveryNote').textContent = q.delivery_configured ? '' :
      S.t('cart.deliveryNote', 'Delivery charges depend on your location and are confirmed with you before dispatch.');

    var cm = $('coCouponMsg');
    cm.className = 'form-status';
    if (q.coupon_status === 'applied') cm.textContent = S.fmt(S.t('checkout.couponApplied', 'Coupon applied — you save {amount}.'), { amount: S.money(q.discount) });
    else if (q.coupon_status === 'min_order') { cm.textContent = S.t('checkout.couponMin', 'Your order does not meet this coupon\'s minimum amount.'); cm.className += ' is-error'; }
    else if (q.coupon_status === 'invalid') { cm.textContent = S.t('err.invalidCoupon', 'That coupon code is not valid.'); cm.className += ' is-error'; }
    else cm.textContent = '';

    // Online payment needs Razorpay switched on AND a configured delivery fee
    // (so the amount charged is final).
    var onlineOn = S.setting('payments_razorpay_enabled', 'false') === 'true' && q.delivery_configured;
    var waOn = S.setting('whatsapp_orders_enabled', 'true') !== 'false';
    var online = $('coPayOnline'), wa = $('coPayWa');
    online.classList.toggle('is-disabled', !onlineOn);
    online.querySelector('input').disabled = !onlineOn;
    $('coPayOnlineDesc').textContent = onlineOn ? S.t('checkout.payOnlineDesc', 'Secure payment through Razorpay.')
      : S.t('checkout.payOnlineOff', 'Online payment is not available yet.');
    wa.hidden = !waOn;
    wa.querySelector('input').disabled = !waOn;
    var checked = document.querySelector('#coPay input:checked:not(:disabled)');
    if (!checked) { var first = document.querySelector('#coPay input:not(:disabled)'); if (first) first.checked = true; }
    $('coSubmit').disabled = !q.all_available || !document.querySelector('#coPay input:not(:disabled)');
    if (!q.all_available) $('coError').textContent = S.t('err.cartUnavailable', 'Remove unavailable items from your cart to continue.');
  }

  function fillAddress(a) {
    $('coLine1').value = a.line1 || ''; $('coLine2').value = a.line2 || ''; $('coLandmark').value = a.landmark || '';
    $('coCity').value = a.city || ''; $('coState').value = a.state || ''; $('coPin').value = a.pincode || '';
    if (a.full_name && !$('coName').value) $('coName').value = a.full_name;
    if (a.phone && !$('coPhone').value) $('coPhone').value = a.phone;
    $('coSave').checked = false;
  }

  function loadAddresses() {
    return S.client.from('customer_addresses').select('*').order('is_default', { ascending: false }).order('created_at', { ascending: false })
      .then(function (res) {
        addresses = res.data || [];
        $('coSaved').innerHTML = addresses.map(function (a, i) {
          return '<label class="saved-address"><input type="radio" name="savedAddr" value="' + i + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><strong>' + esc(a.label || a.full_name) + '</strong><br>' + esc([a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')) + '</span></label>';
        }).join('') + (addresses.length ? '<label class="saved-address"><input type="radio" name="savedAddr" value="new"> <span>' + esc(S.t('checkout.newAddress', 'Use a new address')) + '</span></label>' : '');
        if (addresses[0]) fillAddress(addresses[0]);
      });
  }

  function validate() {
    var err = null;
    var phone = $('coPhone').value.replace(/[^0-9]/g, '');
    if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
    if (!$('coName').value.trim()) err = ['coName', 'err.invalidName'];
    else if (!/^[6-9][0-9]{9}$/.test(phone)) err = ['coPhone', 'err.invalidPhone'];
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('coEmail').value.trim())) err = ['coEmail', 'err.invalidEmail'];
    else if (!$('coLine1').value.trim() || !$('coCity').value.trim() || !$('coState').value.trim()) err = [!$('coLine1').value.trim() ? 'coLine1' : !$('coCity').value.trim() ? 'coCity' : 'coState', 'err.invalidAddress'];
    else if (!/^[1-9][0-9]{5}$/.test($('coPin').value.trim())) err = ['coPin', 'err.invalidPincode'];
    else if (!$('coTerms').checked) err = ['coTerms', 'checkout.agreeRequired'];
    document.querySelectorAll('#coForm [aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    if (err) {
      $(err[0]).setAttribute('aria-invalid', 'true');
      $(err[0]).focus();
      $('coError').textContent = S.t(err[1], 'Please check this field.');
      return false;
    }
    $('coError').textContent = '';
    return true;
  }

  function submit(e) {
    e.preventDefault();
    if (!validate()) return;
    var method = (document.querySelector('#coPay input:checked') || {}).value;
    if (!method) return;
    var btn = $('coSubmit');
    btn.disabled = true;
    btn.textContent = S.t('checkout.placing', 'Placing order…');
    S.client.rpc('place_order', {
      p_contact: { name: $('coName').value.trim(), email: $('coEmail').value.trim(), phone: $('coPhone').value.trim() },
      p_address: { line1: $('coLine1').value, line2: $('coLine2').value, landmark: $('coLandmark').value,
                   city: $('coCity').value, state: $('coState').value, pincode: $('coPin').value },
      p_payment_method: method,
      p_coupon_code: coupon || null,
      p_delivery_instructions: $('coNotes').value || null,
      p_save_address: $('coSave').checked
    }).then(function (res) {
      if (res.error) throw res.error;
      var o = res.data;
      S.track('purchase', { transaction_id: o.order_number, currency: 'INR', value: Number(o.total) || 0 });
      S.cart.refresh().catch(function () {});
      var next = 'order-confirmation.html?order=' + encodeURIComponent(o.order_id);
      if (method === 'razorpay' && window.ArumbuPay) {
        return window.ArumbuPay.pay(o.order_id).then(function (r) {
          window.location.href = next + (r.paid ? '&paid=1' : '&pay=pending');
        }, function () { window.location.href = next + '&pay=pending'; });
      }
      window.location.href = next;
    }).catch(function (err) {
      $('coError').textContent = S.errorText(err);
      btn.disabled = false;
      btn.textContent = S.t('checkout.place', 'Place order');
      S.cart.refresh(coupon).then(renderSummary, function () {});
    });
  }

  $('coApply').addEventListener('click', function () {
    coupon = $('coCoupon').value.trim().toUpperCase();
    S.cart.refresh(coupon).then(renderSummary, function (err) { S.toast(S.errorText(err), 'error'); });
  });
  $('coSaved').addEventListener('change', function (e) {
    if (e.target.name !== 'savedAddr') return;
    if (e.target.value === 'new') {
      ['coLine1', 'coLine2', 'coLandmark', 'coCity', 'coPin'].forEach(function (id) { $(id).value = ''; });
      $('coSave').checked = true;
      $('coLine1').focus();
    } else fillAddress(addresses[+e.target.value]);
  });
  $('coForm').addEventListener('submit', submit);
  document.addEventListener('arumbu:lang', function () { if (quote) renderSummary(quote); });

  S.ready.then(function () {
    var user = S.user();
    if (!user) {
      show('coLogin');
      S.cart.refresh().then(function (q) {
        $('coGuestWhatsapp').href = S.whatsappUrl(S.cart.whatsappText(q));
        if (!(q.items || []).length) show('coEmpty');
      }, function () {});
      return;
    }
    var p = S.profile() || {};
    $('coName').value = p.full_name || (user.user_metadata && user.user_metadata.full_name) || '';
    $('coEmail').value = p.email || user.email || '';
    $('coPhone').value = p.phone || (user.user_metadata && user.user_metadata.phone) || '';
    Promise.all([S.cart.refresh(), loadAddresses().catch(function () {})]).then(function (r) {
      show('coForm');
      renderSummary(r[0]);
      S.track('begin_checkout', { currency: 'INR', value: Number(r[0].total) || 0 });
    }, function (err) {
      show('coEmpty');
      $('coEmpty').querySelector('p').textContent = S.errorText(err);
    });
  });
})();
