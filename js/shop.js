/* Arumbu Cashews — products page: database-driven grid with search,
   availability filter and sort. The static cards in products.html stay
   on screen if the catalogue can't be loaded. */
(function () {
  'use strict';
  var S = window.ArumbuStore, C = window.ArumbuCards;
  if (!S || !C) return;

  var grid = document.getElementById('shopGrid');
  var search = document.getElementById('shopSearch');
  var avail = document.getElementById('shopAvailability');
  var sort = document.getElementById('shopSort');
  var count = document.getElementById('shopCount');
  var empty = document.getElementById('shopEmpty');
  var reset = document.getElementById('shopReset');
  var products = null;

  // Restore filters from the URL (?q=&show=&sort=) so results are linkable.
  var params = new URLSearchParams(window.location.search);
  if (params.get('q')) search.value = params.get('q');
  if (params.get('show')) avail.value = params.get('show');
  if (params.get('sort')) sort.value = params.get('sort');

  function minPrice(p) {
    var prices = (p.variants || []).map(S.variantUnitPrice).filter(function (x) { return x != null; });
    return prices.length ? Math.min.apply(null, prices) : null;
  }
  function hasBuyable(p) { return (p.variants || []).some(function (v) { return S.variantStatus(v) === 'available'; }); }
  function inStock(p) { return (p.variants || []).some(function (v) { return v.in_stock; }); }

  function apply() {
    if (!products) return;
    var q = (search.value || '').trim().toLowerCase();
    var list = products.filter(function (p) {
      if (q) {
        var hay = [p.grade_name, p.full_name, p.full_name_ta, S.t('grade.' + p.grade_name, '')].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (avail.value === 'buy' && !hasBuyable(p)) return false;
      if (avail.value === 'instock' && !inStock(p)) return false;
      return true;
    });
    var by = sort.value;
    list = list.slice().sort(function (a, b) {
      if (by === 'price_asc' || by === 'price_desc') {
        var pa = minPrice(a), pb = minPrice(b);
        if (pa == null && pb == null) return a.display_order - b.display_order;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return by === 'price_asc' ? pa - pb : pb - pa;
      }
      if (by === 'code') return a.grade_name.localeCompare(b.grade_name);
      if (by === 'newest') return String(b.created_at).localeCompare(String(a.created_at)) || a.display_order - b.display_order;
      return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || a.display_order - b.display_order;
    });
    C.renderInto(grid, list);
    empty.hidden = list.length > 0;
    count.textContent = S.fmt(S.t('shop.count', 'Showing {n} of {total} grades'), { n: list.length, total: products.length });

    var qs = new URLSearchParams();
    if (q) qs.set('q', search.value.trim());
    if (avail.value !== 'all') qs.set('show', avail.value);
    if (sort.value !== 'featured') qs.set('sort', sort.value);
    var next = window.location.pathname + (qs.toString() ? '?' + qs : '');
    try { window.history.replaceState(null, '', next); } catch (e) {}
  }

  var timer;
  search.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(apply, 150); });
  avail.addEventListener('change', apply);
  sort.addEventListener('change', apply);
  reset.addEventListener('click', function () { search.value = ''; avail.value = 'all'; sort.value = 'featured'; apply(); });
  document.addEventListener('arumbu:lang', apply);

  function renderRecent() {
    var ids = S.recent();
    var sec = document.getElementById('recentSection');
    var list = ids.map(function (id) { return (products || []).filter(function (p) { return p.id === id; })[0]; }).filter(Boolean).slice(0, 4);
    if (!list.length) { sec.hidden = true; return; }
    C.renderInto(document.getElementById('recentGrid'), list, { headingLevel: 3 });
    sec.hidden = false;
  }

  S.loadCatalog().then(function (list) {
    if (!list || !list.length) return; // keep static fallback cards
    products = list;
    apply();
    renderRecent();
    S.track('view_item_list', { item_list_name: 'All grades' });
  });
})();
