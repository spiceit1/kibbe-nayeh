import { Handler } from '@netlify/functions'
import { Resend } from 'resend'

const resendKey = process.env.RESEND_API_KEY
const resend = resendKey ? new Resend(resendKey) : null

export const handler: Handler = async (event) => {
  console.log('send-temp-password-email function called')
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)
  
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod)
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  if (!resend) {
    console.error('Resend not configured - RESEND_API_KEY missing or invalid')
    return { statusCode: 500, body: JSON.stringify({ error: 'Email service not configured. RESEND_API_KEY is missing or invalid.' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { email, tempPassword } = body
    console.log('Parsed request:', { email, tempPasswordExists: !!tempPassword })

    if (!email || !tempPassword) {
      console.error('Missing required fields:', { email: !!email, tempPassword: !!tempPassword })
      return { statusCode: 400, body: JSON.stringify({ error: 'Email and tempPassword required' }) }
    }

    console.log('Sending email via Resend to:', email)
    const result = await resend.emails.send({
      from: 'Kibbeh Nayeh <noreply@notifications.anemoneking.com>',
      to: email,
      subject: 'Your temporary password for Kibbeh Nayeh Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B1538;">Kibbeh Nayeh Admin Password Reset</h2>
          <p>You requested a temporary password to reset your admin account.</p>
          <p><strong>Your temporary password is: <span style="font-size: 24px; letter-spacing: 4px; color: #8B1538;">${tempPassword}</span></strong></p>
          <p>This password will expire in 1 hour.</p>
          <p>Please use this temporary password to set a new password for your account.</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">If you didn't request this password reset, please ignore this email.</p>
        </div>
      `,
    })

    console.log('Resend API response:', result)
    
    if (result.error) {
      console.error('Resend API error:', result.error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: result.error.message || 'Failed to send email' }),
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Temporary password email sent', id: result.data?.id }),
    }
  } catch (error) {
    console.error('Error sending temp password email:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    }
  }
}

