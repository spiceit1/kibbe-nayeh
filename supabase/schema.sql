-- Supabase schema for Kibbeh Nayeh single-product shop
create extension if not exists "uuid-ossp";

-- Helper: admin check (email or auth uid is in admin_users)
create or replace function is_admin() returns boolean
security definer
set search_path = public
language sql
stable
as $$
  select exists (
    select 1 from admin_users au
    where (au.auth_user_id = auth.uid() or lower(au.email) = lower(auth.email()))
  );
$$;

-- Function to verify admin password
create or replace function verify_admin_password(admin_email text, provided_password text)
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from admin_users
  where lower(email) = lower(admin_email);
  
  if stored_hash is null then
    return false;
  end if;
  
  -- Simple comparison (for production, consider using pgcrypto for hashing)
  return stored_hash = provided_password;
end;
$$;

-- Grant execute permission on the function
grant execute on function verify_admin_password(text, text) to anon, authenticated;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  auth_user_id uuid,
  notification_email text,
  notification_phone text,
  email_notifications_enabled boolean default false,
  sms_notifications_enabled boolean default false,
  created_at timestamptz default now()
);

create table if not exists settings (
  id integer primary key default 1,
  pickup_discount_enabled boolean default true,
  pickup_discount_type text check (pickup_discount_type in ('fixed','percent')) default 'percent',
  pickup_discount_value integer default 0,
  delivery_fee_cents integer default 0,
  currency text default 'USD',
  venmo_address text,
  updated_at timestamptz default now()
);

create table if not exists product_sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_label text not null,
  price_cents integer not null,
  available_qty integer not null default 0,
  is_active boolean default true,
  sort_order integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now(),
  unique (email, phone)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer unique not null default nextval('order_number_seq'),
  customer_id uuid references customers(id) on delete set null,
  fulfillment_method text check (fulfillment_method in ('delivery','pickup')) not null,
  status text check (status in ('Outstanding','In Progress','Ready','Delivered','Picked Up','Canceled')) default 'Outstanding',
  subtotal_cents integer default 0,
  pickup_discount_cents integer default 0,
  delivery_fee_cents integer default 0,
  total_cents integer not null,
  payment_status text default 'pending',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  notes text,
  delivery_address jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create sequence for order numbers starting at 1001
create sequence if not exists order_number_seq start 1001;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  size_id uuid references product_sizes(id),
  size_name text,
  unit_label text,
  quantity integer not null,
  price_cents integer not null
);

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  unit text not null,
  created_at timestamptz default now()
);

create table if not exists size_ingredient_requirements (
  id uuid primary key default gen_random_uuid(),
  size_id uuid references product_sizes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  amount numeric not null
);

create table if not exists ingredient_stock (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references ingredients(id) on delete cascade,
  on_hand numeric default 0
);

create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  status text not null,
  changed_at timestamptz default now(),
  note text
);

-- Aggregated customer view for admin portal
create or replace view dedup_customers as
select
  c.id,
  c.name,
  c.email,
  c.phone,
  max(o.created_at) as last_order_date,
  coalesce(sum(o.total_cents),0) as total_spend
from customers c
left join orders o on o.customer_id = c.id
group by c.id, c.name, c.email, c.phone;

-- RLS enable
alter table admin_users enable row level security;
alter table settings enable row level security;
alter table product_sizes enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table ingredients enable row level security;
alter table size_ingredient_requirements enable row level security;
alter table ingredient_stock enable row level security;
alter table order_status_history enable row level security;

-- Policies
create policy "Public can read active sizes" on product_sizes
  for select using (is_active = true);

create policy "Admins manage sizes" on product_sizes
  for all using (is_admin()) with check (is_admin());

create policy "Public can read settings" on settings
  for select using (true);

create policy "Admins manage settings" on settings
  for all using (is_admin()) with check (is_admin());

create policy "Admins read customers" on customers
  for select using (is_admin());

create policy "Service role inserts customers" on customers
  for insert to authenticated, service_role with check (auth.role() = 'service_role');

create policy "Admins manage customers" on customers
  for update using (is_admin()) with check (is_admin());

create policy "Public can read orders by id" on orders
  for select using (true);

create policy "Admins read orders" on orders
  for select using (is_admin());

create policy "Service role inserts orders" on orders
  for insert to authenticated, service_role with check (auth.role() = 'service_role');

create policy "Admins update orders" on orders
  for update using (is_admin()) with check (is_admin());

create policy "Public can read order items" on order_items
  for select using (true);

create policy "Admins read order items" on order_items
  for select using (is_admin());

create policy "Service role inserts order items" on order_items
  for insert to authenticated, service_role with check (auth.role() = 'service_role');

create policy "Admins manage order items" on order_items
  for update using (is_admin()) with check (is_admin());

create policy "Admins manage ingredients" on ingredients
  for all using (is_admin()) with check (is_admin());

create policy "Admins manage size ingredient requirements" on size_ingredient_requirements
  for all using (is_admin()) with check (is_admin());

create policy "Admins manage ingredient stock" on ingredient_stock
  for all using (is_admin()) with check (is_admin());

create policy "Admins manage order status history" on order_status_history
  for all using (is_admin()) with check (is_admin());

-- Admin users policies
create policy "Admins can read admin_users" on admin_users
  for select using (is_admin());

create policy "Admins can update own password" on admin_users
  for update using (is_admin()) with check (is_admin());

-- RPC function to get orders with customer data (bypasses RLS)
create or replace function get_orders_with_customers(
  admin_email text,
  limit_count integer default 50
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  is_admin_user boolean;
  orders_data jsonb;
begin
  -- Verify admin
  select exists (
    select 1 from admin_users au
    where lower(au.email) = lower(admin_email)
  ) into is_admin_user;
  
  if not is_admin_user then
    raise exception 'Unauthorized: Admin access required';
  end if;
  
  -- Fetch orders with customer and order_items data
  select jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total_cents', o.total_cents,
      'subtotal_cents', o.subtotal_cents,
      'fulfillment_method', o.fulfillment_method,
      'created_at', o.created_at,
      'payment_status', o.payment_status,
      'delivery_fee_cents', o.delivery_fee_cents,
      'pickup_discount_cents', o.pickup_discount_cents,
      'notes', o.notes,
      'delivery_address', o.delivery_address,
      'customer', case 
        when c.id is not null then jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'email', c.email,
          'phone', c.phone
        )
        else null
      end,
      'order_items', (
        select jsonb_agg(
          jsonb_build_object(
            'size_name', oi.size_name,
            'quantity', oi.quantity,
            'price_cents', oi.price_cents,
            'unit_label', oi.unit_label
          )
        )
        from order_items oi
        where oi.order_id = o.id
      )
    )
    order by o.created_at desc
  )
  into orders_data
  from orders o
  left join customers c on c.id = o.customer_id
  limit limit_count;
  
  return coalesce(orders_data, '[]'::jsonb);
end;
$$;

-- Grant execute permission to anon and authenticated roles
grant execute on function get_orders_with_customers(text, integer) to anon, authenticated;

-- RPC function to update order status (bypasses RLS)
create or replace function update_order_status(
  admin_email text,
  order_id uuid,
  new_status text
)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  is_admin_user boolean;
  updated_order jsonb;
begin
  -- Verify admin
  select exists (
    select 1 from admin_users au
    where lower(au.email) = lower(admin_email)
  ) into is_admin_user;
  
  if not is_admin_user then
    raise exception 'Unauthorized: Admin access required';
  end if;
  
  -- Validate status
  if new_status not in ('Outstanding', 'In Progress', 'Ready', 'Delivered', 'Picked Up', 'Canceled') then
    raise exception 'Invalid status: %', new_status;
  end if;
  
  -- Update order status
  update orders
  set 
    status = new_status,
    updated_at = now()
  where id = order_id;
  
  -- Create status history entry
  insert into order_status_history (order_id, status, note)
  values (order_id, new_status, 'Status updated by admin');
  
  -- Return updated order
  select row_to_json(o)::jsonb into updated_order
  from orders o
  where o.id = order_id;
  
  return updated_order;
end;
$$;

-- Grant execute permission to anon and authenticated roles
grant execute on function update_order_status(text, uuid, text) to anon, authenticated;

