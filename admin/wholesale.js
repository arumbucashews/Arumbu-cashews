/* Arumbu Cashews — Admin Wholesale Enquiries CMS
   ---------------------------------------------------------------
   Real read/update/delete against public.wholesale_enquiries.
   The public site keeps inserting into this table exactly as
   before (RLS policy "wholesale_public_insert" is untouched) —
   this file only ever reads and updates as an authenticated admin.

   Reuses the same authenticated Supabase client via
   window.ArumbuAdminAuth. */

(function () {
  'use strict';

  var STATUS_OPTIONS = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'converted', label: 'Converted' },
    { value: 'closed', label: 'Closed' }
  ];
  var STATUS_LABEL = STATUS_OPTIONS.reduce(function (acc, o) { acc[o.value] = o.label; return acc; }, {});

  var root = document.getElementById('wholesaleRoot');
  if (!root) { return; }

  var state = { enquiries: null, loading: true, error: null, filter: 'all' };
  var modalOverlay = null;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------

  function render() {
    if (state.loading) {
      root.innerHTML = '<div class="products-message">Loading enquiries…</div>';
      return;
    }
    if (state.error) {
      root.innerHTML =
        '<div class="products-message is-error">' + escapeHtml(state.error) +
        '<br><button type="button" class="retry-btn" id="wholesaleRetryBtn">Try again</button></div>';
      var retryBtn = document.getElementById('wholesaleRetryBtn');
      if (retryBtn) { retryBtn.addEventListener('click', loadEnquiries); }
      return;
    }

    var all = state.enquiries || [];
    var filtered = state.filter === 'all' ? all : all.filter(function (e) { return e.status === state.filter; });

    var pillsHtml = '<div class="status-filter-pills">' +
      ['all'].concat(STATUS_OPTIONS.map(function (o) { return o.value; })).map(function (val) {
        var label = val === 'all' ? 'All (' + all.length + ')' : STATUS_LABEL[val] + ' (' + all.filter(function (e) { return e.status === val; }).length + ')';
        return '<button type="button" class="status-filter-pill' + (state.filter === val ? ' is-active' : '') + '" data-filter="' + val + '">' + label + '</button>';
      }).join('') +
      '</div>';

    if (all.length === 0) {
      root.innerHTML = '<div class="products-message">No wholesale enquiries yet. New submissions from the public wholesale form will appear here.</div>';
      return;
    }

    if (filtered.length === 0) {
      root.innerHTML = pillsHtml + '<div class="products-message">No enquiries with this status.</div>';
      wirePills();
      return;
    }

    var rowsHtml = filtered.map(renderRow).join('');
    root.innerHTML = pillsHtml +
      '<div class="admin-table-wrap"><table class="admin-table">' +
        '<thead><tr>' +
          '<th>Name</th><th>Grade / Qty</th><th>Contact</th><th>Status</th><th>Received</th><th></th>' +
        '</tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table></div>';

    wirePills();
    wireRows();
  }

  function renderRow(e) {
    return (
      '<tr data-id="' + e.id + '">' +
        '<td>' + escapeHtml(e.name) + (e.company ? '<br><span class="cell-muted">' + escapeHtml(e.company) + '</span>' : '') + '</td>' +
        '<td>' + escapeHtml(e.grade_requested || '—') + (e.quantity ? '<br><span class="cell-muted">' + escapeHtml(e.quantity) + '</span>' : '') + '</td>' +
        '<td>' + escapeHtml(e.phone) + (e.email ? '<br><span class="cell-muted">' + escapeHtml(e.email) + '</span>' : '') + '</td>' +
        '<td><span class="product-status-pill" data-status="' + statusPillTone(e.status) + '">' + STATUS_LABEL[e.status] + '</span></td>' +
        '<td class="cell-muted">' + formatDate(e.created_at) + '</td>' +
        '<td class="cell-actions"><button type="button" class="product-form-cancel enquiry-view-btn" style="padding:0.4rem 0.9rem; font-size:0.8rem;">View</button></td>' +
      '</tr>'
    );
  }

  function statusPillTone(status) {
    if (status === 'converted') { return 'active'; }
    if (status === 'new') { return 'draft'; }
    if (status === 'closed') { return 'hidden'; }
    return 'out_of_stock';
  }

  function wirePills() {
    root.querySelectorAll('.status-filter-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-filter');
        render();
      });
    });
  }

  function wireRows() {
    root.querySelectorAll('.enquiry-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('tr').getAttribute('data-id');
        var enquiry = (state.enquiries || []).find(function (e) { return e.id === id; });
        if (enquiry) { openDetailModal(enquiry); }
      });
    });
  }

  // ---------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------

  function loadEnquiries() {
    state.loading = true;
    state.error = null;
    render();

    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('wholesale_enquiries')
      .select('id, name, company, phone, whatsapp, email, location, grade_requested, quantity, message, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .then(function (res) {
        state.loading = false;
        if (res.error) {
          state.error = 'Could not load enquiries: ' + res.error.message;
          state.enquiries = null;
        } else {
          state.enquiries = res.data || [];
        }
        render();
      });
  }

  // ---------------------------------------------------------------
  // Detail modal
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

  function openDetailModal(e) {
    var statusOptionsHtml = STATUS_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (e.status === o.value ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var html =
      '<div class="admin-modal" role="dialog" aria-modal="true">' +
        '<div class="admin-modal-head">' +
          '<h2>' + escapeHtml(e.name) + '</h2>' +
          '<button type="button" class="admin-modal-close" id="eqCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="enquiry-detail">' +
          '<dl>' +
            '<dt>Company</dt><dd>' + escapeHtml(e.company || '—') + '</dd>' +
            '<dt>Phone</dt><dd>' + escapeHtml(e.phone) + '</dd>' +
            '<dt>WhatsApp</dt><dd>' + escapeHtml(e.whatsapp || '—') + '</dd>' +
            '<dt>Email</dt><dd>' + escapeHtml(e.email || '—') + '</dd>' +
            '<dt>Location</dt><dd>' + escapeHtml(e.location || '—') + '</dd>' +
            '<dt>Grade requested</dt><dd>' + escapeHtml(e.grade_requested || '—') + '</dd>' +
            '<dt>Quantity</dt><dd>' + escapeHtml(e.quantity || '—') + '</dd>' +
            '<dt>Received</dt><dd>' + formatDate(e.created_at) + '</dd>' +
          '</dl>' +
          (e.message ? '<div class="message-box">' + escapeHtml(e.message) + '</div>' : '') +
          '<p class="product-form-error" id="eqFormError"></p>' +
          '<div class="product-form-grid">' +
            '<div class="form-field">' +
              '<label for="eqStatus">Status</label>' +
              '<select id="eqStatus">' + statusOptionsHtml + '</select>' +
            '</div>' +
            '<div class="product-form-actions" style="grid-column: 1 / -1;">' +
              '<button type="button" class="product-icon-btn is-danger" id="eqDeleteBtn" title="Delete enquiry" aria-label="Delete" style="width:auto; padding:0.6rem 1rem;">Delete</button>' +
              '<button type="button" class="product-form-cancel" id="eqCancelBtn">Close</button>' +
              '<button type="button" class="product-form-submit" id="eqSaveBtn">Save Status</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    openModal(html);
    document.getElementById('eqCloseBtn').addEventListener('click', closeModal);
    document.getElementById('eqCancelBtn').addEventListener('click', closeModal);
    document.getElementById('eqSaveBtn').addEventListener('click', function () { saveStatus(e); });
    document.getElementById('eqDeleteBtn').addEventListener('click', function () { confirmDelete(e); });
  }

  function saveStatus(e) {
    var select = document.getElementById('eqStatus');
    var saveBtn = document.getElementById('eqSaveBtn');
    var errorEl = document.getElementById('eqFormError');
    var newStatus = select.value;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    var client = window.ArumbuAdminAuth.getClient();
    client.from('wholesale_enquiries').update({ status: newStatus }).eq('id', e.id).then(function (res) {
      if (res.error) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Status';
        errorEl.textContent = res.error.message || 'Could not save. Please try again.';
        errorEl.classList.add('is-visible');
        return;
      }
      closeModal();
      loadEnquiries();
    });
  }

  function confirmDelete(e) {
    var confirmed = window.confirm('Delete this enquiry from ' + e.name + '? This cannot be undone.');
    if (!confirmed) { return; }

    var client = window.ArumbuAdminAuth.getClient();
    client.from('wholesale_enquiries').delete().eq('id', e.id).then(function (res) {
      if (res.error) {
        alert('Could not delete: ' + res.error.message);
        return;
      }
      closeModal();
      loadEnquiries();
    });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------

  async function init() {
    try {
      var result = await window.ArumbuAdminAuth.getAuthorisedSession();
      if (!result.session || !result.profile) { return; }
      loadEnquiries();
    } catch (err) {
      state.loading = false;
      state.error = err.message || 'Could not connect to Supabase.';
      render();
    }
  }

  init();
})();
