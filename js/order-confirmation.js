/* Arumbu Cashews — order confirmation (reads the order through RLS:
   a customer can only ever see their own orders). */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.esc;
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get('order');

  function statusLabel(s) { return S.t('order.status.' + s, String(s || '').replace(/_/g, ' ')); }

  function render(o) {
    $('ocLoading').hidden = true;
    $('ocCard').hidden = false;
    $('ocNumber').textContent = o.order_number;
    $('ocStatus').innerHTML = esc(S.t('confirm.statusLabel', 'Status')) + ': <span class="status-chip" data-status="' + esc(o.order_status) + '">' + esc(statusLabel(o.order_status)) + '</span> · ' +
      esc(S.t('confirm.payment', 'Payment')) + ': <span class="status-chip">' + esc(S.t('payment.status.' + o.payment_status, o.payment_status)) + '</span>';

    var lines = (o.order_items || []).map(function (i) {
      return '<li style="display:flex;justify-content:space-between;gap:.6rem"><span>' + esc(i.grade_name_snapshot) + ' · ' + esc(i.pack_label_snapshot || '') + ' × ' + esc(i.quantity) +
        '</span><span>' + (i.line_total != null ? esc(S.money(i.line_total)) : '') + '</span></li>';
    }).join('');
    $('ocItems').innerHTML = '<ul style="list-style:none;padding:0;display:grid;gap:.4rem;color:var(--st-ink)">' + lines + '</ul>' +
      '<dl class="summary" style="display:grid;grid-template-columns:1fr auto;gap:.4rem;margin-top:1rem;border-top:1px solid var(--st-line);padding-top:.8rem">' +
      S.summaryRows({ subtotal: o.subtotal, discount: o.discount, delivery_configured: o.delivery_confirmed, delivery_fee: o.delivery_fee,
                      tax: o.tax, tax_rate: o.tax_rate, tax_inclusive: o.tax_inclusive, total: o.total }) + '</dl>';

    var waText = 'Hi Arumbu Cashews, I have placed order ' + o.order_number + ' on your website.' +
      '\n' + (o.order_items || []).map(function (i) { return '• ' + i.grade_name_snapshot + ' ' + (i.pack_label_snapshot || '') + ' × ' + i.quantity; }).join('\n') +
      '\nTotal: ' + S.money(o.total) + (o.delivery_confirmed ? '' : ' + delivery (please confirm)');
    $('ocWhatsapp').href = S.whatsappUrl(waText);

    var next = $('ocNext');
    if (o.payment_method === 'razorpay' && o.payment_status !== 'paid' && o.order_status === 'pending') {
      next.innerHTML = esc(S.t('confirm.payPending', 'Your payment was not completed. You can try again below — the order is held for you.')) +
        ' <button type="button" class="btn btn-gold btn-sm" id="ocPay">' + esc(S.t('confirm.payNow', 'Pay now')) + '</button>';
      $('ocWhatsapp').hidden = true;
      $('ocPay').addEventListener('click', function () {
        this.disabled = true;
        window.ArumbuPay.pay(o.id).then(function (r) {
          if (r.paid) window.location.replace('order-confirmation.html?order=' + encodeURIComponent(o.id) + '&paid=1');
          else load();
        }, function (err) { S.toast(S.errorText(err), 'error'); load(); });
      });
    } else if (o.payment_method === 'razorpay' && o.payment_status === 'paid') {
      next.textContent = S.t('confirm.paidNext', 'Payment received. We will email you when your order is packed and shipped.');
      $('ocWhatsapp').hidden = true;
    } else {
      next.textContent = S.t('confirm.waNext', 'Next step: tap “Confirm on WhatsApp” so we can confirm delivery charges and payment with you.');
    }
  }

  function load() {
    return S.client.from('orders')
      .select('id, order_number, order_status, payment_status, payment_method, subtotal, discount, delivery_fee, delivery_confirmed, tax, tax_rate, tax_inclusive, total, order_items(grade_name_snapshot, pack_label_snapshot, quantity, line_total)')
      .eq('id', orderId).maybeSingle()
      .then(function (res) {
        if (res.error || !res.data) throw res.error || new Error('not_found');
        render(res.data);
      });
  }

  S.ready.then(function () {
    if (!S.user()) { window.location.replace('login.html?next=' + encodeURIComponent('order-confirmation.html' + window.location.search)); return; }
    if (!S.isUuid(orderId)) throw new Error('bad id');
    return load();
  }).catch(function () { $('ocLoading').hidden = true; $('ocMissing').hidden = false; });
  document.addEventListener('arumbu:lang', function () { if (S.isUuid(orderId) && S.user()) load().catch(function () {}); });
})();
