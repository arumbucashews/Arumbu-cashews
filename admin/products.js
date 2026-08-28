/* Arumbu Cashews — Admin Products CMS
   ---------------------------------------------------------------
   Real CRUD against public.products, using the same authenticated
   Supabase client created by admin-auth.js (window.ArumbuAdminAuth).

   This file is fully independent of the auth/session guard in
   dashboard.html — it never touches ArumbuAdminAuth.getAuthorisedSession
   internals or the logout logic, it only calls the public functions
   admin-auth.js already exposes.

   Schema used (supabase/migrations/0001_init_schema.sql):
     public.products (
       id, grade_name, slug, short_description, full_description,
       status ('active'|'hidden'|'out_of_stock'|'draft'),
       is_featured, is_published, display_order,
       created_at, updated_at
     )
   RLS (0002_rls_policies.sql): "products_admin_all" — authenticated
   users where public.is_admin() get full SELECT/INSERT/UPDATE/DELETE.
   grade_name is unique (case-insensitive) at the database level. */

(function () {
  'use strict';

  var STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'out_of_stock', label: 'Out of stock' },
    { value: 'draft', label: 'Draft' }
  ];
  var STATUS_LABEL = STATUS_OPTIONS.reduce(function (acc, o) { acc[o.value] = o.label; return acc; }, {});

  var root = document.getElementById('productsRoot');
  if (!root) { return; } // Products section isn't on this page — nothing to do.

  var state = {
    products: null,   // null = not loaded yet; [] = loaded, empty
    loading: true,
    error: null
  };

  var modalOverlay = null; // created lazily, appended to <body>

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function render() {
    if (state.loading) {
      root.innerHTML = '<div class="products-message">Loading products…</div>';
      return;
    }

    if (state.error) {
      root.innerHTML =
        '<div class="products-message is-error">' +
          escapeHtml(state.error) +
          '<br><button type="button" class="retry-btn" id="productsRetryBtn">Try again</button>' +
        '</div>';
      var retryBtn = document.getElementById('productsRetryBtn');
      if (retryBtn) { retryBtn.addEventListener('click', loadProducts); }
      return;
    }

    var products = state.products || [];

    var toolbarHtml =
      '<div class="products-toolbar">' +
        '<span class="products-count">' +
          (products.length === 0 ? 'No products yet' : products.length + ' product' + (products.length === 1 ? '' : 's')) +
        '</span>' +
        '<button type="button" class="products-add-btn" id="productAddBtn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>' +
          'Add Product' +
        '</button>' +
      '</div>';

    if (products.length === 0) {
      root.innerHTML =
        toolbarHtml +
        '<div class="products-message">No products yet. Add your first cashew grade to get started.</div>';
      wireToolbar();
      return;
    }

    var cardsHtml = products.map(renderCard).join('');
    root.innerHTML = toolbarHtml + '<div class="products-grid">' + cardsHtml + '</div>';
    wireToolbar();
    wireCards();
  }

  function renderCard(p) {
    var desc = p.short_description ? escapeHtml(p.short_description) : '<em>No description yet.</em>';
    return (
      '<article class="product-card" data-id="' + p.id + '">' +
        '<div class="product-card-head">' +
          '<h3>' + escapeHtml(p.grade_name) + '</h3>' +
          '<span class="product-status-pill" data-status="' + p.status + '">' + (STATUS_LABEL[p.status] || p.status) + '</span>' +
        '</div>' +
        '<p class="product-card-desc">' + desc + '</p>' +
        '<div class="product-card-meta">' +
          '<span>Order: ' + p.display_order + '</span>' +
          (p.is_featured ? '<span class="featured">★ Featured</span>' : '') +
        '</div>' +
        '<div class="product-card-footer">' +
          '<label class="product-toggle">' +
            '<input type="checkbox" class="product-publish-toggle" ' + (p.is_published ? 'checked' : '') + '>' +
            '<span class="switch"></span>' +
            (p.is_published ? 'Published' : 'Unpublished') +
          '</label>' +
          '<div class="product-card-actions">' +
            '<button type="button" class="product-icon-btn product-edit-btn" title="Edit" aria-label="Edit">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' +
            '</button>' +
            '<button type="button" class="product-icon-btn is-danger product-delete-btn" title="Delete" aria-label="Delete">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function wireToolbar() {
    var addBtn = document.getElementById('productAddBtn');
    if (addBtn) { addBtn.addEventListener('click', function () { openFormModal(null); }); }
  }

  function wireCards() {
    root.querySelectorAll('.product-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var product = (state.products || []).find(function (p) { return p.id === id; });
      if (!product) { return; }

      var editBtn = card.querySelector('.product-edit-btn');
      if (editBtn) { editBtn.addEventListener('click', function () { openFormModal(product); }); }

      var deleteBtn = card.querySelector('.product-delete-btn');
      if (deleteBtn) { deleteBtn.addEventListener('click', function () { openDeleteConfirm(product); }); }

      var toggle = card.querySelector('.product-publish-toggle');
      if (toggle) {
        toggle.addEventListener('change', function () {
          togglePublish(product, toggle.checked, toggle, card);
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------

  function loadProducts() {
    state.loading = true;
    state.error = null;
    render();

    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('products')
      .select('id, grade_name, slug, short_description, full_description, status, is_featured, is_published, display_order')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        state.loading = false;
        if (res.error) {
          state.error = 'Could not load products: ' + res.error.message;
          state.products = null;
        } else {
          state.products = res.data || [];
        }
        render();
      });
  }

  // ---------------------------------------------------------------
  // Add / Edit modal
  // ---------------------------------------------------------------

  function ensureModalOverlay() {
    if (modalOverlay) { return modalOverlay; }
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'admin-modal-overlay';
    modalOverlay.id = 'adminModalOverlay';
    modalOverlay.hidden = true;
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) { closeModal(); }
    });
    document.body.appendChild(modalOverlay);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modalOverlay.hidden) { closeModal(); }
    });
    return modalOverlay;
  }

  function openModal(innerHtml) {
    var overlay = ensureModalOverlay();
    overlay.innerHTML = innerHtml;
    overlay.hidden = false;
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.hidden = true;
      modalOverlay.innerHTML = '';
    }
  }

  function openFormModal(product) {
    var isEdit = !!product;
    var p = product || {
      grade_name: '', slug: '', short_description: '', full_description: '',
      status: 'active', is_featured: false, is_published: true, display_order: 0
    };

    var statusOptionsHtml = STATUS_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (p.status === o.value ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var html =
      '<div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="productModalTitle">' +
        '<div class="admin-modal-head">' +
          '<h2 id="productModalTitle">' + (isEdit ? 'Edit Product' : 'Add Product') + '</h2>' +
          '<button type="button" class="admin-modal-close" id="productModalCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<p class="product-form-error" id="productFormError"></p>' +
        '<form id="productForm">' +
          '<div class="product-form-grid">' +
            '<div class="form-field form-field-full">' +
              '<label for="pfGradeName">Grade name <span class="req">*</span></label>' +
              '<input type="text" id="pfGradeName" name="grade_name" value="' + escapeHtml(p.grade_name) + '" required maxlength="100">' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pfSlug">Slug</label>' +
              '<input type="text" id="pfSlug" name="slug" value="' + escapeHtml(p.slug || '') + '" placeholder="e.g. ww180">' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pfStatus">Status</label>' +
              '<select id="pfStatus" name="status">' + statusOptionsHtml + '</select>' +
            '</div>' +
            '<div class="form-field form-field-full">' +
              '<label for="pfShortDesc">Short description</label>' +
              '<textarea id="pfShortDesc" name="short_description" rows="2">' + escapeHtml(p.short_description || '') + '</textarea>' +
            '</div>' +
            '<div class="form-field form-field-full">' +
              '<label for="pfFullDesc">Full description</label>' +
              '<textarea id="pfFullDesc" name="full_description" rows="4">' + escapeHtml(p.full_description || '') + '</textarea>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pfDisplayOrder">Display order</label>' +
              '<input type="number" id="pfDisplayOrder" name="display_order" value="' + (p.display_order != null ? p.display_order : 0) + '" step="1">' +
            '</div>' +
            '<div class="product-form-checks">' +
              '<label class="product-form-check"><input type="checkbox" id="pfPublished" name="is_published" ' + (p.is_published ? 'checked' : '') + '> Published</label>' +
              '<label class="product-form-check"><input type="checkbox" id="pfFeatured" name="is_featured" ' + (p.is_featured ? 'checked' : '') + '> Featured</label>' +
            '</div>' +
            '<div class="product-form-actions">' +
              '<button type="button" class="product-form-cancel" id="productFormCancelBtn">Cancel</button>' +
              '<button type="submit" class="product-form-submit" id="productFormSubmitBtn">' + (isEdit ? 'Save Changes' : 'Add Product') + '</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    openModal(html);

    document.getElementById('productModalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('productFormCancelBtn').addEventListener('click', closeModal);
    document.getElementById('productForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm(isEdit ? product.id : null);
    });
  }

  function submitForm(existingId) {
    var errorEl = document.getElementById('productFormError');
    var submitBtn = document.getElementById('productFormSubmitBtn');
    errorEl.classList.remove('is-visible');
    errorEl.textContent = '';

    var gradeName = document.getElementById('pfGradeName').value.trim();
    if (!gradeName) {
      errorEl.textContent = 'Grade name is required.';
      errorEl.classList.add('is-visible');
      return;
    }

    var displayOrderRaw = document.getElementById('pfDisplayOrder').value;
    var displayOrder = displayOrderRaw === '' ? 0 : parseInt(displayOrderRaw, 10);
    if (isNaN(displayOrder)) { displayOrder = 0; }

    var payload = {
      grade_name: gradeName,
      slug: document.getElementById('pfSlug').value.trim() || null,
      short_description: document.getElementById('pfShortDesc').value.trim() || null,
      full_description: document.getElementById('pfFullDesc').value.trim() || null,
      status: document.getElementById('pfStatus').value,
      is_published: document.getElementById('pfPublished').checked,
      is_featured: document.getElementById('pfFeatured').checked,
      display_order: displayOrder
    };

    submitBtn.disabled = true;
    submitBtn.textContent = existingId ? 'Saving…' : 'Adding…';

    var client = window.ArumbuAdminAuth.getClient();
    var query = existingId
      ? client.from('products').update(payload).eq('id', existingId).select().single()
      : client.from('products').insert(payload).select().single();

    query.then(function (res) {
      if (res.error) {
        submitBtn.disabled = false;
        submitBtn.textContent = existingId ? 'Save Changes' : 'Add Product';
        if (res.error.code === '23505') {
          errorEl.textContent = 'A product with this grade name already exists.';
        } else {
          errorEl.textContent = res.error.message || 'Something went wrong. Please try again.';
        }
        errorEl.classList.add('is-visible');
        return;
      }
      closeModal();
      loadProducts();
    });
  }

  // ---------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------

  function openDeleteConfirm(product) {
    var html =
      '<div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">' +
        '<div class="admin-modal-head">' +
          '<h2 id="deleteModalTitle">Delete Product</h2>' +
          '<button type="button" class="admin-modal-close" id="deleteModalCloseBtn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="admin-confirm-body">' +
          '<p>Delete <strong>' + escapeHtml(product.grade_name) + '</strong>? This also removes its rate card and images, and cannot be undone.</p>' +
        '</div>' +
        '<div class="admin-confirm-actions">' +
          '<button type="button" class="product-form-cancel" id="deleteCancelBtn">Cancel</button>' +
          '<button type="button" class="admin-confirm-danger" id="deleteConfirmBtn">Delete</button>' +
        '</div>' +
      '</div>';

    openModal(html);

    document.getElementById('deleteModalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('deleteCancelBtn').addEventListener('click', closeModal);
    document.getElementById('deleteConfirmBtn').addEventListener('click', function () {
      performDelete(product.id);
    });
  }

  function performDelete(id) {
    var confirmBtn = document.getElementById('deleteConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting…';

    var client = window.ArumbuAdminAuth.getClient();
    client.from('products').delete().eq('id', id).then(function (res) {
      if (res.error) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
        alert('Could not delete: ' + res.error.message);
        return;
      }
      closeModal();
      loadProducts();
    });
  }

  // ---------------------------------------------------------------
  // Quick publish/unpublish toggle
  // ---------------------------------------------------------------

  function togglePublish(product, nextValue, toggleEl, cardEl) {
    toggleEl.disabled = true;
    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('products')
      .update({ is_published: nextValue })
      .eq('id', product.id)
      .then(function (res) {
        toggleEl.disabled = false;
        if (res.error) {
          toggleEl.checked = !nextValue; // revert on failure
          alert('Could not update publish status: ' + res.error.message);
          return;
        }
        product.is_published = nextValue;
        var label = cardEl.querySelector('.product-toggle');
        if (label) {
          label.lastChild.textContent = nextValue ? 'Published' : 'Unpublished';
        }
      });
  }

  // ---------------------------------------------------------------
  // Init — only load data once this session is confirmed authorised.
  // Reuses admin-auth.js's own exported check rather than assuming
  // the page-level guard() has already resolved (avoids a race).
  // ---------------------------------------------------------------

  async function init() {
    try {
      var result = await window.ArumbuAdminAuth.getAuthorisedSession();
      if (!result.session || !result.profile) {
        return; // dashboard.html's own guard() will redirect away
      }
      loadProducts();
    } catch (err) {
      state.loading = false;
      state.error = err.message || 'Could not connect to Supabase.';
      render();
    }
  }

  init();
})();
