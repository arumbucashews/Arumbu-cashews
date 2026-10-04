/* Arumbu Cashews — cart page. All amounts come from the server quote
   (quote_items / cart_get); this file only displays them. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.esc;

  function imageFor(line) {
    if (line.image_path) return S.storageUrl(line.image_path);
    return S.staticImages[line.grade_name] || null;
  }
  function statusText(st) {
    return st === 'out_of_stock' ? S.t('store.outOfStock', 'Out of stock')
      : st === 'price_on_request' ? S.t('store.priceOnRequest', 'Price on request')
      : st === 'unavailable' ? S.t('store.unavailable', 'No longer available') : '';
  }


  function render(q) {
    $('cartLoading').hidden = true;
    var items = (q && q.items) || [];
    $('cartEmpty').hidden = items.length > 0;
    $('cartLayout').hidden = items.length === 0;
    if (!items.length) return;

    $('cartLines').innerHTML = items.map(function (i) {
      var img = imageFor(i);
      var bad = i.status !== 'available';
      var name = S.lang() === 'ta' && i.full_name_ta ? i.full_name_ta : i.full_name;
      return '<li class="cart-line' + (bad ? ' is-unavailable' : '') + '" data-variant="' + esc(i.variant_id) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<span class="ph"></span>') +
        '<div><h3><a href="' + esc(S.productUrl({ slug: i.slug, grade_name: i.grade_name })) + '">' + esc(i.grade_name) + '</a></h3>' +
        '<p class="meta">' + esc(name || '') + ' · ' + esc(i.pack_label) + '</p>' +
        '<p class="meta">' + (i.unit_price != null ? esc(S.money(i.unit_price)) + ' ' + esc(S.t('cart.each', 'each')) : '') +
        (bad ? ' <span class="stock-chip is-out">' + esc(statusText(i.status)) + '</span>' : '') + '</p></div>' +
        '<div class="line-side">' +
          '<div class="qty"><button type="button" data-step="-1" aria-label="' + esc(S.t('pd.qtyLess', 'Decrease quantity')) + '">−</button>' +
          '<input type="number" min="1" max="999" value="' + esc(i.quantity) + '" aria-label="' + esc(S.t('pd.quantity', 'Quantity')) + '">' +
          '<button type="button" data-step="1" aria-label="' + esc(S.t('pd.qtyMore', 'Increase quantity')) + '">+</button></div>' +
          '<span class="line-total">' + (i.line_total != null ? esc(S.money(i.line_total)) : '') + '</span>' +
          '<button type="button" class="link-btn" data-remove>' + esc(S.t('cart.remove', 'Remove')) + '</button>' +
        '</div></li>';
    }).join('');

    $('cartSummary').innerHTML = S.summaryRows(q);
    $('cartWarn').hidden = q.all_available;
    var co = $('cartCheckout');
    co.classList.toggle('is-disabled', !q.all_available);
    co.setAttribute('aria-disabled', String(!q.all_available));
    var free = q.free_delivery_threshold;
    $('cartDeliveryNote').textContent = q.delivery_configured && free && Number(q.subtotal) < Number(free)
      ? S.fmt(S.t('cart.freeOver', 'Free delivery on orders over {amount}.'), { amount: S.money(free) })
      : (!q.delivery_configured ? S.t('cart.deliveryNote', 'Delivery charges depend on your location and are confirmed with you before dispatch.') : '');
    $('cartWhatsapp').href = S.whatsappUrl(S.cart.whatsappText(q));
  }

  function busy(on) { $('cartLines').style.opacity = on ? '.6' : ''; }
  function update(variantId, qtyVal) {
    busy(true);
    S.cart.set(variantId, qtyVal).catch(function (err) { S.toast(S.errorText(err), 'error'); }).then(function () { busy(false); });
  }

  $('cartLines').addEventListener('click', function (e) {
    var line = e.target.closest('.cart-line');
    if (!line) return;
    var id = line.getAttribute('data-variant');
    var input = line.querySelector('input');
    if (e.target.closest('[data-remove]')) return update(id, 0);
    var step = e.target.closest('[data-step]');
    if (step) update(id, Math.max(0, Math.min(999, (parseInt(input.value, 10) || 1) + Number(step.getAttribute('data-step')))));
  });
  $('cartLines').addEventListener('change', function (e) {
    var line = e.target.closest('.cart-line');
    if (line && e.target.matches('input')) update(line.getAttribute('data-variant'), Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)));
  });
  $('cartClear').addEventListener('click', function () {
    if (window.confirm(S.t('cart.clearConfirm', 'Remove everything from your cart?'))) S.cart.clear().catch(function (err) { S.toast(S.errorText(err), 'error'); });
  });
  $('cartCheckout').addEventListener('click', function (e) {
    if (this.getAttribute('aria-disabled') === 'true') { e.preventDefault(); S.toast(S.t('err.cartUnavailable', 'Remove unavailable items to continue.'), 'error'); }
    else S.track('begin_checkout', { currency: 'INR', value: Number((S.state.cartQuote || {}).total || 0) });
  });

  document.addEventListener('arumbu:cart', function (e) { render(e.detail.quote); });
  document.addEventListener('arumbu:lang', function () { if (S.state.cartQuote) render(S.state.cartQuote); });
  S.ready.then(function () {
    S.cart.refresh().then(render, function () {
      $('cartLoading').hidden = true;
      $('cartEmpty').hidden = false;
      $('cartEmpty').querySelector('p').textContent = S.t('err.storeOffline', 'The online shop is not available right now. You can still order on WhatsApp.');
    });
  });
})();
