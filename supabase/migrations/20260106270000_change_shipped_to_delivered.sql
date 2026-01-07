-- Change "Shipped" status to "Delivered"
-- First, update any existing orders with "Shipped" status to "Delivered"
update orders set status = 'Delivered' where status = 'Shipped';

-- Update status history
update order_status_history set status = 'Delivered' where status = 'Shipped';

-- Drop the old check constraint
alter table orders drop constraint if exists orders_status_check;

-- Add new check constraint with "Delivered" instead of "Shipped"
alter table orders add constraint orders_status_check 
  check (status in ('Outstanding','In Progress','Ready','Delivered','Picked Up','Canceled'));

-- Update the update_order_status function
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

