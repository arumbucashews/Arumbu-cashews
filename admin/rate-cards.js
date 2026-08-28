/* Arumbu Cashews — Admin Rate Cards CMS
   ---------------------------------------------------------------
   Real CRUD against public.rate_cards (one row per product, unique
   on product_id) and public.rate_card_history (an append-only audit
   log this file writes to on every rate/unit change — the schema
   ships the table but no auto-insert trigger, so the CMS is
   responsible for it, per the comment in 0001_init_schema.sql).

   Reuses the same authenticated Supabase client as products.js via
   window.ArumbuAdminAuth — never touches the auth/session guard
   logic itself. */

(function () {
  'use strict';

  var AVAILABILITY_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'out_of_stock', label: 'Out of stock' },
    { value: 'seasonal', label: 'Seasonal' }
  ];
  var AVAILABILITY_LABEL = AVAILABILITY_OPTIONS.reduce(function (acc, o) { acc[o.value] = o.label; return acc; }, {});

  var root = document.getElementById('rateCardsRoot');
  if (!root) { return; }

  var state = { rows: null, loading: true, error: null, currentUserId: null };
  var modalOverlay = null;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatRate(rate, unit) {
    if (rate === null || rate === undefined) { return 'Not set'; }
    var num = Number(rate);
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / ' + escapeHtml(unit || 'Kg');
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------

  function render() {
    if (state.loading) {
      root.innerHTML = '<div class="products-message">Loading rate cards…</div>';
      return;
    }
    if (state.error) {
      root.innerHTML =
        '<div class="products-message is-error">' + escapeHtml(state.error) +
        '<br><button type="button" class="retry-btn" id="rateCardsRetryBtn">Try again</button></div>';
      var retryBtn = document.getElementById('rateCardsRetryBtn');
      if (retryBtn) { retryBtn.addEventListener('click', loadRateCards); }
      return;
    }

    var rows = state.rows || [];

    if (rows.length === 0) {
      root.innerHTML = '<div class="products-message">No products yet. Add products first, then set their pricing here.</div>';
      return;
    }

    var toolbarHtml =
      '<div class="products-toolbar">' +
        '<span class="products-count">' + rows.length + ' product' + (rows.length === 1 ? '' : 's') + '</span>' +
      '</div>';

    var cardsHtml = rows.map(renderCard).join('');
    root.innerHTML = toolbarHtml + '<div class="products-grid">' + cardsHtml + '</div>';
    wireCards();
  }

  function renderCard(row) {
    var rc = row.rate_card;
    var availability = rc ? rc.availability : 'available';
    var isVisible = rc ? rc.is_visible : false;
    return (
      '<article class="product-card" data-product-id="' + row.id + '">' +
        '<div class="product-card-head">' +
          '<h3>' + escapeHtml(row.grade_name) + '</h3>' +
          '<span class="product-status-pill" data-status="' + (availability === 'available' ? 'active' : (availability === 'seasonal' ? 'draft' : 'out_of_stock')) + '">' +
            AVAILABILITY_LABEL[availability] +
          '</span>' +
        '</div>' +
        '<p class="product-card-desc">' + formatRate(rc ? rc.rate : null, rc ? rc.unit : 'Kg') + '</p>' +
        '<div class="product-card-meta">' +
          '<span>' + (isVisible ? 'Visible to admin panel viewers' : 'Hidden') + '</span>' +
        '</div>' +
        '<div class="product-card-footer">' +
          '<button type="button" class="product-form-cancel rate-history-btn" style="padding:0.5rem 0.9rem; font-size:0.8rem;">History</button>' +
          '<div class="product-card-actions">' +
            '<button type="button" class="products-add-btn rate-edit-btn" style="padding:0.5rem 1rem; font-size:0.82rem;">' +
              (rc ? 'Edit' : 'Set Price') +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function wireCards() {
    root.querySelectorAll('.product-card').forEach(function (card) {
      var productId = card.getAttribute('data-product-id');
      var row = (state.rows || []).find(function (r) { return r.id === productId; });
      if (!row) { return; }

      var editBtn = card.querySelector('.rate-edit-btn');
      if (editBtn) { editBtn.addEventListener('click', function () { openFormModal(row); }); }

      var historyBtn = card.querySelector('.rate-history-btn');
      if (historyBtn) { historyBtn.addEventListener('click', function () { openHistoryModal(row); }); }
    });
  }

  // ---------------------------------------------------------------
  // Data loading — products joined with their (optional) rate card
  // ---------------------------------------------------------------

  function loadRateCards() {
    state.loading = true;
    state.error = null;
    render();

    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('products')
      .select('id, grade_name, display_order, rate_cards(id, rate, unit, availability, is_visible, effective_date, updated_at)')
      .order('display_order', { ascending: true })
      .then(function (res) {
        state.loading = false;
        if (res.error) {
          state.error = 'Could not load rate cards: ' + res.error.message;
          state.rows = null;
        } else {
          state.rows = (res.data || []).map(function (p) {
            var rc = Array.isArray(p.rate_cards) ? p.rate_cards[0] : p.rate_cards;
            return { id: p.id, grade_name: p.grade_name, display_order: p.display_order, rate_card: rc || null };
          });
        }
        render();
      });
  }

  // ---------------------------------------------------------------
  // Modal
  // ---------------------------------------------------------------

  function ensureModalOverlay() {
    if (modalOverlay) { return modalOverlay; }
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'admin-modal-overlay';
    modalOverlay.hidden = true;
    modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) { closeModal(); } });
    document.body.appendChild(modalOverlay);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modalOverlay.hidden) { closeModal(); } });
    return modalOverlay;
  }
  function openModal(html) { var o = ensureModalOverlay(); o.innerHTML = html; o.hidden = false; }
  function closeModal() { if (modalOverlay) { modalOverlay.hidden = true; modalOverlay.innerHTML = ''; } }

  function openFormModal(row) {
    var rc = row.rate_card || { rate: '', unit: 'Kg', availability: 'available', is_visible: false, effective_date: new Date().toISOString().slice(0, 10) };

    var availabilityOptionsHtml = AVAILABILITY_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (rc.availability === o.value ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var html =
      '<div class="admin-modal" role="dialog" aria-modal="true">' +
        '<div class="admin-modal-head">' +
          '<h2>' + escapeHtml(row.grade_name) + ' — Pricing</h2>' +
          '<button type="button" class="admin-modal-close" id="rcModalCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<p class="product-form-error" id="rcFormError"></p>' +
        '<form id="rcForm">' +
          '<div class="product-form-grid">' +
            '<div class="form-field">' +
              '<label for="rcRate">Rate (₹)</label>' +
              '<input type="number" id="rcRate" step="0.01" min="0" value="' + (rc.rate !== null && rc.rate !== undefined ? rc.rate : '') + '" placeholder="Leave blank if unset">' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="rcUnit">Unit</label>' +
              '<input type="text" id="rcUnit" value="' + escapeHtml(rc.unit || 'Kg') + '">' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="rcAvailability">Availability</label>' +
              '<select id="rcAvailability">' + availabilityOptionsHtml + '</select>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="rcEffectiveDate">Effective date</label>' +
              '<input type="date" id="rcEffectiveDate" value="' + escapeHtml(rc.effective_date || '') + '">' +
            '</div>' +
            '<div class="product-form-checks">' +
              '<label class="product-form-check"><input type="checkbox" id="rcVisible" ' + (rc.is_visible ? 'checked' : '') + '> Visible</label>' +
            '</div>' +
            '<div class="product-form-actions">' +
              '<button type="button" class="product-form-cancel" id="rcCancelBtn">Cancel</button>' +
              '<button type="submit" class="product-form-submit" id="rcSubmitBtn">Save</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    openModal(html);
    document.getElementById('rcModalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('rcCancelBtn').addEventListener('click', closeModal);
    document.getElementById('rcForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submitRateForm(row);
    });
  }

  function submitRateForm(row) {
    var errorEl = document.getElementById('rcFormError');
    var submitBtn = document.getElementById('rcSubmitBtn');
    errorEl.classList.remove('is-visible');
    errorEl.textContent = '';

    var rateRaw = document.getElementById('rcRate').value;
    var newRate = rateRaw === '' ? null : parseFloat(rateRaw);
    if (rateRaw !== '' && isNaN(newRate)) {
      errorEl.textContent = 'Rate must be a number.';
      errorEl.classList.add('is-visible');
      return;
    }
    var newUnit = document.getElementById('rcUnit').value.trim() || 'Kg';
    var newAvailability = document.getElementById('rcAvailability').value;
    var newVisible = document.getElementById('rcVisible').checked;
    var newEffectiveDate = document.getElementById('rcEffectiveDate').value || null;

    var oldRc = row.rate_card;
    var rateChanged = !oldRc || oldRc.rate !== newRate || oldRc.unit !== newUnit;

    var payload = {
      product_id: row.id,
      rate: newRate,
      unit: newUnit,
      availability: newAvailability,
      is_visible: newVisible,
      updated_by: state.currentUserId
    };
    if (newEffectiveDate) { payload.effective_date = newEffectiveDate; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    var client = window.ArumbuAdminAuth.getClient();
    var query = oldRc
      ? client.from('rate_cards').update(payload).eq('id', oldRc.id).select().single()
      : client.from('rate_cards').insert(payload).select().single();

    query.then(function (res) {
      if (res.error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
        errorEl.textContent = res.error.message || 'Something went wrong. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }

      var finish = function () {
        closeModal();
        loadRateCards();
      };

      if (rateChanged) {
        client.from('rate_card_history').insert({
          product_id: row.id,
          rate: newRate,
          unit: newUnit,
          changed_by: state.currentUserId
        }).then(finish);
      } else {
        finish();
      }
    });
  }

  // ---------------------------------------------------------------
  // History
  // ---------------------------------------------------------------

  function openHistoryModal(row) {
    var html =
      '<div class="admin-modal" role="dialog" aria-modal="true">' +
        '<div class="admin-modal-head">' +
          '<h2>' + escapeHtml(row.grade_name) + ' — Rate History</h2>' +
          '<button type="button" class="admin-modal-close" id="rcHistCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div id="rcHistBody"><div class="products-message">Loading…</div></div>' +
      '</div>';
    openModal(html);
    document.getElementById('rcHistCloseBtn').addEventListener('click', closeModal);

    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('rate_card_history')
      .select('rate, unit, changed_at, editor:profiles!changed_by(email)')
      .eq('product_id', row.id)
      .order('changed_at', { ascending: false })
      .limit(25)
      .then(function (res) {
        var body = document.getElementById('rcHistBody');
        if (!body) { return; }
        if (res.error) {
          body.innerHTML = '<div class="products-message is-error">' + escapeHtml(res.error.message) + '</div>';
          return;
        }
        var entries = res.data || [];
        if (entries.length === 0) {
          body.innerHTML = '<p class="rate-history-empty">No rate changes recorded yet.</p>';
          return;
        }
        body.innerHTML = '<ul class="rate-history-list">' + entries.map(function (h) {
          var when = new Date(h.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
          var who = h.editor && h.editor.email ? h.editor.email : 'Unknown';
          return '<li>' + formatRate(h.rate, h.unit) + '<span class="meta">' + escapeHtml(when) + ' — ' + escapeHtml(who) + '</span></li>';
        }).join('') + '</ul>';
      });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------

  async function init() {
    try {
      var result = await window.ArumbuAdminAuth.getAuthorisedSession();
      if (!result.session || !result.profile) { return; }
      state.currentUserId = result.profile.id;
      loadRateCards();
    } catch (err) {
      state.loading = false;
      state.error = err.message || 'Could not connect to Supabase.';
      render();
    }
  }

  init();
})();
