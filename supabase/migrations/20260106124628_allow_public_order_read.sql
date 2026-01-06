-- Allow public to read orders (for order confirmation page)
drop policy if exists "Public can read orders by id" on orders;
create policy "Public can read orders by id" on orders
  for select using (true);
