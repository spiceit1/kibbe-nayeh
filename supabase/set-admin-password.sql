-- Set password for an admin user
-- Usage: Update the email and password values below, then run this in Supabase SQL Editor

-- Example: Set password for ddweck@ebillity.com
update admin_users 
set password_hash = 'your-password-here'
where email = 'ddweck@ebillity.com';

-- To set password for multiple admins:
-- update admin_users set password_hash = 'password123' where email = 'admin1@example.com';
-- update admin_users set password_hash = 'password456' where email = 'admin2@example.com';
