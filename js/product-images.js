/* Arumbu Cashews — Dynamic product images (public site)
   ---------------------------------------------------------------
   Progressive enhancement only: every grade's <img> already has a
   working static src (images/products/*.jpg etc.) as a fallback.
   On page load, this checks Supabase for a saved product image per
   grade and swaps the <img src> to it when one exists — so an
   image the admin uploads/replaces in the CMS becomes the image
   shown here, without ever touching the page's markup, layout, or
   any other functionality.

   Matches each <img> to a product by its existing alt text, e.g.
   alt="Arumbu Cashews WW180" -> grade "WW180". No new markup or
   data attributes were added to do this.

   Read-only, anon-key, public RLS only (products_public_select /
   product_images_public_select) — no admin/auth involvement. If
   Supabase is unreachable or a grade has no image, the original
   static <img> is left exactly as it was. */

(function () {
  'use strict';

  if (!window.supabase || !window.ARUMBU_PUBLIC_SUPABASE_URL || !window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY) {
    return; // config/CDN not loaded on this page — leave static images as-is
  }

  function run() {
    var images = document.querySelectorAll('img[alt^="Arumbu Cashews "]');
    if (images.length === 0) { return; }

    var client;
    try {
      client = window.supabase.createClient(window.ARUMBU_PUBLIC_SUPABASE_URL, window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY);
    } catch (err) {
      return;
    }

    client
      .from('products')
      .select('grade_name, product_images(storage_path, is_primary)')
      .then(function (res) {
        if (res.error || !res.data) { return; }

        var urlByGrade = {};
        res.data.forEach(function (p) {
          var imgs = Array.isArray(p.product_images) ? p.product_images : (p.product_images ? [p.product_images] : []);
          var primary = imgs.find(function (i) { return i.is_primary; });
          if (primary && primary.storage_path) {
            urlByGrade[p.grade_name.trim().toUpperCase()] =
              client.storage.from('product-images').getPublicUrl(primary.storage_path).data.publicUrl;
          }
        });

        images.forEach(function (img) {
          var grade = img.getAttribute('alt').replace(/^Arumbu Cashews\s+/i, '').trim().toUpperCase();
          var url = urlByGrade[grade];
          if (url) { img.src = url; }
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
