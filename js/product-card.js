/* Arumbu Cashews — product card renderer (shop, product page,
   wishlist, account). Depends on js/store.js. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var esc = S.esc;

  var WA_ICON = '<svg width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0 0 12.02 3.4a8.94 8.94 0 0 0-7.75 13.4L3 21l4.32-1.24a8.9 8.9 0 0 0 4.7 1.33h.01a8.94 8.94 0 0 0 8.94-8.94 8.86 8.86 0 0 0-3.37-6.83Zm-5.58 13.7h-.01a7.4 7.4 0 0 1-3.78-1.04l-.27-.16-2.8.8.75-2.74-.18-.28a7.44 7.44 0 1 1 13.8-3.9 7.45 7.45 0 0 1-7.51 7.32Zm4.07-5.58c-.22-.11-1.32-.65-1.53-.73-.2-.08-.35-.11-.5.11-.15.22-.57.73-.7.88-.13.15-.26.16-.48.05-.22-.11-.94-.35-1.79-1.11-.66-.6-1.11-1.33-1.24-1.55-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.22-.69-1.67-.18-.44-.37-.38-.5-.39-.13-.01-.28-.01-.43-.01-.15 0-.39.06-.6.28-.2.22-.79.78-.79 1.9s.81 2.2.92 2.35c.11.15 1.6 2.48 3.89 3.47.54.24.97.38 1.3.48.55.17 1.05.15 1.44.09.44-.07 1.32-.54 1.51-1.06.19-.52.19-.97.13-1.06-.06-.1-.2-.15-.42-.26Z"/></svg>';
  var HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2 5 5.4 5c2 0 3.4 1 4.6 2.6C11.2 6 12.6 5 14.6 5 18 5 19.6 8.4 18 11.7 15.5 16.4 12 21 12 21Z" stroke-linejoin="round"/></svg>';

  function defaultVariant(p) {
    var vs = p.variants || [];
    var avail = vs.filter(function (v) { return S.variantStatus(v) === 'available'; });
    var pool = avail.length ? avail : vs;
    var five = pool.filter(function (v) { return v.weight_grams === 500; })[0];
    return five || pool[0] || null;
  }

  function orderText(p, v, qty) {
    return 'Hi Arumbu Cashews, I\'d like to order ' + p.grade_name + ' cashews' +
      (v ? ' — ' + v.pack_label + ' pack' : '') + (qty && qty > 1 ? ' × ' + qty : '') + '.';
  }

  function stockChip(v) {
    var st = S.variantStatus(v);
    if (st === 'available') return '<span class="stock-chip is-in">' + esc(S.t('store.inStock', 'In stock')) + '</span>';
    if (st === 'out_of_stock') return '<span class="stock-chip is-out">' + esc(S.t('store.outOfStock', 'Out of stock')) + '</span>';
    return '';
  }

  function render(p, opts) {
    opts = opts || {};
    var el = document.createElement('article');
    el.className = 'pcard';
    el.setAttribute('data-product', p.id);
    var selected = defaultVariant(p);
    var url = S.productUrl(p);
    var img = p.images && p.images[0];

    function paint() {
      var v = selected;
      var st = S.variantStatus(v);
      var packs = (p.variants || []).map(function (x) {
        return '<button type="button" class="pk" data-variant="' + esc(x.id) + '" aria-pressed="' + (v && x.id === v.id) + '">' + esc(x.pack_label) + '</button>';
      }).join('');
      var buy = st === 'available'
        ? '<button type="button" class="btn btn-gold btn-sm" data-add>' + esc(S.t('pd.addToCart', 'Add to cart')) + '</button>'
        : '';
      el.innerHTML =
        (img
          ? '<a class="pcard-media" href="' + esc(url) + '"><img src="' + esc(img.url) + '" alt="' + esc((S.lang() === 'ta' && img.alt_ta) || img.alt || ('Arumbu Cashews ' + p.grade_name)) + '" loading="lazy" width="400" height="400"></a>'
          : '<a class="pcard-media is-placeholder" href="' + esc(url) + '"><span>' + esc(S.t('store.imageSoon', 'Image coming soon')) + '</span></a>') +
        '<button type="button" class="wish-btn" data-wish aria-pressed="' + S.wishlist.has(p.id) + '" aria-label="' + esc(S.t('wishlist.save', 'Save to wishlist')) + '">' + HEART + '</button>' +
        '<div class="pcard-body">' +
          '<h' + (opts.headingLevel || 2) + ' class="pcard-code"><a href="' + esc(url) + '">' + esc(p.grade_name) + '</a></h' + (opts.headingLevel || 2) + '>' +
          '<p class="pcard-name">' + esc(S.productName(p)) + '</p>' +
          '<div class="pcard-price">' + (v ? S.priceHtml(v) : '') + ' ' + (v ? stockChip(v) : '') + '</div>' +
          (packs ? '<div class="pcard-packs" role="group" aria-label="' + esc(S.t('grades.packSize', 'Pack size')) + '">' + packs + '</div>' : '') +
          '<div class="pcard-actions">' + buy +
            '<a class="btn btn-wa btn-sm" href="' + esc(S.whatsappUrl(orderText(p, v))) + '" target="_blank" rel="noopener">' + WA_ICON +
            '<span>' + esc(S.t('productCard.orderWhatsapp', 'Order on WhatsApp')) + '</span></a>' +
          '</div>' +
        '</div>';
    }

    // If an uploaded image fails to load, fall back to the built-in photo
    // (or the neutral placeholder) instead of showing a broken image.
    el.addEventListener('error', function (e) {
      var im = e.target;
      if (!im || im.tagName !== 'IMG' || im.getAttribute('data-fallback')) return;
      im.setAttribute('data-fallback', '1');
      var stat = S.staticImages[p.grade_name];
      if (stat && im.getAttribute('src') !== stat) { im.src = stat; return; }
      var media = im.closest('.pcard-media');
      if (media) { media.classList.add('is-placeholder'); media.innerHTML = '<span>' + esc(S.t('store.imageSoon', 'Image coming soon')) + '</span>'; }
    }, true);

    el.addEventListener('click', function (e) {
      var pk = e.target.closest('[data-variant]');
      if (pk) {
        selected = (p.variants || []).filter(function (x) { return x.id === pk.getAttribute('data-variant'); })[0] || selected;
        paint();
        var again = el.querySelector('[data-variant="' + selected.id + '"]');
        if (again) again.focus();
        return;
      }
      if (e.target.closest('[data-add]')) {
        var btn = e.target.closest('[data-add]');
        btn.disabled = true;
        S.cart.add(selected.id, 1).then(function () {
          S.toast(S.fmt(S.t('cart.added', 'Added to cart: {item}'), { item: p.grade_name + ' · ' + selected.pack_label }));
        }, function (err) { S.toast(S.errorText(err), 'error'); }).then(function () { btn.disabled = false; });
        return;
      }
      if (e.target.closest('[data-wish]')) {
        S.wishlist.toggle(p.id).then(function (added) {
          var w = el.querySelector('[data-wish]');
          if (w) w.setAttribute('aria-pressed', String(added));
          if (opts.onWishChange) opts.onWishChange(added);
        }, function (err) { S.toast(S.errorText(err), 'error'); });
      }
    });

    paint();
    el._repaint = paint;
    return el;
  }

  function renderInto(container, products, opts) {
    container.innerHTML = '';
    var frag = document.createDocumentFragment();
    products.forEach(function (p) { frag.appendChild(render(p, opts)); });
    container.appendChild(frag);
  }

  // Keep cards in the current language / wishlist state.
  function repaintAll() {
    document.querySelectorAll('.pcard').forEach(function (c) { if (c._repaint) c._repaint(); });
  }
  document.addEventListener('arumbu:lang', repaintAll);
  document.addEventListener('arumbu:wishlist', repaintAll);

  window.ArumbuCards = { render: render, renderInto: renderInto, orderText: orderText, defaultVariant: defaultVariant, WA_ICON: WA_ICON, HEART: HEART };
})();
