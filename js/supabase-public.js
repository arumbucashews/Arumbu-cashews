/* Arumbu Cashews — Public site Supabase config
   ---------------------------------------------------------------
   Only ever uses the publishable/anon key — safe to ship in the
   browser. Every read/write it makes is governed by Row Level
   Security; nothing here can bypass it. NEVER put a service_role
   key, payment secret or any other private key in this file.

   Environment selection (by hostname):
     arumbucashews.com / www.arumbucashews.com -> PRODUCTION project
     anything else (localhost, *.pages.dev previews, file://) -> TEST
   The commerce features (cart, checkout, accounts, CMS text) need
   migrations 0006 + 0007 applied to whichever project is used. Until
   they are applied to production, the live site keeps working with
   its existing static content and WhatsApp ordering — the new code
   degrades gracefully when those tables are missing. */
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
  window.ARUMBU_PUBLIC_SUPABASE_URL = cfg.url;
  window.ARUMBU_PUBLIC_SUPABASE_ANON_KEY = cfg.key;
  window.ARUMBU_FUNCTIONS_URL = cfg.url + '/functions/v1';
})();
