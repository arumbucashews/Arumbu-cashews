/* Arumbu Cashews — Admin auth helpers
   Shared by admin/login.html and admin/dashboard.html.
   Requires supabase-config.js and the Supabase JS CDN script to be
   loaded first. */

(function () {
  'use strict';

  function getClient() {
    if (!window.ARUMBU_SUPABASE_URL || window.ARUMBU_SUPABASE_URL.indexOf('YOUR-PROJECT-REF') !== -1) {
      throw new Error('Supabase is not configured yet — fill in admin/supabase-config.js first.');
    }
    if (!window._arumbuAdminClient) {
      window._arumbuAdminClient = window.supabase.createClient(
        window.ARUMBU_SUPABASE_URL,
        window.ARUMBU_SUPABASE_ANON_KEY
      );
    }
    return window._arumbuAdminClient;
  }

  /* Checks the current session AND that the signed-in user has an
     authorised public.profiles row (role = admin | editor).
     Returns { session, profile } on success.
     Returns { session: null, profile: null } if there's no session.
     Returns { session, profile: null } if the user is authenticated
     but NOT authorised (caller should sign them out). */
  async function getAuthorisedSession() {
    var client = getClient();

    var sessionRes = await client.auth.getSession();
    var session = sessionRes.data && sessionRes.data.session;
    if (!session) {
      return { client: client, session: null, profile: null };
    }

    var profileRes = await client
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', session.user.id)
      .in('role', ['admin', 'editor'])
      .maybeSingle();

    if (profileRes.error || !profileRes.data) {
      return { client: client, session: session, profile: null };
    }

    return { client: client, session: session, profile: profileRes.data };
  }

  async function signOut() {
    var client = getClient();
    await client.auth.signOut();
  }

  window.ArumbuAdminAuth = {
    getClient: getClient,
    getAuthorisedSession: getAuthorisedSession,
    signOut: signOut
  };
})();
