-- Update get_orders_with_customers function to include order_number
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

