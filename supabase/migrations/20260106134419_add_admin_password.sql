-- Add password column to admin_users table
alter table admin_users add column if not exists password_hash text;

-- Create function to verify admin password
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
  
  -- Simple comparison for now (you can use crypt/compare for better security)
  -- For production, consider using pgcrypto extension
  return stored_hash = provided_password;
end;
$$;

-- Grant execute permission on the function to authenticated users (or anon for simplicity)
grant execute on function verify_admin_password(text, text) to anon, authenticated;
