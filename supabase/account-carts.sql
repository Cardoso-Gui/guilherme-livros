create table public.account_carts (
user_id uuid primary key references auth.users(id) on delete cascade,
items text[] not null default '{}' check(items <@ array['o-quinto-herdeiro']::text[] and cardinality(items)<=1),
updated_at timestamptz not null default now());
alter table public.account_carts enable row level security;
revoke all on public.account_carts from anon,authenticated;
grant select,insert,update on public.account_carts to authenticated;
create policy own_cart_select on public.account_carts for select to authenticated using((select auth.uid())=user_id);
create policy own_cart_insert on public.account_carts for insert to authenticated with check((select auth.uid())=user_id);
create policy own_cart_update on public.account_carts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);