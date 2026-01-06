-- Update generate_temp_password to generate 6-character passwords
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

