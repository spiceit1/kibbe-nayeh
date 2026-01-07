-- Add order_number column to orders table
alter table orders add column if not exists order_number integer;

-- Create sequence starting at 1001
create sequence if not exists order_number_seq start 1001;

-- Set default value for order_number using the sequence
alter table orders alter column order_number set default nextval('order_number_seq');

-- Update existing orders to have order numbers (if any exist)
-- This will assign numbers starting from 1001 in chronological order
do $$
declare
  order_rec record;
  order_num integer := 1000;
begin
  for order_rec in select id from orders order by created_at asc
  loop
    order_num := order_num + 1;
    update orders set order_number = order_num where id = order_rec.id;
  end loop;
  
  -- Reset sequence to continue from the highest order number
  if order_num > 1000 then
    perform setval('order_number_seq', order_num);
  end if;
end $$;

-- Make order_number unique and not null
alter table orders alter column order_number set not null;
create unique index if not exists orders_order_number_unique on orders(order_number);

