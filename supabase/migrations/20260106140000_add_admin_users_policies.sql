-- Add RLS policies for admin_users table
-- Drop existing policies if they exist
drop policy if exists "Admins can read admin_users" on admin_users;
drop policy if exists "Admins can update own password" on admin_users;

-- Allow admins to read admin_users
create policy "Admins can read admin_users" on admin_users
  for select using (is_admin());

-- Allow admins to update their own password
create policy "Admins can update own password" on admin_users
  for update using (is_admin()) with check (is_admin());

