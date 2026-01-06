-- Enable RLS on the dedup_customers view and add policy for admins
-- Note: Views inherit RLS from underlying tables, but we need to explicitly enable it
alter view dedup_customers set (security_invoker = true);

-- Add policy for admins to read the view
create policy "Admins can read dedup_customers view" on dedup_customers
  for select using (is_admin());

