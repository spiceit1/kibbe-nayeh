-- Add admin email to admin_users table
INSERT INTO admin_users (email) VALUES ('ddweck@ebillity.com')
ON CONFLICT (email) DO NOTHING;

-- Verify the email was added
SELECT * FROM admin_users WHERE email = 'ddweck@ebillity.com';

