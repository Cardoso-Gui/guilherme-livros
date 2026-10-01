create table public.checkout_orders (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 book_id text not null check(book_id='o-quinto-herdeiro'),
 amount_cents integer not null check(amount_cents=1490),
 preference_id text,checkout_url text,created_at timestamptz not null default now(),
 payment_id text unique,payment_status text,confirmed_at timestamptz);
create index checkout_orders_user_created on public.checkout_orders(user_id,created_at desc);
alter table public.checkout_orders enable row level security;
revoke all on public.checkout_orders from anon,authenticated;
grant all on public.checkout_orders to service_role;
create policy server_orders on public.checkout_orders to service_role using(true) with check(true);
create function public.confirm_checkout_payment(p_order_id uuid,p_payment_id text,p_status text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare o public.checkout_orders; begin
 select * into o from public.checkout_orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found'; end if;
 -- A later failed attempt must not undo an approved purchase.
 if o.payment_status='approved' and o.payment_id is distinct from p_payment_id then return true; end if;
 update public.checkout_orders set payment_id=p_payment_id,payment_status=p_status,
 confirmed_at=case when p_status='approved' then coalesce(confirmed_at,now()) else confirmed_at end where id=p_order_id;
 if p_status='approved' then
 insert into public.book_access(user_id,book_id) values(o.user_id,o.book_id) on conflict(user_id,book_id) do nothing;
 return true; end if; return false; end; $$;
revoke all on function public.confirm_checkout_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.confirm_checkout_payment(uuid,text,text) to service_role;