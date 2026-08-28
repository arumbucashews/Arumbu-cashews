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
   grade_name is unique (case-insensitive) at the database level.

   Product image management (added — reuses existing infrastructure,
   nothing new was created in Supabase):
     public.product_images (
       id, product_id, storage_path, alt_text, is_primary,
       display_order, created_at
     ) — already existed; a unique index enforces at most one
     is_primary=true row per product_id, which this file treats as
     "the" product image (one image per grade, per the brief).
   Storage bucket "product-images" — already existed (public read,
   admin write, 10MB limit, jpeg/png/webp only). File paths are
   namespaced by product id (<product_id>/<timestamp>-<rand>.<ext>)
   so replacing one grade's image can never collide with another's. */

(function () {
  'use strict';

  var IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — safely under the bucket's 10MB hard limit

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
    var thumbHtml = p.primary_image_path
      ? '<img class="product-thumb" src="' + publicProductImageUrl(p.primary_image_path) + '" alt="">'
      : '<div class="product-thumb product-thumb-empty"></div>';
    return (
      '<article class="product-card" data-id="' + p.id + '">' +
        thumbHtml +
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
      .select('id, grade_name, slug, short_description, full_description, status, is_featured, is_published, display_order, product_images(storage_path, is_primary)')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(function (res) {
        state.loading = false;
        if (res.error) {
          state.error = 'Could not load products: ' + res.error.message;
          state.products = null;
        } else {
          state.products = (res.data || []).map(function (p) {
            var images = Array.isArray(p.product_images) ? p.product_images : (p.product_images ? [p.product_images] : []);
            var primary = images.find(function (img) { return img.is_primary; }) || null;
            p.primary_image_path = primary ? primary.storage_path : null;
            return p;
          });
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
            (isEdit ?
              '<div class="form-field form-field-full">' +
                '<label>Product Image</label>' +
                '<div class="upload-field" id="productImageManager">' +
                  '<div class="products-message" style="padding:0.9rem 1.2rem;">Loading image…</div>' +
                '</div>' +
              '</div>'
              :
              '<div class="form-field form-field-full">' +
                '<label>Product Image</label>' +
                '<p style="font-size:0.82rem; color:var(--ink-muted); margin:0;">Save this product first, then edit it to add an image.</p>' +
              '</div>'
            ) +
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

    if (isEdit) {
      initProductImageManager(product.id);
    }
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
  // Product Image (public.product_images + "product-images" bucket)
  // ---------------------------------------------------------------

  function extFromFile(file) {
    var m = /\.([a-zA-Z0-9]+)$/.exec(file.name);
    return m ? m[1].toLowerCase() : 'jpg';
  }

  function publicProductImageUrl(path) {
    if (!path) { return null; }
    return window.ArumbuAdminAuth.getClient().storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }

  function initProductImageManager(productId) {
    var client = window.ArumbuAdminAuth.getClient();
    client
      .from('product_images')
      .select('id, storage_path')
      .eq('product_id', productId)
      .eq('is_primary', true)
      .maybeSingle()
      .then(function (res) {
        var managerEl = document.getElementById('productImageManager');
        if (!managerEl) { return; } // modal was closed before this resolved
        if (res.error) {
          managerEl.innerHTML = '<div class="products-message is-error" style="padding:0.9rem 1.2rem;">Could not load image: ' + escapeHtml(res.error.message) + '</div>';
          return;
        }
        renderImageManager(productId, res.data || null);
      });
  }

  function renderImageManager(productId, imageRow) {
    var managerEl = document.getElementById('productImageManager');
    if (!managerEl) { return; }

    var hasImage = !!imageRow;
    var previewSrc = hasImage ? publicProductImageUrl(imageRow.storage_path) : '';

    managerEl.innerHTML =
      (hasImage
        ? '<img class="upload-preview is-product-photo" id="productImagePreview" src="' + previewSrc + '" alt="Current product image">'
        : '<div class="upload-preview is-product-photo" id="productImagePreview"></div>') +
      '<div>' +
        '<label style="font-size:0.78rem; color:var(--ink-muted); display:block; margin-bottom:0.35rem;">' +
          (hasImage ? 'Replace Image' : 'Upload Image') +
        '</label>' +
        '<input type="file" id="productImageFileInput" accept="image/jpeg,image/png,image/webp">' +
        (hasImage
          ? '<button type="button" class="product-form-cancel" id="productImageRemoveBtn" style="padding:0.4rem 0.85rem; font-size:0.78rem; margin-top:0.55rem; display:block;">Remove Image</button>'
          : '') +
        '<div class="upload-status" id="productImageStatus"></div>' +
      '</div>';

    document.getElementById('productImageFileInput').addEventListener('change', function (e) {
      handleProductImageUpload(e, productId, imageRow);
    });
    var removeBtn = document.getElementById('productImageRemoveBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () { handleProductImageRemove(productId, imageRow); });
    }
  }

  function handleProductImageUpload(e, productId, existingImageRow) {
    var file = e.target.files && e.target.files[0];
    if (!file) { return; }

    var statusEl = document.getElementById('productImageStatus');

    if (IMAGE_MIME_TYPES.indexOf(file.type) === -1) {
      statusEl.textContent = 'Please choose a JPG, PNG, or WebP image.';
      statusEl.className = 'upload-status is-error';
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      statusEl.textContent = 'Image is too large — please choose a file under 8MB.';
      statusEl.className = 'upload-status is-error';
      return;
    }

    statusEl.textContent = 'Uploading…';
    statusEl.className = 'upload-status';

    var client = window.ArumbuAdminAuth.getClient();
    // Namespaced by product id so replacing one grade's image can
    // never collide with or overwrite another grade's file.
    var path = productId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extFromFile(file);

    client.storage.from('product-images').upload(path, file, { upsert: true, contentType: file.type }).then(function (uploadRes) {
      if (uploadRes.error) {
        statusEl.textContent = 'Upload failed: ' + uploadRes.error.message;
        statusEl.className = 'upload-status is-error';
        return;
      }

      var oldPath = existingImageRow ? existingImageRow.storage_path : null;
      var dbQuery = existingImageRow
        ? client.from('product_images').update({ storage_path: path }).eq('id', existingImageRow.id).select().single()
        : client.from('product_images').insert({ product_id: productId, storage_path: path, is_primary: true, display_order: 0 }).select().single();

      dbQuery.then(function (res) {
        if (res.error) {
          statusEl.textContent = 'File uploaded, but could not save it to the product: ' + res.error.message;
          statusEl.className = 'upload-status is-error';
          return;
        }

        statusEl.textContent = 'Image updated.';
        statusEl.className = 'upload-status is-success';
        renderImageManager(productId, res.data);

        // Clean up the file this one replaced — don't let storage
        // silently accumulate a copy of every past image.
        if (oldPath && oldPath !== path) {
          client.storage.from('product-images').remove([oldPath]).then(function (removeRes) {
            if (removeRes.error) { console.warn('Could not remove old product image:', removeRes.error.message); }
          });
        }
      });
    });
  }

  function handleProductImageRemove(productId, imageRow) {
    if (!imageRow) { return; }
    var confirmed = window.confirm('Remove this product image? The grade will show no image until a new one is uploaded.');
    if (!confirmed) { return; }

    var statusEl = document.getElementById('productImageStatus');
    statusEl.textContent = 'Removing…';
    statusEl.className = 'upload-status';

    var client = window.ArumbuAdminAuth.getClient();
    client.from('product_images').delete().eq('id', imageRow.id).then(function (res) {
      if (res.error) {
        statusEl.textContent = 'Could not remove image: ' + res.error.message;
        statusEl.className = 'upload-status is-error';
        return;
      }
      client.storage.from('product-images').remove([imageRow.storage_path]).then(function (removeRes) {
        if (removeRes.error) { console.warn('Could not remove storage file:', removeRes.error.message); }
      });
      renderImageManager(productId, null);
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
