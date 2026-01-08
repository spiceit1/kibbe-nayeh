import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import twilio from 'twilio'
import type { CheckoutPayload } from '../../src/lib/types'
import { calculateOrderTotals } from '../../src/lib/pricing'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendKey = process.env.RESEND_API_KEY
const twilioSid = process.env.TWILIO_ACCOUNT_SID
const twilioAuth = process.env.TWILIO_AUTH_TOKEN
const twilioFrom = process.env.TWILIO_FROM_NUMBER
const siteUrl = process.env.SITE_URL || process.env.URL || 'http://localhost:8888'

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null
const resend = resendKey ? new Resend(resendKey) : null
const sms = twilioSid && twilioAuth ? twilio(twilioSid, twilioAuth) : null

export const handler: Handler = async (event) => {
  if (!supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured.' }) }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const payload = JSON.parse(event.body || '{}') as CheckoutPayload
    
    // Validate items and availability
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('No items provided')
    }

    const sizeIds = payload.items.map((i) => i.size_id)
    const { data: sizes, error: sizesError } = await supabase
      .from('product_sizes')
      .select('*')
      .in('id', sizeIds)
      .eq('is_active', true)

    if (sizesError) throw new Error('Failed to load sizes')
    if (!sizes || sizes.length !== sizeIds.length) throw new Error('Some sizes unavailable')

    // Map sizes for quick lookup
    const sizeMap = new Map(sizes.map((s) => [s.id, s]))

    // Ensure availability
    for (const item of payload.items) {
      const size = sizeMap.get(item.size_id)
      if (!size) throw new Error('Size unavailable')
      if (size.available_qty < item.quantity) throw new Error(`Insufficient quantity for ${size.name}`)
    }

    // Get settings
    const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle()
    if (!settings?.venmo_address) throw new Error('Venmo address not configured')
    
    const totals = calculateOrderTotals(
      payload.items.map((item) => ({
        size: sizeMap.get(item.size_id)!,
        quantity: item.quantity,
      })),
      settings,
      payload.fulfillment_method,
    )

    // Find or create customer
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', payload.customer.email)
      .eq('phone', payload.customer.phone)
      .maybeSingle()

    let customerId: string | null = null
    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone,
        })
        .select('id')
        .single()
      if (customerError) throw new Error('Failed to create customer')
      customerId = newCustomer.id
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        fulfillment_method: payload.fulfillment_method,
        status: 'Outstanding',
        subtotal_cents: totals.base,
        pickup_discount_cents: totals.pickupDiscount,
        delivery_fee_cents: totals.deliveryFee,
        total_cents: totals.total,
        payment_status: 'pending',
        notes: payload.notes || null,
        delivery_address:
          payload.fulfillment_method === 'delivery'
            ? {
                address: payload.customer.address,
                city: payload.customer.city,
                state: payload.customer.state,
                postal_code: payload.customer.postal_code,
              }
            : null,
      })
      .select('id, order_number')
      .single()

    if (orderError || !order) throw new Error('Failed to create order')

    // Create order items
    const orderItemsPayload = payload.items.map((item) => {
      const size = sizeMap.get(item.size_id)!
      return {
        order_id: order.id,
        size_id: size.id,
        size_name: size.name,
        unit_label: size.unit_label,
        quantity: item.quantity,
        price_cents: size.price_cents,
      }
    })

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsPayload)
    if (itemsError) throw new Error('Failed to create order items')

    // Create status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'Outstanding',
      note: 'Order created, awaiting Venmo payment',
    })

    // Decrement available quantity
    for (const item of payload.items) {
      const size = sizeMap.get(item.size_id)!
      await supabase
        .from('product_sizes')
        .update({ available_qty: Math.max(0, size.available_qty - item.quantity) })
        .eq('id', size.id)
    }

    // Prepare order details for emails/SMS
    const orderNumber = order.order_number?.toString() || order.id.slice(0, 8).toUpperCase()
    const formattedTotal = (totals.total / 100).toFixed(2)
    const deliveryAddress = payload.fulfillment_method === 'delivery' 
      ? `${payload.customer.address}, ${payload.customer.city}, ${payload.customer.state} ${payload.customer.postal_code}`
      : null

    // Send order confirmation email
    if (resend && payload.customer.email) {
      // Build Venmo payment link
      const venmoLink = `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(settings.venmo_address || '')}&amount=${formattedTotal}&note=Order%20%23${encodeURIComponent(orderNumber)}`
      console.log('=== EMAIL SENDING DEBUG ===')
      console.log('Resend configured:', !!resend)
      console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)
      console.log('Sending order confirmation email to:', payload.customer.email)
      console.log('Venmo payment link:', venmoLink)
      console.log('Venmo address:', settings.venmo_address)
      
      if (!resend) {
        console.error('❌ Resend is not configured - RESEND_API_KEY is missing or invalid')
      }
      
      try {
        const emailResult = await resend.emails.send({
          from: 'Kibbeh Nayeh <orders@notifications.anemoneking.com>',
          to: payload.customer.email,
          subject: `Order Confirmation #${orderNumber} - Kibbeh Nayeh`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8B1538;">Thank you for your order, ${payload.customer.name}!</h2>
              <p>Your order has been received and is being processed.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Order #${orderNumber}</h3>
                <p><strong>Items:</strong></p>
                <ul>
                  ${orderItemsPayload
                    .map((oi) => {
                      const unit = (oi.price_cents / 100).toFixed(2)
                      const line = ((oi.price_cents * oi.quantity) / 100).toFixed(2)
                      const unitLabel = oi.unit_label ? ` (${oi.unit_label})` : ''
                      return `<li>${oi.size_name}${unitLabel} × ${oi.quantity} — $${unit} each • $${line}</li>`
                    })
                    .join('')}
                </ul>
                <p><strong>Fulfillment:</strong> ${payload.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                ${deliveryAddress ? `<p><strong>Delivery Address:</strong><br>${deliveryAddress}</p>` : ''}
                ${payload.notes ? `<p><strong>Notes:</strong> ${payload.notes}</p>` : ''}
              </div>

              <div style="background: #fff; border: 2px solid #8B1538; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #8B1538; margin-top: 0;">Payment Instructions</h3>
                <p><strong>Please send payment via Venmo to:</strong></p>
                <p style="font-size: 20px; font-weight: bold; color: #8B1538;">${settings.venmo_address}</p>
                <p><strong>Amount:</strong> $${formattedTotal} ${settings.currency || 'USD'}</p>
                <p style="color: #666; font-size: 12px;">Please include order number #${orderNumber} in your Venmo payment note.</p>
                <div style="margin-top: 20px; text-align: center;">
                  <a href="${venmoLink}" 
                     style="display: inline-block; color: #3D95CE; text-decoration: none; font-weight: bold; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    💰 Pay with Venmo
                  </a>
                </div>
                <p style="margin-top: 15px; color: #666; font-size: 12px; text-align: center;">
                  Click the button above to open Venmo with payment details pre-filled (recipient: ${settings.venmo_address}, amount: $${formattedTotal}, note: Order #${orderNumber})
                </p>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="margin: 0;"><strong>Subtotal:</strong> $${(totals.base / 100).toFixed(2)}</p>
                ${totals.pickupDiscount > 0 ? `<p style="margin: 0;"><strong>Pickup Discount:</strong> -$${(totals.pickupDiscount / 100).toFixed(2)}</p>` : ''}
                ${totals.deliveryFee > 0 ? `<p style="margin: 0;"><strong>Delivery Fee:</strong> $${(totals.deliveryFee / 100).toFixed(2)}</p>` : ''}
                <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;"><strong>Total:</strong> $${formattedTotal} ${settings.currency || 'USD'}</p>
              </div>

              <p style="margin-top: 30px; color: #666; font-size: 12px;">
                Your order status will be updated once payment is received. 
                You can view your order confirmation at: <a href="${siteUrl}/order-confirmation?order_id=${order.id}">${siteUrl}/order-confirmation?order_id=${order.id}</a>
              </p>
            </div>
          `,
        })

        console.log('Order confirmation email result:', JSON.stringify(emailResult, null, 2))
        
        if (emailResult.error) {
          console.error('❌ Resend API error for order confirmation:', emailResult.error)
        } else {
          console.log('✅ Order confirmation email sent successfully, ID:', emailResult.data?.id)
        }
      } catch (emailError) {
        console.error('❌ Error sending order confirmation email:', emailError)
        // Don't fail the order if email fails
      }
    } else {
      console.warn('⚠️ Email not sent - Resend not configured or no customer email')
      if (!resend) {
        console.warn('⚠️ RESEND_API_KEY is missing or invalid')
      }
      if (!payload.customer.email) {
        console.warn('⚠️ Customer email is missing')
      }
    }

    // Send SMS via Twilio
    if (sms && twilioFrom && payload.customer.phone) {
      try {
        const phoneNumber = payload.customer.phone.replace(/\D/g, '') // Remove non-digits
        console.log('Attempting to send SMS via Twilio to phone:', phoneNumber)
        
        if (phoneNumber.length === 10) {
          const smsMessage = `Kibbeh Nayeh order #${orderNumber} confirmed. ${size.name} x${payload.quantity}. Pay $${formattedTotal} to ${settings.venmo_address} via Venmo.`
          
          const twilioResult = await sms.messages.create({
            from: twilioFrom,
            to: `+1${phoneNumber}`, // Add US country code
            body: smsMessage,
          })
          
          console.log('Twilio SMS sent successfully, SID:', twilioResult.sid)
        } else {
          console.warn('Invalid phone number format for SMS:', payload.customer.phone)
        }
      } catch (smsError) {
        console.error('Error sending SMS via Twilio:', smsError)
        // SMS is optional, don't fail if it doesn't work
      }
    } else if (payload.customer.phone) {
      console.warn('Twilio not configured - SMS will not be sent. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables.')
    }

    // Send notifications to all admins with notifications enabled

    // Get all admins with notifications enabled
    const { data: adminsWithNotifications } = await supabase
      .from('admin_users')
      .select('notification_email, notification_phone, email_notifications_enabled, sms_notifications_enabled')
      .or('email_notifications_enabled.eq.true,sms_notifications_enabled.eq.true')

    if (adminsWithNotifications && adminsWithNotifications.length > 0) {
      // Send email notifications to all admins with email enabled
      const emailRecipients = adminsWithNotifications
        .filter(admin => admin.email_notifications_enabled && admin.notification_email)
        .map(admin => admin.notification_email)
        .filter((email): email is string => !!email)

      if (resend && emailRecipients.length > 0) {
        console.log('Sending admin notification emails to:', emailRecipients)
        try {
          // Send to all recipients
          const emailPromises = emailRecipients.map(async (email) => {
            try {
              const result = await resend.emails.send({
                from: 'Kibbeh Nayeh <orders@notifications.anemoneking.com>',
                to: email,
                subject: `New Order #${orderNumber} - ${payload.customer.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #8B1538;">New Order Received</h2>
                    <p>A new order has been placed and requires your attention.</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0;">Order #${orderNumber}</h3>
                      <p><strong>Customer:</strong> ${payload.customer.name}</p>
                      <p><strong>Email:</strong> ${payload.customer.email}</p>
                      <p><strong>Phone:</strong> ${payload.customer.phone}</p>
                      <p><strong>Item:</strong> ${size.name} x ${payload.quantity}</p>
                      <p><strong>Fulfillment:</strong> ${payload.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                      ${deliveryAddress ? `<p><strong>Delivery Address:</strong><br>${deliveryAddress}</p>` : ''}
                      ${payload.notes ? `<p><strong>Customer Notes:</strong> ${payload.notes}</p>` : ''}
                    </div>

                    <div style="background: #fff; border: 2px solid #8B1538; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="color: #8B1538; margin-top: 0;">Order Summary</h3>
                      <p style="margin: 0;"><strong>Subtotal:</strong> $${(totals.base / 100).toFixed(2)}</p>
                      ${totals.pickupDiscount > 0 ? `<p style="margin: 0;"><strong>Pickup Discount:</strong> -$${(totals.pickupDiscount / 100).toFixed(2)}</p>` : ''}
                      ${totals.deliveryFee > 0 ? `<p style="margin: 0;"><strong>Delivery Fee:</strong> $${(totals.deliveryFee / 100).toFixed(2)}</p>` : ''}
                      <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;"><strong>Total:</strong> $${formattedTotal} ${settings.currency || 'USD'}</p>
                      <p style="margin-top: 10px;"><strong>Payment:</strong> Venmo to ${settings.venmo_address}</p>
                    </div>

                    <p style="margin-top: 30px; color: #666; font-size: 12px;">
                      View and manage this order in the admin portal.
                    </p>
                  </div>
                `,
              })
              if (result.error) {
                console.error(`Error sending email to ${email}:`, result.error)
              } else {
                console.log(`Admin notification email sent to ${email}, ID:`, result.data?.id)
              }
            } catch (emailError) {
              console.error(`Error sending email to ${email}:`, emailError)
            }
          })
          await Promise.all(emailPromises)
        } catch (adminEmailError) {
          console.error('Error sending admin notification emails:', adminEmailError)
        }
      }

      // Send SMS notifications to all admins with SMS enabled
      const smsRecipients = adminsWithNotifications
        .filter(admin => admin.sms_notifications_enabled && admin.notification_phone)

      if (sms && twilioFrom && smsRecipients.length > 0) {
        console.log('Sending admin notification SMS to', smsRecipients.length, 'admins')
        const smsPromises = smsRecipients.map(async (admin) => {
          try {
            const phoneNumber = admin.notification_phone?.replace(/\D/g, '') || ''
            if (phoneNumber.length === 10) {
              const adminSmsMessage = `New order #${orderNumber}: ${payload.customer.name} - ${size.name} x${payload.quantity} - $${formattedTotal} (${payload.fulfillment_method})`
              
              const twilioResult = await sms.messages.create({
                from: twilioFrom,
                to: `+1${phoneNumber}`,
                body: adminSmsMessage,
              })
              
              console.log(`Admin notification SMS sent to ${phoneNumber}, SID:`, twilioResult.sid)
            } else {
              console.warn('Invalid phone number format for SMS:', admin.notification_phone)
            }
          } catch (smsError) {
            console.error('Error sending SMS to admin:', smsError)
          }
        })
        await Promise.all(smsPromises)
      }
    }

    // Return order details with Venmo info
    return {
      statusCode: 200,
      body: JSON.stringify({
        order_id: order.id,
        total_cents: totals.total,
        currency: settings.currency || 'USD',
        venmo_address: settings.venmo_address,
        order_number: order.order_number?.toString() || order.id.slice(0, 8).toUpperCase(),
      }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    }
  }
}

