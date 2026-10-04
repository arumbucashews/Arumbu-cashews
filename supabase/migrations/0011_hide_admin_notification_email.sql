-- ARUMBU CASHEWS — Hide internal notification email from public reads
-- Public site settings remain readable, but the internal admin notification
-- recipient must never be exposed through the public site_settings SELECT policy.

begin;

drop policy if exists "site_settings_public_select" on public.site_settings;

create policy "site_settings_public_select"
  on public.site_settings
  for select
  to anon, authenticated
  using (key <> 'notify_admin_email');

-- Keep admin access unchanged: the existing admin-write policy is
-- intentionally permissive for administrators and therefore still permits
-- admins to read/update the notification email row.

commit;
