/* Arumbu Cashews — Admin Supabase config
   ---------------------------------------------------------------
   Fill in the two values below from your Supabase project's
   Settings -> API page:
     - SUPABASE_URL     -> "Project URL"
     - SUPABASE_ANON_KEY -> the "Publishable key" (safe for the
       browser; it only does what your RLS policies in
       0002_rls_policies.sql / 0004_storage_buckets.sql allow).

   NEVER put a secret/service_role key here — this file is loaded
   by the browser and is fully visible to anyone who opens
   admin/login.html or admin/dashboard.html. */

window.ARUMBU_SUPABASE_URL = 'https://hnuvzzefwxizhvehwoxa.supabase.co';
window.ARUMBU_SUPABASE_ANON_KEY = 'sb_publishable_sf_X-uRBuo9LKDDCq0qrqg_4wJkXO0T';
