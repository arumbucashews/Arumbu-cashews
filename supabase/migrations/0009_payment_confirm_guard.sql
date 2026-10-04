-- Arumbu Cashews — 0009: payment_confirm() defence in depth.
-- Rejects a Razorpay payment id that has already settled a different
-- order. Replaces the function body only; signature, owner and grants
-- are unchanged (create or replace keeps existing privileges).
create or replace function public.payment_confirm(p_order_id uuid, p_gateway_order_id text, p_payment_id text,
                                                  p_amount_paise bigint, p_raw jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.razorpay_order_id is distinct from p_gateway_order_id then raise exception 'gateway_order_mismatch'; end if;
  -- a gateway payment can settle exactly one order
  if exists (select 1 from public.payments where provider = 'razorpay' and provider_payment_id = p_payment_id and order_id <> o.id) then
    raise exception 'payment_already_used';
  end if;
  if o.payment_status = 'paid' then
    return jsonb_build_object('order_id', o.id, 'payment_status', 'paid', 'already', true);
  end if;
  if p_amount_paise <> round(o.total * 100) then raise exception 'amount_mismatch'; end if;
  if o.order_status in ('cancelled', 'refunded') then raise exception 'order_cancelled'; end if;

  insert into public.payments (order_id, provider, provider_order_id, provider_payment_id, amount, status, raw)
  values (o.id, 'razorpay', p_gateway_order_id, p_payment_id, o.total, 'paid', p_raw)
  on conflict do nothing;

  perform set_config('arumbu.actor_note', 'Payment verified (Razorpay ' || p_payment_id || ')', true);
  update public.orders set payment_status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(),
         order_status = case when order_status = 'pending' then 'confirmed' else order_status end
   where id = o.id;

  perform public.enqueue_notification('payment_confirmed', 'customer', o.customer_email,
    jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'total', o.total));
  return jsonb_build_object('order_id', o.id, 'payment_status', 'paid');
end;
$$;
