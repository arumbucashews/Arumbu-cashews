/* Arumbu Cashews — Admin: Pricing & Stock.
   Pack sizes (product_variants) carry the selling price — the single
   source of truth used by quote_items()/place_order(). A blank price
   means "price on request": the pack shows on the site but can only be
   ordered on WhatsApp. Stock is changed only through admin_set_stock(),
   which writes an inventory_movements row for every change. */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  var root = document.getElementById('inventoryRoot');
  if (!A || !root) return;
  var esc = A.esc;
  var state = { products: [], q: '', show: 'all' };

  function shell() {
    root.innerHTML =
      '<div class="admin-toolbar">' +
        '<input type="search" id="invSearch" placeholder="Search grade or SKU">' +
        '<select id="invShow"><option value="all">All packs</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="noprice">No price set</option><option value="inactive">Hidden packs</option></select>' +
        '<button type="button" class="product-form-cancel" id="invCsv">Export CSV</button>' +
        '<button type="button" class="product-form-cancel" id="invRefresh">Refresh</button>' +
      '</div>' +
      '<p class="cell-muted admin-help">Enter prices in ₹ per pack. Leave the price empty to show “Price on request” (WhatsApp ordering only). Sale price must be lower than the price. Packs with stock 0 cannot be ordered online.</p>' +
      '<div id="invTable"><div class="products-message">Loading…</div></div>';
    var t;
    document.getElementById('invSearch').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { state.q = v; render(); }, 150); });
    document.getElementById('invShow').addEventListener('change', function () { state.show = this.value; render(); });
    document.getElementById('invRefresh').addEventListener('click', load);
    document.getElementById('invCsv').addEventListener('click', exportCsv);
  }

  function rows() {
    var out = [];
    state.products.forEach(function (p) {
      (p.product_variants || []).slice().sort(function (a, b) { return a.weight_grams - b.weight_grams; }).forEach(function (v) {
        out.push({ p: p, v: v, inv: v.inventory || { stock_qty: 0, low_stock_threshold: 0, track_stock: true } });
      });
    });
    var q = state.q.trim().toLowerCase();
    return out.filter(function (r) {
      if (q && [r.p.grade_name, r.p.full_name, r.v.sku].join(' ').toLowerCase().indexOf(q) === -1) return false;
      if (state.show === 'low' && !(r.inv.track_stock && r.inv.stock_qty > 0 && r.inv.stock_qty <= r.inv.low_stock_threshold)) return false;
      if (state.show === 'out' && !(r.inv.track_stock && r.inv.stock_qty <= 0)) return false;
      if (state.show === 'noprice' && r.v.price != null) return false;
      if (state.show === 'inactive' && r.v.is_active) return false;
      return true;
    });
  }

  function num(v) { return v == null ? '' : String(Number(v)); }

  function render() {
    var box = document.getElementById('invTable');
    if (!box) return;
    var list = rows();
    var html = '<div class="admin-table-wrap"><table class="admin-table inv-table"><thead><tr><th>Grade</th><th>Pack</th><th>SKU</th><th>Price ₹</th><th>Sale ₹</th><th>Online</th><th>Stock</th><th>Alert at</th><th></th></tr></thead><tbody>';
    var lastProduct = null;
    list.forEach(function (r) {
      var low = r.inv.track_stock && r.inv.stock_qty <= r.inv.low_stock_threshold;
      var out = r.inv.track_stock && r.inv.stock_qty <= 0;
      html += '<tr data-v="' + esc(r.v.id) + '"' + (out ? ' class="row-out"' : low ? ' class="row-low"' : '') + '>' +
        '<td>' + (lastProduct !== r.p.id ? '<strong>' + esc(r.p.grade_name) + '</strong><div class="cell-muted">' + esc(r.p.full_name || '') + (r.p.is_published ? '' : ' · unpublished') + '</div>' : '') + '</td>' +
        '<td>' + esc(r.v.pack_label) + '<div class="cell-muted">' + esc(r.v.weight_grams) + ' g</div></td>' +
        '<td><input class="inv-input" data-f="sku" value="' + esc(r.v.sku || '') + '" maxlength="40" aria-label="SKU"></td>' +
        '<td><input class="inv-input inv-num" data-f="price" type="number" min="0" step="0.01" value="' + num(r.v.price) + '" placeholder="On request" aria-label="Price"></td>' +
        '<td><input class="inv-input inv-num" data-f="sale_price" type="number" min="0" step="0.01" value="' + num(r.v.sale_price) + '" aria-label="Sale price"></td>' +
        '<td><label class="product-toggle"><input type="checkbox" data-f="is_active"' + (r.v.is_active ? ' checked' : '') + '><span class="switch"></span></label></td>' +
        '<td><strong>' + (r.inv.track_stock ? esc(r.inv.stock_qty) : '∞') + '</strong>' + (out ? ' <span class="product-status-pill" data-status="out_of_stock">Out</span>' : low ? ' <span class="product-status-pill" data-status="out_of_stock">Low</span>' : '') + '</td>' +
        '<td class="cell-muted">' + esc(r.inv.low_stock_threshold) + '</td>' +
        '<td class="cell-actions"><button type="button" class="product-form-cancel" data-act="save">Save</button> <button type="button" class="product-form-cancel" data-act="stock">Stock</button> <button type="button" class="product-form-cancel" data-act="history">History</button></td></tr>';
      lastProduct = r.p.id;
    });
    html += '</tbody></table></div>';
    if (!list.length) html = '<div class="products-message">No packs match.</div>';
    html += '<div class="content-card" style="margin-top:1.2rem"><h3>Add a pack size</h3><div class="admin-toolbar">' +
      '<select id="addVarProduct">' + state.products.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.grade_name) + '</option>'; }).join('') + '</select>' +
      '<input id="addVarLabel" placeholder="Label, e.g. 2 kg" maxlength="20"><input id="addVarGrams" type="number" min="1" placeholder="Weight in grams">' +
      '<button type="button" class="product-form-submit" id="addVarBtn">Add pack</button></div></div>';
    box.innerHTML = html;
    box.querySelectorAll('tr[data-v]').forEach(function (tr) {
      tr.querySelector('[data-act="save"]').addEventListener('click', function () { saveRow(tr, this); });
      tr.querySelector('[data-act="stock"]').addEventListener('click', function () { stockModal(tr.getAttribute('data-v')); });
      tr.querySelector('[data-act="history"]').addEventListener('click', function () { history(tr.getAttribute('data-v')); });
    });
    var add = document.getElementById('addVarBtn');
    if (add) add.addEventListener('click', addVariant);
  }

  function find(id) {
    var hit = null;
    state.products.forEach(function (p) { (p.product_variants || []).forEach(function (v) { if (v.id === id) hit = { p: p, v: v }; }); });
    return hit;
  }

  function saveRow(tr, btn) {
    var get = function (f) { return tr.querySelector('[data-f="' + f + '"]'); };
    var price = get('price').value === '' ? null : Number(get('price').value);
    var sale = get('sale_price').value === '' ? null : Number(get('sale_price').value);
    if ((price != null && (isNaN(price) || price < 0)) || (sale != null && (isNaN(sale) || sale < 0))) return A.toast('Prices must be 0 or more.', true);
    if (sale != null && (price == null || sale >= price)) return A.toast('Sale price must be lower than the price.', true);
    btn.disabled = true;
    A.client().from('product_variants').update({
      sku: get('sku').value.trim() || null, price: price, sale_price: sale, is_active: get('is_active').checked
    }).eq('id', tr.getAttribute('data-v')).then(function (res) {
      btn.disabled = false;
      if (res.error) return A.toast(/duplicate|unique/i.test(res.error.message) ? 'That SKU is already used.' : A.errMsg(res.error), true);
      A.toast('Saved');
      load();
    });
  }

  function stockModal(id) {
    var hit = find(id);
    var inv = hit.v.inventory || { stock_qty: 0, low_stock_threshold: 0, track_stock: true };
    var m = A.modal({ title: 'Stock — ' + hit.p.grade_name + ' ' + hit.v.pack_label, body:
      '<p class="product-form-error" id="stErr"></p>' +
      '<div class="product-form-grid">' +
        '<div class="form-field"><label for="stQty">Packs in stock</label><input id="stQty" type="number" min="0" step="1" value="' + esc(inv.stock_qty) + '"></div>' +
        '<div class="form-field"><label for="stLow">Low-stock alert at</label><input id="stLow" type="number" min="0" step="1" value="' + esc(inv.low_stock_threshold) + '"></div>' +
        '<div class="form-field"><label for="stReason">Reason</label><select id="stReason"><option value="restock">Restock</option><option value="adjustment">Adjustment / count</option><option value="return">Customer return</option><option value="initial">Opening stock</option></select></div>' +
        '<div class="form-field"><label class="product-form-check" style="margin-top:1.8rem"><input type="checkbox" id="stTrack"' + (inv.track_stock ? ' checked' : '') + '> Track stock</label></div>' +
        '<div class="form-field form-field-full"><label for="stNote">Note</label><input id="stNote" maxlength="300" placeholder="e.g. Batch received"></div>' +
        '<div class="product-form-actions"><button type="button" class="product-form-cancel" data-close>Cancel</button><button type="button" class="product-form-submit" id="stSave">Save stock</button></div>' +
      '</div>' });
    m.querySelector('#stSave').addEventListener('click', function () {
      var qty = parseInt(m.querySelector('#stQty').value, 10), low = parseInt(m.querySelector('#stLow').value, 10);
      var err = m.querySelector('#stErr');
      if (isNaN(qty) || qty < 0 || isNaN(low) || low < 0) { err.textContent = 'Use whole numbers of 0 or more.'; err.classList.add('is-visible'); return; }
      this.disabled = true;
      A.client().rpc('admin_set_stock', { p_variant_id: id, p_stock_qty: qty, p_reason: m.querySelector('#stReason').value,
        p_note: m.querySelector('#stNote').value || null, p_low_stock_threshold: low, p_track_stock: m.querySelector('#stTrack').checked })
        .then(function (res) {
          if (res.error) { err.textContent = A.errMsg(res.error); err.classList.add('is-visible'); m.querySelector('#stSave').disabled = false; return; }
          A.closeModal(); A.toast('Stock updated'); load();
        });
    });
  }

  function history(id) {
    var hit = find(id);
    A.modal({ title: 'Stock history — ' + hit.p.grade_name + ' ' + hit.v.pack_label, body: '<div class="products-message">Loading…</div>' });
    A.client().from('inventory_movements').select('*').eq('variant_id', id).order('created_at', { ascending: false }).limit(200).then(function (res) {
      var list = res.data || [];
      A.modal({ title: 'Stock history — ' + hit.p.grade_name + ' ' + hit.v.pack_label, body: list.length
        ? '<div class="admin-table-wrap"><table class="admin-table" style="min-width:0"><thead><tr><th>When</th><th>Change</th><th>After</th><th>Reason</th><th>Note</th></tr></thead><tbody>' +
          list.map(function (mv) { return '<tr><td class="cell-muted">' + esc(A.date(mv.created_at, true)) + '</td><td>' + (mv.change > 0 ? '+' : '') + esc(mv.change) + '</td><td>' + esc(mv.stock_after) + '</td><td>' + esc(A.label(mv.reason)) + '</td><td class="cell-muted">' + esc(mv.note || '') + '</td></tr>'; }).join('') +
          '</tbody></table></div>'
        : '<p class="rate-history-empty">No stock movements yet.</p>' });
    });
  }

  function addVariant() {
    var pid = document.getElementById('addVarProduct').value;
    var label = document.getElementById('addVarLabel').value.trim();
    var grams = parseInt(document.getElementById('addVarGrams').value, 10);
    if (!label || !(grams > 0)) return A.toast('Enter a label and a weight in grams.', true);
    var p = state.products.filter(function (x) { return x.id === pid; })[0];
    A.client().from('product_variants').insert({ product_id: pid, pack_label: label, weight_grams: grams, price: null, is_active: true,
      display_order: (p.product_variants || []).length + 1 }).then(function (res) {
      if (res.error) return A.toast(/duplicate|unique/i.test(res.error.message) ? 'That pack size already exists for this grade.' : A.errMsg(res.error), true);
      A.toast('Pack added — set its price and stock.');
      load();
    });
  }

  function exportCsv() {
    var out = [['Grade', 'Name', 'Pack', 'Grams', 'SKU', 'Price', 'Sale price', 'Online', 'Stock', 'Alert at', 'Tracked']];
    rows().forEach(function (r) { out.push([r.p.grade_name, r.p.full_name, r.v.pack_label, r.v.weight_grams, r.v.sku, r.v.price, r.v.sale_price, r.v.is_active, r.inv.stock_qty, r.inv.low_stock_threshold, r.inv.track_stock]); });
    A.downloadCsv('arumbu-stock-' + new Date().toISOString().slice(0, 10) + '.csv', out);
  }

  function load() {
    return A.client().from('products')
      .select('id, grade_name, full_name, is_published, display_order, product_variants(id, pack_label, weight_grams, sku, price, sale_price, is_active, in_stock, display_order, inventory(stock_qty, low_stock_threshold, track_stock))')
      .order('display_order').then(function (res) {
        var box = document.getElementById('invTable');
        if (res.error) { if (box) box.innerHTML = '<div class="products-message is-error">' + esc(A.errMsg(res.error)) + '</div>'; return; }
        state.products = (res.data || []).map(function (p) {
          p.product_variants = (p.product_variants || []).map(function (v) {
            if (Array.isArray(v.inventory)) v.inventory = v.inventory[0] || null;
            return v;
          });
          return p;
        });
        render();
      });
  }

  var started = false;
  A.onSection('inventory', function () { if (!started) { started = true; shell(); } load(); });
})();
