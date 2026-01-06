-- Create RPC function to get user notification settings (bypasses RLS)
create or replace function get_user_notifications(admin_email text)
returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  is_admin_user boolean;
  user_data jsonb;
begin
  -- Verify admin
  select exists (
    select 1 from admin_users au
    where lower(au.email) = lower(admin_email)
  ) into is_admin_user;
  
  if not is_admin_user then
    raise exception 'Unauthorized: Admin access required';
  end if;
  
  -- Get user notification settings
  select row_to_json(au)::jsonb into user_data
  from admin_users au
  where lower(au.email) = lower(admin_email);
  
  return user_data;
end;
$$;

-- Grant execute permission
grant execute on function get_user_notifications(text) to anon, authenticated;

