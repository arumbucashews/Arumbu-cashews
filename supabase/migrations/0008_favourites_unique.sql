-- Arumbu Cashews — 0008: one wishlist row per customer + product.
-- Additive only. Skips itself (with a notice) if duplicates already
-- exist, so it can never fail on existing production data.
do $$
begin
  if exists (
    select 1 from public.favourites group by customer_id, product_id having count(*) > 1
  ) then
    raise notice 'favourites has duplicate rows — unique index not created; clean up duplicates and re-run';
  else
    create unique index if not exists favourites_customer_product_uniq
      on public.favourites (customer_id, product_id);
  end if;
end $$;
