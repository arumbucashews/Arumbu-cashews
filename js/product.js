/* Arumbu Cashews — product detail page.
   URL forms: /products/<slug> (clean URL, via _redirects) or
   product.html?slug=<slug>. */
(function () {
  'use strict';
  var S = window.ArumbuStore, C = window.ArumbuCards;
  if (!S || !C) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = S.esc;

  function currentSlug() {
    var q = new URLSearchParams(window.location.search).get('slug');
    if (q) return q.toLowerCase();
    var m = window.location.pathname.match(/\/products\/([^\/?#]+)/i);
    return m ? decodeURIComponent(m[1]).toLowerCase() : '';
  }

  var product = null, selected = null, all = [];

  function setMeta(name, value, attr) {
    attr = attr || 'name';
    var el = document.head.querySelector('meta[' + attr + '="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }
  function addLd(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  function seo(p) {
    var site = 'https://arumbucashews.com';
    var url = site + '/products/' + encodeURIComponent(p.slug);
    var title = p.seo_title || (p.grade_name + ' — ' + (p.full_name || '') + ' | Arumbu Cashews');
    var desc = p.seo_description || (p.grade_name + ' (' + (p.full_name || '') + ') cashews from Arumbu Cashews, Tamil Nadu. Available in ' +
      (p.variants || []).map(function (v) { return v.pack_label; }).join(', ') + ' packs.');
    document.title = title;
    setMeta('description', desc);
    setMeta('og:title', title, 'property'); setMeta('og:description', desc, 'property'); setMeta('og:url', url, 'property');
    setMeta('twitter:title', title); setMeta('twitter:description', desc);
    var img = p.images && p.images[0] && p.images[0].url;
    var abs = img ? (/^https?:/.test(img) ? img : site + '/' + img) : null;
    if (abs) { setMeta('og:image', abs, 'property'); setMeta('twitter:image', abs); }
    var canon = document.head.querySelector('link[rel="canonical"]');
    if (canon) canon.href = url;

    var offers = (p.variants || []).filter(function (v) { return S.variantUnitPrice(v) != null; }).map(function (v) {
      return {
        '@type': 'Offer', sku: v.sku || undefined, price: S.variantUnitPrice(v).toFixed(2), priceCurrency: 'INR',
        availability: v.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: url, name: p.grade_name + ' ' + v.pack_label
      };
    });
    var ld = { '@context': 'https://schema.org', '@type': 'Product', name: p.grade_name + ' — ' + (p.full_name || ''),
      brand: { '@type': 'Brand', name: 'Arumbu Cashews' }, url: url };
    if (abs) ld.image = abs;
    if (p.short_description || p.full_description) ld.description = p.short_description || p.full_description;
    if (offers.length) ld.offers = offers; // only real, admin-entered prices
    addLd(ld);
    addLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site + '/' },
      { '@type': 'ListItem', position: 2, name: 'Products', item: site + '/products' },
      { '@type': 'ListItem', position: 3, name: p.grade_name, item: url }] });
  }

  function qty() { return Math.max(1, Math.min(999, parseInt($('pdQtyInput').value, 10) || 1)); }

  function paint() {
    var p = product;
    var ta = S.lang() === 'ta';
    $('pdCrumb').textContent = p.grade_name;
    $('pdCode').textContent = p.grade_name;
    $('pdName').textContent = S.productName(p);
    $('pdPrice').innerHTML = selected ? S.priceHtml(selected) : '';
    var gst = S.setting('gst_enabled', 'false') === 'true';
    var incl = S.setting('gst_prices_inclusive', 'true') !== 'false';
    $('pdTaxNote').textContent = selected && S.variantUnitPrice(selected) != null
      ? (gst ? (incl ? S.t('pd.taxIncl', 'Price includes GST.') : S.t('pd.taxExcl', 'GST added at checkout.')) : '') + ' ' + S.t('pd.deliveryNote', 'Delivery charges are shown at checkout.')
      : S.t('pd.priceRequestNote', 'Online price not listed for this pack yet — order on WhatsApp and we will confirm the price.');

    $('pdPacks').innerHTML = (p.variants || []).map(function (v) {
      return '<button type="button" class="pk" data-variant="' + esc(v.id) + '" aria-pressed="' + (selected && v.id === selected.id) + '">' + esc(v.pack_label) + '</button>';
    }).join('');

    var st = S.variantStatus(selected);
    $('pdStock').innerHTML = st === 'available' ? '<span class="stock-chip is-in">' + esc(S.t('store.inStock', 'In stock')) + '</span>'
      : st === 'out_of_stock' ? '<span class="stock-chip is-out">' + esc(S.t('store.outOfStock', 'Out of stock')) + '</span>' : '';
    var add = $('pdAdd');
    add.hidden = st === 'price_on_request';
    add.disabled = st !== 'available';
    add.textContent = st === 'out_of_stock' ? S.t('store.outOfStock', 'Out of stock') : S.t('pd.addToCart', 'Add to cart');
    $('pdWhatsapp').href = S.whatsappUrl(C.orderText(p, selected, qty()));
    $('pdWish').setAttribute('aria-pressed', String(S.wishlist.has(p.id)));

    var meta = [];
    meta.push([S.t('pd.grade', 'Grade'), p.grade_name]);
    if (selected && selected.weight_grams) meta.push([S.t('pd.netWeight', 'Net weight'), selected.pack_label]);
    if (selected && selected.sku) meta.push([S.t('pd.sku', 'SKU'), selected.sku]);
    $('pdMeta').innerHTML = meta.map(function (m) { return '<dt>' + esc(m[0]) + '</dt><dd>' + esc(m[1]) + '</dd>'; }).join('');

    var desc = ta ? (p.full_description_ta || p.short_description_ta || p.full_description || p.short_description) : (p.full_description || p.short_description);
    $('pdDesc').hidden = !desc;
    $('pdDescText').textContent = desc || '';

    var imgs = p.images || [];
    var main = $('pdImage');
    if (imgs.length) {
      main.src = imgs[0].url; main.alt = (ta && imgs[0].alt_ta) || imgs[0].alt || ('Arumbu Cashews ' + p.grade_name);
    } else {
      main.parentNode.classList.add('pcard-media', 'is-placeholder');
      main.alt = S.t('store.imageSoon', 'Image coming soon');
    }
    $('pdThumbs').innerHTML = imgs.length > 1 ? imgs.map(function (im, i) {
      return '<button type="button" data-img="' + i + '" aria-current="' + (i === 0) + '" aria-label="' + esc(S.fmt(S.t('pd.image', 'Image {n}'), { n: i + 1 })) + '"><img src="' + esc(im.url) + '" alt="" loading="lazy"></button>';
    }).join('') : '';
  }

  function related() {
    var p = product;
    var family = p.grade_name.replace(/[0-9]+$/, '');
    var same = all.filter(function (x) { return x.id !== p.id && x.grade_name.replace(/[0-9]+$/, '') === family; });
    var near = all.filter(function (x) { return x.id !== p.id && same.indexOf(x) === -1; })
      .sort(function (a, b) { return Math.abs(a.display_order - p.display_order) - Math.abs(b.display_order - p.display_order); });
    var list = same.concat(near).slice(0, 4);
    if (list.length) { C.renderInto($('relatedGrid'), list, { headingLevel: 3 }); $('relatedSection').hidden = false; }

    var rec = S.recent().filter(function (id) { return id !== p.id; })
      .map(function (id) { return all.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean).slice(0, 4);
    if (rec.length) { C.renderInto($('recentGrid'), rec, { headingLevel: 3 }); $('recentSection').hidden = false; }
  }

  document.addEventListener('click', function (e) {
    if (!product) return;
    var pk = e.target.closest('#pdPacks [data-variant]');
    if (pk) {
      selected = product.variants.filter(function (v) { return v.id === pk.getAttribute('data-variant'); })[0];
      paint();
      var again = document.querySelector('#pdPacks [data-variant="' + selected.id + '"]');
      if (again) again.focus();
      return;
    }
    var th = e.target.closest('#pdThumbs [data-img]');
    if (th) {
      var im = product.images[+th.getAttribute('data-img')];
      $('pdImage').src = im.url;
      document.querySelectorAll('#pdThumbs [data-img]').forEach(function (b) { b.setAttribute('aria-current', String(b === th)); });
      return;
    }
    var step = e.target.closest('#pdQty [data-step]');
    if (step) { $('pdQtyInput').value = Math.max(1, Math.min(999, qty() + Number(step.getAttribute('data-step')))); paint(); }
  });
  $('pdImage').addEventListener('error', function () {
    if (!product || this.getAttribute('data-fallback')) return;
    this.setAttribute('data-fallback', '1');
    var stat = S.staticImages[product.grade_name];
    if (stat) this.src = stat; else this.parentNode.classList.add('pcard-media', 'is-placeholder');
  });
  $('pdQtyInput').addEventListener('change', function () { this.value = qty(); paint(); });
  $('pdAdd').addEventListener('click', function () {
    var btn = this;
    if (!selected) return;
    btn.disabled = true;
    S.cart.add(selected.id, qty()).then(function () {
      S.toast(S.fmt(S.t('cart.added', 'Added to cart: {item}'), { item: product.grade_name + ' · ' + selected.pack_label + ' × ' + qty() }));
    }, function (err) { S.toast(S.errorText(err), 'error'); }).then(function () { btn.disabled = false; paint(); });
  });
  $('pdWish').addEventListener('click', function () {
    S.wishlist.toggle(product.id).then(paint, function (err) { S.toast(S.errorText(err), 'error'); });
  });
  document.addEventListener('arumbu:lang', function () { if (product) paint(); });
  document.addEventListener('arumbu:wishlist', function () { if (product) $('pdWish').setAttribute('aria-pressed', String(S.wishlist.has(product.id))); });

  var slug = currentSlug();
  S.loadCatalog().then(function (list) {
    all = list || [];
    product = all.filter(function (p) { return (p.slug || '').toLowerCase() === slug || p.grade_name.toLowerCase() === slug; })[0] || null;
    $('pdLoading').hidden = true;
    if (!product) {
      $('pdNotFound').hidden = false;
      var robots = document.head.querySelector('meta[name="robots"]');
      if (robots) robots.content = 'noindex';
      return;
    }
    selected = C.defaultVariant(product);
    $('pd').hidden = false;
    // product_catalog carries the short text only; the long description
    // comes from products (public read for published grades).
    var full = S.client.from('products').select('full_description, full_description_ta').eq('id', product.id).maybeSingle()
      .then(function (r) { if (r.data) { product.full_description = r.data.full_description; product.full_description_ta = r.data.full_description_ta; } }, function () {});
    return Promise.all([S.ready, full]).then(function () {
      paint(); seo(product); related();
      S.pushRecent(product.id);
      S.track('view_item', { currency: 'INR', items: [{ item_id: product.grade_name, item_name: product.full_name }] });
    });
  });
})();
