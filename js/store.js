/* ============================================================
   ARUMBU CASHEWS — SHARED STORE LAYER (public site)
   ============================================================
   One place for everything the public pages share:
     - Supabase client (publishable key only, RLS-governed)
     - auth session (Supabase Auth)
     - catalogue (products + pack-size variants + images)
     - cart  — guests: localStorage; signed in: Supabase cart_lines.
               A guest cart is merged into the account on login.
     - wishlist — guests: localStorage; signed in: Supabase
               `favourites`. Merged on login.
     - recently viewed (localStorage, this browser only)
     - site settings + admin-managed text (content_blocks)
     - header badges / Account / Cart / Wishlist panels
     - GA4 (only when an ID is configured in Admin → Settings)

   Prices are NEVER computed here for anything that is charged:
   every total shown in the cart/checkout comes from the database
   function quote_items(), and orders are created by place_order(),
   which re-prices everything server-side.

   Events fired on `document`:
     arumbu:ready, arumbu:auth, arumbu:cart, arumbu:wishlist,
     arumbu:catalog, arumbu:lang (from i18n.js)
   ============================================================ */
(function () {
  'use strict';

  var LS_CART = 'arumbuCart';
  var LS_WISH = 'arumbuWishlist';
  var LS_RECENT = 'arumbuRecent';
  var WA_NUMBER = '919976055524';

  var STATIC_IMAGES = {
    WW180: 'images/products/ww180.jpg', WW210: 'images/products/ww210.png',
    WW240: 'images/products/ww240.jpg', WW320: 'images/products/ww320.jpg',
    WW400: 'images/products/ww400.jpg', SW: 'images/products/sw.png',
    SSW: 'images/products/ssw.png', CSP: 'images/products/csp.jpg',
    BB: 'images/products/bb.jpg', JH: 'images/products/jh.jpg',
    SJH: 'images/products/sjh.png', JK: 'images/products/jk.png'
  };

  /* ---------- small utilities ---------- */
  function lsGet(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* non-fatal */ }
  }
  function emit(name, detail) {
    try { document.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lang() { return (window.arumbuI18n && window.arumbuI18n.getLang()) || 'en'; }
  function t(key, fallback) {
    var v = window.arumbuI18n && window.arumbuI18n.translate(key, lang());
    return v == null ? (fallback == null ? key : fallback) : v;
  }
  function fmt(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ''; });
  }
  function money(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '';
    var num = Number(n);
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: num % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(num);
    } catch (e) { return '₹' + num.toFixed(2); }
  }
  function isUuid(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(message, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'store-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.className = 'store-toast is-visible' + (kind === 'error' ? ' is-error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'store-toast'; }, 3200);
  }

  /* ---------- error messages (server error codes -> friendly text) ---------- */
  function errorText(err) {
    var msg = (err && (err.message || err.error_description || err.error)) || String(err || '');
    var code = msg.split(':')[0].trim();
    var map = {
      not_authenticated: 'err.notAuthenticated', invalid_name: 'err.invalidName', invalid_phone: 'err.invalidPhone',
      invalid_email: 'err.invalidEmail', invalid_address: 'err.invalidAddress', invalid_pincode: 'err.invalidPincode',
      cart_empty: 'err.cartEmpty', cart_has_unavailable_items: 'err.cartUnavailable', invalid_coupon: 'err.invalidCoupon',
      insufficient_stock: 'err.insufficientStock', online_payment_unavailable: 'err.onlinePaymentUnavailable',
      whatsapp_orders_unavailable: 'err.whatsappUnavailable', order_not_cancellable: 'err.notCancellable',
      invalid_quantity: 'err.invalidQuantity', 'Invalid login credentials': 'auth.err.invalidLogin',
      'Email not confirmed': 'auth.err.emailNotConfirmed', 'User already registered': 'auth.err.alreadyRegistered'
    };
    var key = map[code] || map[msg];
    if (key) {
      var text = t(key, null);
      if (text && code === 'insufficient_stock' && msg.indexOf(':') > -1) text = text + ' (' + msg.split(':')[1] + ')';
      if (text) return text;
    }
    if (/Failed to fetch|NetworkError|network/i.test(msg)) return t('err.network', 'Network problem — please check your connection and try again.');
    if (/Password should be/i.test(msg)) return t('auth.err.weakPassword', 'Password must be at least 8 characters.');
    return t('err.generic', 'Something went wrong. Please try again.');
  }

  /* ---------- Supabase client ---------- */
  var client = null;
  if (window.supabase && window.ARUMBU_PUBLIC_SUPABASE_URL && window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      client = window.supabase.createClient(window.ARUMBU_PUBLIC_SUPABASE_URL, window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'arumbu-auth' }
      });
    } catch (e) { client = null; }
  }

  function storageUrl(path, bucket) {
    if (!path) return null;
    if (/^(https?:)?\/\//.test(path) || /^images\//.test(path)) return path;
    if (!client) return null;
    try { return client.storage.from(bucket || 'product-images').getPublicUrl(path).data.publicUrl; }
    catch (e) { return null; }
  }

  /* ---------- state ---------- */
  var state = {
    user: null,
    profile: null,
    settings: {},
    catalog: null,          // array of products (with variants, images)
    catalogError: null,
    cartQuote: null,        // last quote from the server
    cartCount: 0,
    wishlist: [],           // product ids
    available: false        // commerce schema reachable
  };

  /* ---------- settings ---------- */
  function loadSettings() {
    if (!client) return Promise.resolve({});
    return client.from('site_settings').select('key, value').then(function (res) {
      if (res.error || !res.data) return {};
      var out = {};
      res.data.forEach(function (row) { out[row.key] = row.value; });
      state.settings = out;
      return out;
    }, function () { return {}; });
  }
  function setting(key, fallback) {
    var v = state.settings[key];
    return v == null || v === '' ? fallback : v;
  }
  function whatsappNumber() {
    var v = String(setting('whatsapp_number', '') || '').replace(/[^0-9]/g, '');
    return v.length >= 10 ? (v.length === 10 ? '91' + v : v) : WA_NUMBER;
  }
  function whatsappUrl(text) {
    return 'https://wa.me/' + whatsappNumber() + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  /* ---------- footer social links (Admin → Social links / Settings) ---------- */
  var SOCIAL_ICONS = {
    youtube: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"/></svg>',
    linkedin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.9 8.6H3.6V20h3.3V8.6ZM5.3 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM20.4 13.4c0-3.1-1.7-4.9-4.3-4.9-1.6 0-2.6.9-3 1.6V8.6H9.8V20h3.3v-5.6c0-1.5.3-2.9 2.1-2.9 1.8 0 1.8 1.7 1.8 3V20h3.3l.1-6.6Z"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/></svg>'
  };
  var SAFE_URL = /^https:\/\/[^\s"'<>]+$/i;
  function applySocial() {
    if (!client) return Promise.resolve();
    return client.from('social_links').select('platform, url').then(function (res) {
      (res.data || []).forEach(function (row) {
        if (!SAFE_URL.test(row.url || '')) return;
        document.querySelectorAll('[data-social="' + row.platform + '"]').forEach(function (a) { a.href = row.url; });
      });
      ['youtube', 'linkedin', 'x'].forEach(function (key) {
        var url = String(setting('social_' + key + '_url', '') || '');
        if (!SAFE_URL.test(url)) return;
        document.querySelectorAll('.footer-social').forEach(function (wrap) {
          if (wrap.querySelector('[data-social="' + key + '"]')) return;
          var a = document.createElement('a');
          a.className = 'social-icon'; a.href = url; a.target = '_blank'; a.rel = 'noopener';
          a.setAttribute('data-social', key);
          a.setAttribute('aria-label', key === 'x' ? 'X' : key.charAt(0).toUpperCase() + key.slice(1));
          a.innerHTML = SOCIAL_ICONS[key];
          wrap.appendChild(a);
        });
      });
    }, function () {});
  }

  /* ---------- admin-managed text (content_blocks) ---------- */
  var ALLOWED_HTML = /<(?!\/?em>)[^>]*>/gi; // strip every tag except <em>/</em>
  function loadContentBlocks() {
    if (!client || !window.ARUMBU_TRANSLATIONS) return Promise.resolve();
    return client.from('content_blocks').select('key, value_en, value_ta').then(function (res) {
      if (res.error || !res.data || !res.data.length) return;
      var dict = window.ARUMBU_TRANSLATIONS;
      var byLower = {};
      Object.keys(dict).forEach(function (k) { byLower[k.toLowerCase()] = k; });
      var cms = {};
      res.data.forEach(function (row) {
        var key = byLower[row.key] || row.key;
        var isHtml = /\.html$/.test(key);
        var clean = function (v) {
          if (v == null || v === '') return null;
          return isHtml ? String(v).replace(ALLOWED_HTML, '') : String(v);
        };
        var en = clean(row.value_en), ta = clean(row.value_ta);
        if (en == null && ta == null) return;
        var cur = dict[key] || {};
        dict[key] = { en: en != null ? en : cur.en, ta: ta != null ? ta : (cur.ta || en) };
        cms[row.key] = row;
      });
      state.cms = cms;
      if (window.arumbuI18n && window.arumbuI18n.apply) window.arumbuI18n.apply();
      applySpecialBlocks();
    }, function () {});
  }
  // Non-text CMS blocks: founder image path.
  function applySpecialBlocks() {
    var cms = state.cms || {};
    var img = cms['founder.image'] && cms['founder.image'].value_en;
    if (img) {
      var url = storageUrl(img, 'media');
      document.querySelectorAll('[data-cms-image="founder.image"]').forEach(function (el) {
        if (url && el.getAttribute('src') !== url) el.setAttribute('src', url);
      });
    }
  }

  /* ---------- catalogue ---------- */
  var catalogPromise = null;
  function loadCatalog(force) {
    if (catalogPromise && !force) return catalogPromise;
    if (!client) { state.catalogError = 'offline'; return (catalogPromise = Promise.resolve([])); }
    catalogPromise = Promise.all([
      client.from('product_catalog').select('*').order('display_order', { ascending: true }),
      client.from('product_variants').select('id, product_id, pack_label, weight_grams, sku, price, sale_price, in_stock, display_order').order('display_order', { ascending: true }),
      client.from('product_images').select('product_id, storage_path, alt_text, alt_text_ta, is_primary, display_order').order('display_order', { ascending: true })
    ]).then(function (r) {
      if (r[0].error) { state.catalogError = r[0].error.message; state.available = false; return []; }
      state.available = true;
      var variants = r[1].data || [];
      var images = r[2].data || [];
      var list = (r[0].data || []).map(function (p) {
        var vs = variants.filter(function (v) { return v.product_id === p.id; })
          .sort(function (a, b) { return (a.weight_grams || 0) - (b.weight_grams || 0); });
        var imgs = images.filter(function (i) { return i.product_id === p.id; })
          .sort(function (a, b) { return (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.display_order || 0) - (b.display_order || 0); })
          .map(function (i) { return { url: storageUrl(i.storage_path), alt: i.alt_text, alt_ta: i.alt_text_ta }; })
          .filter(function (i) { return i.url; });
        if (!imgs.length && STATIC_IMAGES[p.grade_name]) imgs.push({ url: STATIC_IMAGES[p.grade_name], alt: 'Arumbu Cashews ' + p.grade_name });
        return Object.assign({}, p, { variants: vs, images: imgs });
      });
      state.catalog = list;
      emit('arumbu:catalog', { products: list });
      return list;
    }, function (e) { state.catalogError = String(e); return []; });
    return catalogPromise;
  }
  function productName(p) {
    if (!p) return '';
    return (lang() === 'ta' && p.full_name_ta) ? p.full_name_ta : (p.full_name || t('grade.' + p.grade_name, p.grade_name));
  }
  function productUrl(p) { return 'products/' + encodeURIComponent((p && (p.slug || p.grade_name || '')).toLowerCase()); }
  function variantUnitPrice(v) {
    if (!v) return null;
    var price = v.sale_price != null ? v.sale_price : v.price;
    return price == null ? null : Number(price);
  }
  function variantStatus(v) {
    if (!v) return 'unavailable';
    if (variantUnitPrice(v) == null) return 'price_on_request';
    if (!v.in_stock) return 'out_of_stock';
    return 'available';
  }
  function findVariant(variantId) {
    var list = state.catalog || [];
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < list[i].variants.length; j++) {
        if (list[i].variants[j].id === variantId) return { product: list[i], variant: list[i].variants[j] };
      }
    }
    return null;
  }
  function priceHtml(v) {
    var unit = variantUnitPrice(v);
    if (unit == null) return '<span class="price-on-request">' + esc(t('store.priceOnRequest', 'Price on request')) + '</span>';
    if (v.sale_price != null && v.price != null && Number(v.sale_price) < Number(v.price)) {
      return '<span class="price-now">' + esc(money(v.sale_price)) + '</span> <s class="price-was">' + esc(money(v.price)) + '</s>';
    }
    return '<span class="price-now">' + esc(money(unit)) + '</span>';
  }

  /* ---------- recently viewed ---------- */
  function pushRecent(productId) {
    if (!isUuid(productId)) return;
    var list = lsGet(LS_RECENT, []).filter(function (id) { return id !== productId; });
    list.unshift(productId);
    lsSet(LS_RECENT, list.slice(0, 12));
  }
  function recent() { return lsGet(LS_RECENT, []).filter(isUuid); }

  /* ---------- cart ---------- */
  function guestCart() {
    return lsGet(LS_CART, []).filter(function (i) { return i && isUuid(i.variant_id) && i.quantity > 0; });
  }
  function setGuestCart(items) { lsSet(LS_CART, items); }
  function countOf(items) { return (items || []).reduce(function (s, i) { return s + (Number(i.quantity) || 0); }, 0); }

  function quoteGuest(coupon) {
    var items = guestCart();
    if (!client) return Promise.resolve({ items: [], subtotal: 0, total: 0, all_available: false, offline: true });
    if (!items.length) return Promise.resolve(emptyQuote());
    return client.rpc('quote_items', { p_items: items, p_coupon_code: coupon || null }).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }
  function emptyQuote() {
    return { items: [], subtotal: 0, delivery_fee: 0, discount: 0, tax: 0, total: 0, all_available: false, delivery_configured: false };
  }
  function refreshCart(coupon) {
    var p = state.user && client
      ? client.rpc('cart_get', { p_coupon_code: coupon || null }).then(function (res) { if (res.error) throw res.error; return res.data; })
      : quoteGuest(coupon);
    return p.then(function (quote) {
      quote = quote || emptyQuote();
      state.cartQuote = quote;
      state.cartCount = countOf(quote.items);
      renderHeader();
      emit('arumbu:cart', { quote: quote });
      return quote;
    }, function (err) {
      // schema missing / offline — fall back to a local count
      state.cartCount = state.user ? state.cartCount : countOf(guestCart());
      renderHeader();
      throw err;
    });
  }
  function cartAdd(variantId, qty) {
    qty = Math.max(1, Math.min(999, parseInt(qty, 10) || 1));
    if (!isUuid(variantId)) return Promise.reject(new Error('invalid_quantity'));
    var found = findVariant(variantId);
    if (found && variantStatus(found.variant) !== 'available') return Promise.reject(new Error('cart_has_unavailable_items'));
    var op;
    if (state.user && client) {
      op = client.rpc('cart_add_item', { p_variant_id: variantId, p_quantity: qty }).then(function (res) { if (res.error) throw res.error; });
    } else {
      var items = guestCart();
      var line = items.filter(function (i) { return i.variant_id === variantId; })[0];
      if (line) line.quantity = Math.min(999, line.quantity + qty); else items.push({ variant_id: variantId, quantity: qty });
      setGuestCart(items);
      op = Promise.resolve();
    }
    return op.then(function () {
      track('add_to_cart', found ? { currency: 'INR', value: (variantUnitPrice(found.variant) || 0) * qty, items: [{ item_id: found.variant.sku || found.variant.id, item_name: found.product.grade_name + ' ' + found.variant.pack_label, quantity: qty }] } : {});
      return refreshCart();
    });
  }
  function cartSet(variantId, qty) {
    qty = Math.max(0, Math.min(999, parseInt(qty, 10) || 0));
    var op;
    if (state.user && client) {
      op = client.rpc('cart_set_item', { p_variant_id: variantId, p_quantity: qty }).then(function (res) { if (res.error) throw res.error; });
    } else {
      var items = guestCart().filter(function (i) { return i.variant_id !== variantId || qty > 0; });
      items.forEach(function (i) { if (i.variant_id === variantId) i.quantity = qty; });
      setGuestCart(items);
      op = Promise.resolve();
    }
    return op.then(function () { return refreshCart(); });
  }
  function cartClear() {
    var op = state.user && client
      ? client.rpc('cart_clear').then(function (res) { if (res.error) throw res.error; })
      : Promise.resolve(setGuestCart([]));
    return op.then(function () { return refreshCart(); });
  }
  function mergeGuestCart() {
    var items = guestCart();
    if (!items.length || !client) return Promise.resolve();
    return client.rpc('cart_merge', { p_items: items }).then(function (res) {
      if (!res.error) setGuestCart([]);
    });
  }
  function cartWhatsappText(quote) {
    quote = quote || state.cartQuote || emptyQuote();
    var lines = ['Hi Arumbu Cashews, I\'d like to order:'];
    (quote.items || []).forEach(function (i) {
      lines.push('• ' + i.grade_name + ' (' + (i.full_name || '') + ') — ' + i.pack_label + ' × ' + i.quantity +
        (i.line_total != null ? ' = ' + money(i.line_total) : ''));
    });
    if (quote.subtotal) lines.push('Subtotal: ' + money(quote.subtotal));
    return lines.join('\n');
  }

  function summaryRows(q) {
    var rows = [[t('cart.subtotal', 'Subtotal'), money(q.subtotal)]];
    if (Number(q.discount) > 0) rows.push([t('cart.discount', 'Discount'), '− ' + money(q.discount)]);
    rows.push([t('cart.delivery', 'Delivery'), q.delivery_configured
      ? (Number(q.delivery_fee) > 0 ? money(q.delivery_fee) : t('cart.free', 'Free'))
      : t('cart.deliveryConfirm', 'Confirmed before dispatch')]);
    if (q.tax_rate != null && Number(q.tax) > 0) {
      rows.push([fmt(q.tax_inclusive ? t('cart.gstIncl', 'GST ({rate}%, included)') : t('cart.gst', 'GST ({rate}%)'), { rate: Number(q.tax_rate) }), money(q.tax)]);
    }
    return rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
      '<dt class="total-row">' + esc(t('cart.total', 'Total')) + '</dt><dd class="total-row">' + esc(money(q.total)) + '</dd>';
  }

  /* ---------- wishlist ---------- */
  function loadWishlist() {
    if (state.user && client) {
      return client.from('favourites').select('product_id').then(function (res) {
        state.wishlist = res.error ? [] : (res.data || []).map(function (r) { return r.product_id; });
        renderHeader(); emit('arumbu:wishlist', { ids: state.wishlist });
        return state.wishlist;
      });
    }
    state.wishlist = lsGet(LS_WISH, []).filter(isUuid);
    renderHeader(); emit('arumbu:wishlist', { ids: state.wishlist });
    return Promise.resolve(state.wishlist);
  }
  function inWishlist(productId) { return state.wishlist.indexOf(productId) !== -1; }
  function toggleWishlist(productId) {
    if (!isUuid(productId)) return Promise.resolve(false);
    var adding = !inWishlist(productId);
    var op;
    if (state.user && client) {
      op = adding
        ? client.from('favourites').insert({ customer_id: state.user.id, product_id: productId })
        : client.from('favourites').delete().eq('customer_id', state.user.id).eq('product_id', productId);
      op = op.then(function (res) { if (res.error && res.error.code !== '23505') throw res.error; });
    } else {
      var list = lsGet(LS_WISH, []).filter(function (id) { return id !== productId; });
      if (adding) list.unshift(productId);
      lsSet(LS_WISH, list.slice(0, 50));
      op = Promise.resolve();
    }
    return op.then(function () { return loadWishlist(); }).then(function () {
      toast(adding ? t('wishlist.added', 'Saved to your wishlist') : t('wishlist.removed', 'Removed from your wishlist'));
      return adding;
    });
  }
  function mergeGuestWishlist() {
    var ids = lsGet(LS_WISH, []).filter(isUuid);
    if (!ids.length || !client || !state.user) return Promise.resolve();
    var rows = ids.map(function (id) { return { customer_id: state.user.id, product_id: id }; });
    return client.from('favourites').upsert(rows, { onConflict: 'customer_id,product_id', ignoreDuplicates: true })
      .then(function (res) {
        if (res.error) {
          // no unique constraint to upsert on — insert one by one, ignoring duplicates
          return Promise.all(ids.map(function (id) {
            return client.from('favourites').select('id').eq('customer_id', state.user.id).eq('product_id', id).maybeSingle()
              .then(function (r) { if (!r.data) return client.from('favourites').insert({ customer_id: state.user.id, product_id: id }); });
          }));
        }
      }).then(function () { lsSet(LS_WISH, []); });
  }

  /* ---------- auth ---------- */
  function loadProfile() {
    if (!state.user || !client) { state.profile = null; return Promise.resolve(null); }
    return client.from('customer_profiles').select('id, full_name, email, phone, preferred_language').eq('id', state.user.id).maybeSingle()
      .then(function (res) { state.profile = res.data || null; return state.profile; }, function () { return null; });
  }
  function siteBase() {
    var u = window.location.origin;
    if (!u || u === 'null') u = String(setting('site_url', 'https://arumbucashews.com'));
    return u.replace(/\/$/, '');
  }
  var auth = {
    signIn: function (email, password) {
      return client.auth.signInWithPassword({ email: String(email).trim(), password: password }).then(function (res) {
        if (res.error) throw res.error; return res.data;
      });
    },
    signUp: function (email, password, fullName, phone) {
      return client.auth.signUp({
        email: String(email).trim(), password: password,
        options: { data: { full_name: fullName || null, phone: phone || null }, emailRedirectTo: siteBase() + '/account.html' }
      }).then(function (res) { if (res.error) throw res.error; return res.data; });
    },
    signOut: function () {
      return client.auth.signOut().then(function () { window.location.href = 'index.html'; });
    },
    resetPassword: function (email) {
      return client.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: siteBase() + '/reset-password.html' })
        .then(function (res) { if (res.error) throw res.error; });
    },
    updatePassword: function (password) {
      return client.auth.updateUser({ password: password }).then(function (res) { if (res.error) throw res.error; });
    }
  };

  var lastUserId = null;
  function onSession(session, event) {
    var user = session ? session.user : null;
    var changed = (user && user.id) !== lastUserId;
    state.user = user;
    lastUserId = user ? user.id : null;
    if (!changed && event !== 'INITIAL') return Promise.resolve();
    var chain = Promise.resolve();
    if (user && event === 'SIGNED_IN') {
      chain = chain.then(mergeGuestCart).then(mergeGuestWishlist).catch(function () {});
    }
    return chain
      .then(loadProfile)
      .then(function () { return Promise.all([refreshCart().catch(function () {}), loadWishlist().catch(function () {})]); })
      .then(function () { renderHeader(); emit('arumbu:auth', { user: user }); });
  }

  /* ---------- header (badges + panels) ---------- */
  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = n > 99 ? '99+' : String(n || 0);
    el.classList.toggle('has-items', n > 0);
  }
  function renderHeader() {
    setBadge('cartCount', state.cartCount);
    setBadge('wishlistCount', state.wishlist.length);

    var acc = document.getElementById('accountPanel');
    if (acc) {
      if (state.user) {
        var name = (state.profile && state.profile.full_name) || (state.user.user_metadata && state.user.user_metadata.full_name) || state.user.email;
        acc.innerHTML =
          '<h4>' + esc(fmt(t('account.hello', 'Hello, {name}'), { name: name })) + '</h4>' +
          '<p class="panel-sub">' + esc(state.user.email || '') + '</p>' +
          '<nav class="panel-links">' +
          '<a href="account.html">' + esc(t('account.nav.overview', 'My Account')) + '</a>' +
          '<a href="account.html#orders">' + esc(t('account.nav.orders', 'My Orders')) + '</a>' +
          '<a href="account.html#wishlist">' + esc(t('account.nav.wishlist', 'Wishlist')) + '</a>' +
          '<a href="account.html#addresses">' + esc(t('account.nav.addresses', 'Addresses')) + '</a>' +
          '</nav>' +
          '<button type="button" class="btn btn-outline action-panel-btn" data-store-logout>' + esc(t('account.logout', 'Log Out')) + '</button>';
      } else {
        acc.innerHTML =
          '<h4>' + esc(t('account.welcome', 'Welcome to Arumbu Cashews')) + '</h4>' +
          '<p>' + esc(t('account.descV2', 'Log in to track your orders, save addresses and keep your wishlist across devices.')) + '</p>' +
          '<a href="login.html" class="btn btn-gold-sm action-panel-btn">' + esc(t('account.login', 'Log In')) + '</a>' +
          '<a href="signup.html" class="btn btn-outline action-panel-btn">' + esc(t('account.signup', 'Create Account')) + '</a>';
      }
    }

    var cartPanel = document.getElementById('cartPanel');
    if (cartPanel) {
      var q = state.cartQuote;
      var items = (q && q.items) || [];
      if (!items.length) {
        cartPanel.innerHTML =
          '<h4>' + esc(t('cart.title', 'Your Cart')) + '</h4>' +
          '<p>' + esc(t('cart.empty', 'Your cart is empty. Browse our cashew grades and add what you need.')) + '</p>' +
          '<a href="products.html" class="btn btn-gold-sm action-panel-btn">' + esc(t('products.browse', 'Browse Products')) + '</a>';
      } else {
        var rows = items.slice(0, 4).map(function (i) {
          return '<li><span>' + esc(i.grade_name) + ' · ' + esc(i.pack_label) + ' × ' + esc(i.quantity) + '</span>' +
            '<span>' + (i.line_total != null ? esc(money(i.line_total)) : esc(t('store.priceOnRequest', 'Price on request'))) + '</span></li>';
        }).join('');
        var more = items.length > 4 ? '<li class="panel-more">' + esc(fmt(t('cart.more', '+{n} more'), { n: items.length - 4 })) + '</li>' : '';
        cartPanel.innerHTML =
          '<h4>' + esc(t('cart.title', 'Your Cart')) + '</h4>' +
          '<ul class="panel-lines">' + rows + more + '</ul>' +
          '<p class="panel-total"><span>' + esc(t('cart.subtotal', 'Subtotal')) + '</span><strong>' + esc(money(q.subtotal || 0)) + '</strong></p>' +
          '<a href="cart.html" class="btn btn-gold-sm action-panel-btn">' + esc(t('cart.view', 'View Cart')) + '</a>' +
          '<a href="checkout.html" class="btn btn-outline action-panel-btn">' + esc(t('cart.checkout', 'Checkout')) + '</a>';
      }
    }

    var wishPanel = document.getElementById('wishlistPanel');
    if (wishPanel) {
      var ids = state.wishlist;
      var products = (state.catalog || []).filter(function (p) { return ids.indexOf(p.id) !== -1; });
      if (!products.length) {
        wishPanel.innerHTML =
          '<h4>' + esc(t('wishlist.title', 'Your Wishlist')) + '</h4>' +
          '<p>' + esc(t('wishlist.empty', 'Save the grades you love here and come back to them anytime.')) + '</p>' +
          '<a href="products.html" class="btn btn-gold-sm action-panel-btn">' + esc(t('products.browse', 'Browse Products')) + '</a>';
      } else {
        wishPanel.innerHTML =
          '<h4>' + esc(t('wishlist.title', 'Your Wishlist')) + '</h4>' +
          '<ul class="panel-lines">' + products.slice(0, 5).map(function (p) {
            return '<li><a href="' + esc(productUrl(p)) + '">' + esc(p.grade_name) + ' — ' + esc(productName(p)) + '</a></li>';
          }).join('') + '</ul>' +
          '<a href="' + (state.user ? 'account.html#wishlist' : 'wishlist.html') + '" class="btn btn-gold-sm action-panel-btn">' + esc(t('wishlist.viewAll', 'View Wishlist')) + '</a>';
      }
    }
  }

  document.addEventListener('click', function (e) {
    var logout = e.target.closest && e.target.closest('[data-store-logout]');
    if (logout && client) { e.preventDefault(); auth.signOut(); }
  });
  document.addEventListener('arumbu:lang', function () { renderHeader(); });

  /* ---------- analytics (GA4, opt-in by configuration) ---------- */
  var gaReady = false;
  function initAnalytics() {
    var id = String(setting('ga_measurement_id', '') || '').trim();
    if (!/^G-[A-Z0-9]{4,}$/i.test(id) || gaReady) return;
    gaReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }
  // Never send names, emails, phones or addresses — only commerce events.
  function track(event, params) {
    if (gaReady && typeof window.gtag === 'function') {
      try { window.gtag('event', event, params || {}); } catch (e) {}
    }
  }

  /* ---------- public API ---------- */
  var readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });

  window.ArumbuStore = {
    client: client,
    env: window.ARUMBU_ENV || 'test',
    ready: ready,
    state: state,
    t: t, fmt: fmt, esc: esc, money: money, lang: lang, isUuid: isUuid, toast: toast, errorText: errorText,
    setting: setting, whatsappUrl: whatsappUrl, whatsappNumber: whatsappNumber, storageUrl: storageUrl,
    loadCatalog: loadCatalog, productName: productName, productUrl: productUrl, findVariant: findVariant,
    variantUnitPrice: variantUnitPrice, variantStatus: variantStatus, priceHtml: priceHtml, staticImages: STATIC_IMAGES,
    recent: recent, pushRecent: pushRecent, summaryRows: summaryRows,
    cart: { add: cartAdd, set: cartSet, clear: cartClear, refresh: refreshCart, guestItems: guestCart, whatsappText: cartWhatsappText },
    wishlist: { has: inWishlist, toggle: toggleWishlist, load: loadWishlist, ids: function () { return state.wishlist.slice(); } },
    auth: auth,
    user: function () { return state.user; },
    profile: function () { return state.profile; },
    reloadProfile: loadProfile,
    track: track,
    renderHeader: renderHeader
  };

  /* ---------- boot ---------- */
  function boot() {
    renderHeader();
    if (!client) { readyResolve(); emit('arumbu:ready'); return; }
    Promise.all([loadSettings().then(function () { initAnalytics(); applySocial(); }), loadContentBlocks(), loadCatalog()])
      .then(function () { return client.auth.getSession(); })
      .then(function (res) { return onSession(res && res.data && res.data.session, 'INITIAL'); })
      .catch(function () {})
      .then(function () {
        client.auth.onAuthStateChange(function (event, session) {
          if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            setTimeout(function () { onSession(session, event); }, 0);
          }
          if (event === 'PASSWORD_RECOVERY') emit('arumbu:recovery', {});
        });
        readyResolve();
        emit('arumbu:ready');
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
