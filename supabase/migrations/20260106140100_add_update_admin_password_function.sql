-- Create a function to update admin password securely
-- This function verifies the current password before updating
create or replace function update_admin_password(
  admin_email text,
  current_password text,
  new_password text
)
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  password_valid boolean;
begin
  -- Verify current password
  select verify_admin_password(admin_email, current_password) into password_valid;
  
  if not password_valid then
    return false;
  end if;
  
  -- Update password
  update admin_users
  set password_hash = new_password
  where lower(email) = lower(admin_email);
  
  return true;
end;
$$;

-- Grant execute permission
grant execute on function update_admin_password(text, text, text) to anon, authenticated;

