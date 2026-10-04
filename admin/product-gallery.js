/* Arumbu Cashews — Admin: product image gallery (multiple images per
   grade, primary image, English/Tamil image descriptions, order). */
(function () {
  'use strict';
  var A = window.ArumbuAdmin;
  if (!A) return;
  var esc = A.esc;
  var TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function url(path) { return A.client().storage.from('product-images').getPublicUrl(path).data.publicUrl; }

  function open(productId, grade) {
    A.modal({ title: 'Gallery — ' + grade, wide: true, body: '<div class="products-message">Loading…</div>' });
    A.client().from('product_images').select('*').eq('product_id', productId).order('is_primary', { ascending: false }).order('display_order').then(function (res) {
      var imgs = res.data || [];
      var m = A.modal({ title: 'Gallery — ' + grade, wide: true, body:
        '<p class="cell-muted admin-help">The primary image is used on product cards; all images appear on the product page. Describe each photo (what it shows) for accessibility and search.</p>' +
        (imgs.length ? imgs.map(function (im) {
          return '<div class="slide-card content-card" data-id="' + esc(im.id) + '" style="padding:1rem"><img src="' + esc(url(im.storage_path)) + '" alt="">' +
            '<div><div class="product-form-grid">' +
              '<div class="form-field"><label>Description (English)</label><input data-f="alt_text" value="' + esc(im.alt_text || '') + '" maxlength="160"></div>' +
              '<div class="form-field"><label>Description (தமிழ்)</label><input data-f="alt_text_ta" value="' + esc(im.alt_text_ta || '') + '" maxlength="160"></div>' +
              '<div class="form-field"><label>Order</label><input data-f="display_order" type="number" value="' + esc(im.display_order || 0) + '"></div>' +
              '<div class="product-form-checks"><label class="product-form-check"><input type="radio" name="gPrimary" value="' + esc(im.id) + '"' + (im.is_primary ? ' checked' : '') + '> Primary</label></div>' +
            '</div><div class="content-save-bar"><button type="button" class="social-link-save-btn" data-save>Save</button><button type="button" class="product-form-cancel" data-del>Remove</button><span class="upload-status" data-st></span></div></div></div>';
        }).join('') : '<div class="products-message">No images yet — the site shows the built-in photo for this grade, if there is one.</div>') +
        '<div class="content-card"><h3>Add images</h3><input type="file" id="gFiles" accept="image/jpeg,image/png,image/webp" multiple><span class="upload-status" id="gSt"></span></div>' });
      m.querySelectorAll('.slide-card').forEach(function (card) {
        var id = card.getAttribute('data-id');
        var st = card.querySelector('[data-st]');
        card.querySelector('[data-save]').addEventListener('click', function () {
          var primary = card.querySelector('input[name="gPrimary"]').checked;
          var row = { alt_text: card.querySelector('[data-f="alt_text"]').value.trim() || null, alt_text_ta: card.querySelector('[data-f="alt_text_ta"]').value.trim() || null,
            display_order: parseInt(card.querySelector('[data-f="display_order"]').value, 10) || 0, is_primary: primary };
          var pre = primary ? A.client().from('product_images').update({ is_primary: false }).eq('product_id', productId).neq('id', id) : Promise.resolve({});
          pre.then(function () { return A.client().from('product_images').update(row).eq('id', id); }).then(function (r) {
            st.textContent = r.error ? A.errMsg(r.error) : 'Saved.'; st.className = 'upload-status ' + (r.error ? 'is-error' : 'is-success');
          });
        });
        card.querySelector('[data-del]').addEventListener('click', function () {
          if (!window.confirm('Remove this image?')) return;
          var im = imgs.filter(function (x) { return x.id === id; })[0];
          A.client().from('product_images').delete().eq('id', id).then(function (r) {
            if (r.error) return A.toast(A.errMsg(r.error), true);
            A.client().storage.from('product-images').remove([im.storage_path]);
            open(productId, grade);
          });
        });
      });
      m.querySelector('#gFiles').addEventListener('change', function (e) {
        var files = Array.prototype.slice.call(e.target.files || []);
        var st = m.querySelector('#gSt');
        var bad = files.filter(function (f) { return TYPES.indexOf(f.type) === -1 || f.size > 5 * 1024 * 1024; });
        if (bad.length) { st.textContent = 'Only JPEG, PNG or WebP under 5 MB.'; st.className = 'upload-status is-error'; return; }
        st.textContent = 'Uploading ' + files.length + '…'; st.className = 'upload-status';
        var order = imgs.length;
        Promise.all(files.map(function (f, i) {
          var path = productId + '/' + Date.now() + '-' + i + '.' + (f.type === 'image/jpeg' ? 'jpg' : f.type.split('/')[1]);
          return A.client().storage.from('product-images').upload(path, f, { contentType: f.type }).then(function (up) {
            if (up.error) throw up.error;
            return A.client().from('product_images').insert({ product_id: productId, storage_path: path, is_primary: !imgs.length && i === 0, display_order: order + i + 1 });
          });
        })).then(function () { open(productId, grade); }, function (err) { st.textContent = 'Upload failed: ' + A.errMsg(err); st.className = 'upload-status is-error'; });
      });
    });
  }
  window.ArumbuGallery = { open: open };
})();
