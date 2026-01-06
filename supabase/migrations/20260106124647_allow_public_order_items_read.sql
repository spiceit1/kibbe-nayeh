-- Allow public to read order_items (for order confirmation page)
drop policy if exists "Public can read order items" on order_items;
create policy "Public can read order items" on order_items
  for select using (true);
