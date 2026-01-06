-- Add admin email to admin_users table
INSERT INTO admin_users (email) VALUES ('ddweck@ebillity.com')
ON CONFLICT (email) DO NOTHING;
