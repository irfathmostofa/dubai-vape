import { Resend } from 'resend';
import { db } from '../db/index.ts';
import { emailLogs } from '../db/schema.ts';

export interface SendOrderEmailInput {
  orderNumber: string;
  recipientEmail: string;
  customerName: string;
  statusLabel: string;
  totalAed: string;
  emirate: string;
  emailType: 'order_confirmation' | 'status_update' | 'admin_dispatch';
}

export interface SendNewsletterLeadInput {
  recipientEmail: string;
  customerName?: string;
  discountCode: string;
}

export async function sendOrderTransactionalEmail(input: SendOrderEmailInput) {
  const subject =
    input.emailType === 'order_confirmation'
      ? `Vape Dubai King — Order #${input.orderNumber} Confirmed (${input.totalAed})`
      : `Vape Dubai King — Order #${input.orderNumber} Update: ${input.statusLabel}`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #18181b; padding: 24px; background: #ffffff; color: #09090b;">
      <div style="border-bottom: 2px solid #09090b; padding-bottom: 12px; margin-bottom: 16px;">
        <strong style="font-size: 18px; letter-spacing: -0.02em;">VAPE DUBAI KING · UAE EXPRESS DISPATCH</strong>
      </div>
      <p style="font-size: 14px;">Marhaba <strong>${input.customerName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5;">
        Your UAE order <strong>#${input.orderNumber}</strong> status is now:
        <span style="background: #09090b; color: #ffffff; padding: 3px 8px; font-weight: bold;">${input.statusLabel}</span>
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e4e4e7; color: #52525b;">Destination Emirate</td>
          <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold;">${input.emirate}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e4e4e7; color: #52525b;">Amount Due (Cash / Link on Delivery)</td>
          <td style="padding: 8px; border: 1px solid #e4e4e7; font-weight: bold;">${input.totalAed}</td>
        </tr>
      </table>
      <p style="font-size: 12px; color: #71717a; margin-top: 20px;">
        ESMA UAE Standard Regulated Retailer · Strictly 21+ Adult Verification Upon Delivery.
      </p>
    </div>
  `;

  let deliveryStatus: 'sent' | 'simulated_no_api_key' | 'failed' = 'simulated_no_api_key';
  let resendMessageId: string | null = `sim_${Date.now()}`;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vape Dubai King <onboarding@resend.dev>';

  if (apiKey && apiKey !== 're_123456789_example' && !apiKey.startsWith('MY_')) {
    try {
      const resend = new Resend(apiKey);
      const response = await resend.emails.send({
        from: fromEmail,
        to: [input.recipientEmail],
        subject,
        html: htmlBody,
      });

      if (response.data?.id) {
        resendMessageId = response.data.id;
        deliveryStatus = 'sent';
      } else if (response.error) {
        console.warn('Resend API warning:', response.error);
        deliveryStatus = 'simulated_no_api_key';
      }
    } catch (err) {
      console.warn('Resend send fallback triggered:', err);
      deliveryStatus = 'simulated_no_api_key';
    }
  }

  try {
    const inserted = await db
      .insert(emailLogs)
      .values({
        orderNumber: input.orderNumber,
        recipientEmail: input.recipientEmail,
        subject,
        emailType: input.emailType,
        provider: 'resend',
        resendMessageId,
        deliveryStatus,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Failed to record email log in database:', error);
    throw new Error('Failed to log email notification.', { cause: error });
  }
}

export async function sendNewsletterWelcomeEmail(input: SendNewsletterLeadInput) {
  const discountCode = input.discountCode || 'DUBAIKING15';
  const customerName = input.customerName?.trim() || 'UAE VIP Member';
  const subject = `Vape Dubai King VIP Club — Your 15% OFF Code (${discountCode}) Inside`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #18181b; padding: 24px; background: #ffffff; color: #09090b;">
      <div style="border-bottom: 2px solid #09090b; padding-bottom: 12px; margin-bottom: 16px;">
        <strong style="font-size: 18px; letter-spacing: -0.02em;">VAPE DUBAI KING · VIP NEWSLETTER CLUB</strong>
      </div>
      <p style="font-size: 14px;">Marhaba <strong>${customerName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5;">
        Welcome to the Vape Dubai King VIP Dispatch list. Use your exclusive voucher code below for <strong>15% OFF</strong> your next Cash on Delivery order across all 7 UAE Emirates:
      </p>
      <div style="margin: 20px 0; padding: 16px; background: #09090b; color: #ffffff; text-align: center; font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 0.12em;">
        ${discountCode}
      </div>
      <p style="font-size: 12px; color: #71717a; margin-top: 20px;">
        ESMA UAE Standard Regulated Retailer · Strictly 21+ Adult Verification Mandatory.
      </p>
    </div>
  `;

  let deliveryStatus: 'sent' | 'simulated_no_api_key' | 'failed' = 'simulated_no_api_key';
  let resendMessageId: string | null = `sim_lead_${Date.now()}`;

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vape Dubai King <onboarding@resend.dev>';

  if (apiKey && apiKey !== 're_123456789_example' && !apiKey.startsWith('MY_')) {
    try {
      const resend = new Resend(apiKey);
      const response = await resend.emails.send({
        from: fromEmail,
        to: [input.recipientEmail],
        subject,
        html: htmlBody,
      });

      if (response.data?.id) {
        resendMessageId = response.data.id;
        deliveryStatus = 'sent';
      } else if (response.error) {
        console.warn('Resend newsletter API warning:', response.error);
        deliveryStatus = 'simulated_no_api_key';
      }
    } catch (err) {
      console.warn('Resend newsletter fallback triggered:', err);
      deliveryStatus = 'simulated_no_api_key';
    }
  }

  try {
    const inserted = await db
      .insert(emailLogs)
      .values({
        orderNumber: `VIP-${discountCode}`,
        recipientEmail: input.recipientEmail,
        subject,
        emailType: 'newsletter_welcome',
        provider: 'resend',
        resendMessageId,
        deliveryStatus,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Failed to record newsletter lead in database:', error);
    throw new Error('Failed to capture newsletter lead.', { cause: error });
  }
}
