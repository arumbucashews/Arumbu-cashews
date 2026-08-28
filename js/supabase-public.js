/* Arumbu Cashews — Public site Supabase config
   ---------------------------------------------------------------
   Same project as admin/supabase-config.js, but for the public
   website. Only ever uses the publishable/anon key — safe to ship
   in the browser, and every read it makes is governed by the
   existing public RLS policies (e.g. "products_public_select",
   "product_images_public_select"), never bypassing them. */

window.ARUMBU_PUBLIC_SUPABASE_URL = 'https://hnuvzzefwxizhvehwoxa.supabase.co';
window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_sf_X-uRBuo9LKDDCq0qrqg_4wJkXO0T';
