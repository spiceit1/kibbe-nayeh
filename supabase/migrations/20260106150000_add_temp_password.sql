-- Add temporary password field to admin_users
alter table admin_users add column if not exists temp_password text;
alter table admin_users add column if not exists temp_password_expires_at timestamptz;

-- Function to generate and store temporary password
create or replace function generate_temp_password(admin_email text)
returns text
security definer
set search_path = public
language plpgsql
as $$
declare
  temp_pass text;
  expires_at timestamptz;
  chars text := '123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'; -- Excludes 0, O, o
  i integer;
  char_pos integer;
begin
  -- Generate a random 6-character temporary password without 0, O, or o
  temp_pass := '';
  for i in 1..6 loop
    char_pos := floor(random() * length(chars) + 1)::integer;
    temp_pass := temp_pass || substring(chars from char_pos for 1);
  end loop;
  
  -- Set expiration to 1 hour from now
  expires_at := now() + interval '1 hour';
  
  -- Update admin_users with temporary password
  update admin_users
  set temp_password = temp_pass,
      temp_password_expires_at = expires_at
  where lower(email) = lower(admin_email);
  
  -- Return the temporary password (in production, this would be sent via email)
  return temp_pass;
end;
$$;

-- Grant execute permission
grant execute on function generate_temp_password(text) to anon, authenticated;

-- Function to reset password using temporary password
create or replace function reset_password_with_temp(
  admin_email text,
  temp_password text,
  new_password text
)
returns boolean
security definer
set search_path = public
language plpgsql
as $$
declare
  stored_temp text;
  expires_at timestamptz;
begin
  -- Get temporary password and expiration
  select au.temp_password, au.temp_password_expires_at
  into stored_temp, expires_at
  from admin_users au
  where lower(au.email) = lower(admin_email);
  
  -- Check if temporary password exists and matches
  if stored_temp is null or stored_temp != temp_password then
    return false;
  end if;
  
  -- Check if temporary password has expired
  if expires_at is null or expires_at < now() then
    return false;
  end if;
  
  -- Update password and clear temporary password
  update admin_users
  set password_hash = new_password,
      temp_password = null,
      temp_password_expires_at = null
  where lower(email) = lower(admin_email);
  
  return true;
end;
$$;

-- Grant execute permission
grant execute on function reset_password_with_temp(text, text, text) to anon, authenticated;

