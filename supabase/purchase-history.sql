grant select(user_id,book_id,amount_cents,confirmed_at,created_at) on public.checkout_orders to authenticated;
create policy own_approved_purchase_history on public.checkout_orders for select to authenticated using((select auth.uid())=user_id and payment_status='approved');
