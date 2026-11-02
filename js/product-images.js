/* Arumbu Cashews — CMS-driven homepage grade images
   Uses the same public catalogue loader as the product pages and admin
   preview. The primary image saved for each grade in Supabase is the
   source of truth; the bundled image in index.html is only a fallback.
*/
(function () {
  'use strict';

  function applySavedGradeImages() {
    var store = window.ArumbuStore;
    if (!store || typeof store.loadCatalog !== 'function') return;

    store.loadCatalog().then(function (products) {
      (products || []).forEach(function (product) {
        var grade = String(product.grade_name || '').trim().toUpperCase();
        if (!grade || !Array.isArray(product.images) || !product.images.length) return;

        var card = document.querySelector('.grade-item[data-grade="' + grade.replace(/[^A-Z0-9_-]/g, '') + '"]');
        if (!card) return;

        var image = card.querySelector('.grade-media img');
        var savedImage = product.images[0]; // loadCatalog sorts the primary image first
        if (!image || !savedImage || !savedImage.url) return;

        image.onerror = null;
        image.removeAttribute('data-fallback');
        image.src = savedImage.url;
        image.alt = savedImage.alt || ('Arumbu Cashews ' + grade);
      });
    }).catch(function (error) {
      // Keep the bundled static images if the public catalogue is unavailable.
      console.warn('[Arumbu] Could not load CMS grade images; using static fallbacks.', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySavedGradeImages);
  } else {
    applySavedGradeImages();
  }
})();
