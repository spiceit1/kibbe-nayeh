# Email Setup Instructions

This project uses **Resend** (free tier: 3,000 emails/month) for sending emails via Netlify Functions.

## Setup Steps

### 1. Create a Resend Account (Free)
1. Go to https://resend.com
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key
1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name it (e.g., "Kibbeh Nayeh Production")
4. Copy the API key (starts with `re_`)

### 3. Add API Key to Netlify
1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add a variable**
4. Add:
   - **Key**: `RESEND_API_KEY`
   - **Value**: Your Resend API key (paste the `re_...` key)
5. Click **Save**

### 4. Update Email From Address (Optional)
The default "from" address is `orders@kibbehnayeh.com`. To use a custom domain:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `kibbehnayeh.com`)
3. Follow DNS setup instructions
4. Once verified, update the `from` addresses in:
   - `netlify/functions/send-temp-password-email.ts`
   - `netlify/functions/create-venmo-order.ts`

## What Gets Sent

### 1. Temporary Password Emails
- **When**: Admin requests password reset
- **To**: Admin email address
- **Contains**: 6-digit temporary password

### 2. Order Confirmation Emails
- **When**: Customer places an order (Venmo)
- **To**: Customer email address
- **Contains**: Order details, payment instructions, Venmo address

### 3. SMS Notifications (via Email-to-SMS)
- **When**: Customer places an order
- **To**: Customer phone number (via email-to-SMS gateway)
- **Note**: Free but carrier-dependent, may not work for all carriers

## Free Tier Limits
- **Resend**: 3,000 emails/month, 100 emails/day
- **Netlify Functions**: 125,000 requests/month (free tier)

## Testing
After setting up the API key, test by:
1. Requesting a password reset from the admin login page
2. Placing a test order

If emails don't send, check:
- Netlify function logs (Site → Functions → View logs)
- Resend dashboard for delivery status
- Environment variable is set correctly

