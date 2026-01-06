-- Seed data for local testing
insert into admin_users (email) values ('admin@example.com')
on conflict (email) do nothing;

insert into settings (id, pickup_discount_enabled, pickup_discount_type, pickup_discount_value, delivery_fee_cents, currency)
values (1, true, 'percent', 10, 800, 'USD')
on conflict (id) do update set pickup_discount_enabled = excluded.pickup_discount_enabled,
  pickup_discount_type = excluded.pickup_discount_type,
  pickup_discount_value = excluded.pickup_discount_value,
  delivery_fee_cents = excluded.delivery_fee_cents,
  currency = excluded.currency;

insert into product_sizes (name, unit_label, price_cents, available_qty, is_active, sort_order)
values
('Taster (8 oz)', '8 oz tray', 1800, 24, true, 1),
('Family (16 oz)', '16 oz tray', 3200, 18, true, 2),
('Gathering (32 oz)', '32 oz platter', 5900, 10, true, 3)
on conflict do nothing;

insert into ingredients (name, unit)
values ('Lean beef', 'lb'), ('Fine bulgur', 'cup'), ('Olive oil', 'oz'), ('Mint', 'bunch'), ('Onion', 'ea')
on conflict do nothing;

-- example ingredient requirements (adjust to your recipe)
insert into size_ingredient_requirements (size_id, ingredient_id, amount)
select ps.id, i.id, v.amount
from (values
  ('Taster (8 oz)', 'Lean beef', 0.6),
  ('Taster (8 oz)', 'Fine bulgur', 0.25),
  ('Family (16 oz)', 'Lean beef', 1.2),
  ('Family (16 oz)', 'Fine bulgur', 0.5),
  ('Gathering (32 oz)', 'Lean beef', 2.4),
  ('Gathering (32 oz)', 'Fine bulgur', 1.0)
) as v(size_name, ingredient_name, amount)
join product_sizes ps on ps.name = v.size_name
join ingredients i on i.name = v.ingredient_name
on conflict do nothing;

