/* Arumbu Cashews — Admin Supabase config
   ---------------------------------------------------------------
   Publishable key only (safe for the browser; it can only do what
   the RLS policies allow). NEVER put a secret/service_role key here
   — this file is visible to anyone who opens the admin pages.

   Same environment rule as js/supabase-public.js:
     arumbucashews.com -> PRODUCTION project, anything else -> TEST. */
(function () {
  var PRODUCTION = {
    url: 'https://hnuvzzefwxizhvehwoxa.supabase.co',
    key: 'sb_publishable_sf_X-uRBuo9LKDDCq0qrqg_4wJkXO0T'
  };
  var TEST = {
    url: 'https://lganzdpqftozoaqfqlmo.supabase.co',
    key: 'sb_publishable_xMrYKTMwyp-X-Cpr1RgkeA_JeTvTszq'
  };
  var host = (window.location && window.location.hostname) || '';
  var isProduction = /(^|\.)arumbucashews\.com$/i.test(host);
  var cfg = isProduction ? PRODUCTION : TEST;

  window.ARUMBU_ENV = isProduction ? 'production' : 'test';
  window.ARUMBU_SUPABASE_URL = cfg.url;
  window.ARUMBU_SUPABASE_ANON_KEY = cfg.key;
  window.ARUMBU_FUNCTIONS_URL = cfg.url + '/functions/v1';
})();
