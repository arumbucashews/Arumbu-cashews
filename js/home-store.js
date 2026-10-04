/* Arumbu Cashews — homepage data layer (progressive enhancement).
   Leaves the approved homepage design untouched and only:
     - links each grade card to its product page;
     - shows the admin-entered price for the selected pack (nothing is
       shown while no price is set) and an "Add to cart" button when
       that pack can be bought online;
     - applies admin-managed hero text and the 3 hero images.
   If the database is unreachable the static homepage stays as is. */
(function () {
  'use strict';
  var S = window.ArumbuStore;
  if (!S) return;
  var esc = S.esc;
  var byGrade = {};

  function selectedVariant(item, product) {
    var pill = item.querySelector('.pack-pill.is-active') || item.querySelector('.pack-pill');
    var label = pill ? pill.getAttribute('data-pack') : '';
    var norm = function (s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); };
    return (product.variants || []).filter(function (v) { return norm(v.pack_label) === norm(label); })[0] || null;
  }

  function paint(item) {
    var p = byGrade[item.getAttribute('data-grade')];
    if (!p) return;
    var v = selectedVariant(item, p);
    var priceEl = item.querySelector('.grade-price');
    if (!priceEl) {
      priceEl = document.createElement('p');
      priceEl.className = 'grade-price';
      priceEl.setAttribute('aria-live', 'polite');
      var name = item.querySelector('.grade-name');
      if (name) name.insertAdjacentElement('afterend', priceEl);
    }
    var unit = S.variantUnitPrice(v);
    priceEl.innerHTML = unit != null ? S.priceHtml(v) + (v.in_stock ? '' : ' <span class="stock-chip is-out">' + esc(S.t('store.outOfStock', 'Out of stock')) + '</span>') : '';

    var btn = item.querySelector('.grade-cart');
    var can = S.variantStatus(v) === 'available';
    if (can && !btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grade-cart';
      var order = item.querySelector('.grade-order');
      if (order) order.insertAdjacentElement('afterend', btn); else item.appendChild(btn);
      btn.addEventListener('click', function () {
        var cur = selectedVariant(item, p);
        btn.disabled = true;
        S.cart.add(cur.id, 1).then(function () {
          S.toast(S.fmt(S.t('cart.added', 'Added to cart: {item}'), { item: p.grade_name + ' · ' + cur.pack_label }));
        }, function (err) { S.toast(S.errorText(err), 'error'); }).then(function () { btn.disabled = false; });
      });
    }
    if (btn) { btn.hidden = !can; btn.textContent = S.t('pd.addToCart', 'Add to cart'); }
  }

  function linkify(item, p) {
    var url = S.productUrl(p);
    var code = item.querySelector('.grade-code');
    if (code && !code.querySelector('a')) code.innerHTML = '<a href="' + esc(url) + '">' + esc(code.textContent) + '</a>';
    var media = item.querySelector('.grade-media');
    if (media && !media.closest('a') && media.tagName !== 'A') {
      var a = document.createElement('a');
      a.href = url; a.className = 'grade-media-link';
      a.setAttribute('aria-label', p.grade_name);
      a.setAttribute('tabindex', '-1');
      media.parentNode.insertBefore(a, media);
      a.appendChild(media);
    }
  }

  var items = document.querySelectorAll('.grade-item[data-grade]');
  S.loadCatalog().then(function (list) {
    (list || []).forEach(function (p) { byGrade[p.grade_name] = p; });
    items.forEach(function (item) {
      var p = byGrade[item.getAttribute('data-grade')];
      if (!p) return;
      linkify(item, p);
      paint(item);
      item.querySelectorAll('.pack-pill').forEach(function (pill) {
        pill.addEventListener('click', function () { setTimeout(function () { paint(item); }, 0); });
      });
    });
  });
  document.addEventListener('arumbu:lang', function () { items.forEach(paint); applyHero(); });

  /* ---------- hero (admin-managed) ---------- */
  var hero = null, slides = null;
  var ONLY_EM = /<(?!\/?em>)[^>]*>/gi;
  function applyHero() {
    var ta = S.lang() === 'ta';
    if (hero) {
      var title = document.querySelector('.hero-v2-title');
      var heading = (ta && hero.heading_ta) || hero.heading;
      if (title && heading) {
        var clean = String(heading).replace(ONLY_EM, '');
        // Same words as the built-in title: keep its <em> accent styling.
        if (clean.replace(/<\/?em>/g, '').trim() !== title.textContent.trim()) title.innerHTML = clean;
      }
      var sub = document.querySelector('.hero-v2-sub');
      var subText = (ta && hero.subheading_ta) || hero.subheading;
      if (sub && subText) sub.textContent = subText;
      var cta = document.querySelector('.hero-v2-actions .btn-gold');
      var ctaText = (ta && hero.cta_text_ta) || hero.cta_text;
      if (cta && ctaText) { var span = cta.querySelector('span'); if (span) span.textContent = ctaText; }
      if (cta && hero.cta_link && /^(https:\/\/wa\.me\/|https:\/\/|\/|#|[a-z0-9\-]+\.html)/i.test(hero.cta_link)) cta.href = hero.cta_link;
    }
    if (slides && slides.length) {
      var els = document.querySelectorAll('[data-hero-slider] .hero-slide');
      slides.slice(0, els.length).forEach(function (s, i) {
        var url = s.storage_path ? S.storageUrl(s.storage_path, 'media') : s.image_url;
        if (!url) return;
        var abs = new URL(url, window.location.href).href;
        if (els[i].src !== abs) els[i].src = url;
        var alt = (ta && s.alt_ta) || s.alt_en;
        if (alt) els[i].alt = alt;
      });
    }
  }
  if (S.client) {
    Promise.all([
      S.client.from('hero_settings').select('heading, heading_ta, subheading, subheading_ta, cta_text, cta_text_ta, cta_link').eq('is_active', true).limit(1).maybeSingle(),
      S.client.from('hero_slides').select('image_url, storage_path, alt_en, alt_ta, display_order').eq('is_active', true).order('display_order')
    ]).then(function (r) {
      hero = r[0].error ? null : r[0].data;
      slides = r[1].error ? null : r[1].data;
      applyHero();
    }, function () {});
  }
})();
