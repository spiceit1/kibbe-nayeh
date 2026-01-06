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
    
    // Validate size availability
    const { data: size, error: sizeError } = await supabase
      .from('product_sizes')
      .select('*')
      .eq('id', payload.size_id)
      .eq('is_active', true)
      .maybeSingle()
    if (sizeError || !size) throw new Error('Size unavailable')
    if (size.available_qty < payload.quantity) throw new Error('Insufficient quantity available')

    // Get settings
    const { data: settings } = await supabase.from('settings').select('*').limit(1).maybeSingle()
    if (!settings?.venmo_address) throw new Error('Venmo address not configured')
    
    const totals = calculateOrderTotals(size, settings, payload.fulfillment_method, payload.quantity)

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
      .select('id')
      .single()

    if (orderError || !order) throw new Error('Failed to create order')

    // Create order items
    const { error: itemsError } = await supabase.from('order_items').insert({
      order_id: order.id,
      size_id: size.id,
      size_name: size.name,
      unit_label: size.unit_label,
      quantity: payload.quantity,
      price_cents: size.price_cents,
    })

    if (itemsError) throw new Error('Failed to create order items')

    // Create status history
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'Outstanding',
      note: 'Order created, awaiting Venmo payment',
    })

    // Decrement available quantity
    await supabase
      .from('product_sizes')
      .update({ available_qty: Math.max(0, size.available_qty - payload.quantity) })
      .eq('id', size.id)

    // Send order confirmation email
    if (resend && payload.customer.email) {
      const orderNumber = order.id.slice(0, 8).toUpperCase()
      const formattedTotal = (totals.total / 100).toFixed(2)
      const deliveryAddress = payload.fulfillment_method === 'delivery' 
        ? `${payload.customer.address}, ${payload.customer.city}, ${payload.customer.state} ${payload.customer.postal_code}`
        : null

      console.log('Sending order confirmation email to:', payload.customer.email)
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
                <p><strong>Item:</strong> ${size.name} x ${payload.quantity}</p>
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

        console.log('Order confirmation email result:', emailResult)
        
        if (emailResult.error) {
          console.error('Resend API error for order confirmation:', emailResult.error)
        } else {
          console.log('Order confirmation email sent successfully, ID:', emailResult.data?.id)
        }
      } catch (emailError) {
        console.error('Error sending order confirmation email:', emailError)
        // Don't fail the order if email fails
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
    }

    // Return order details with Venmo info
    return {
      statusCode: 200,
      body: JSON.stringify({
        order_id: order.id,
        total_cents: totals.total,
        currency: settings.currency || 'USD',
        venmo_address: settings.venmo_address,
        order_number: order.id.slice(0, 8).toUpperCase(),
      }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    }
  }
}

