import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { companies, payments, invoices } from '../db/schema';
import type { AppContext } from '../types';

export const webhookRoutes = new Hono<AppContext>();

/**
 * Valida la firma HMAC SHA-256 de webhooks entrantes usando Web Crypto API
 */
export async function verifyHmacSha256(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Firma en hexadecimal a Uint8Array
    const cleanSignature = signature.trim().toLowerCase();
    const sigBytes = new Uint8Array(
      cleanSignature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(payload),
    );
  } catch (err) {
    console.error('[HMAC Verification Error]', err);
    return false;
  }
}

/**
 * Webhook de Recurrente (Pagos, Suscripciones y Señas)
 */
webhookRoutes.post('/recurrente', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Recurrente-Signature') || c.req.header('x-signature');
  const secret = c.env.RECURRENTE_WEBHOOK_SECRET;

  if (secret && signature) {
    const isValid = await verifyHmacSha256(rawBody, signature, secret);
    if (!isValid) {
      return c.json({ success: false, error: 'INVALID_SIGNATURE' }, 401);
    }
  }

  let event: { event_type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ success: false, error: 'MALFORMED_JSON' }, 400);
  }

  const db = c.get('db');
  const eventType = event.event_type || 'unknown';
  console.log(`[Recurrente Webhook] Recibido evento: ${eventType}`);

  switch (eventType) {
    // 1. Suscripción Pagada / Renovada
    case 'subscription.paid':
    case 'invoice.paid': {
      const subscriptionId = String(event.data?.['subscription_id'] || '');
      if (subscriptionId) {
        await db
          .update(companies)
          .set({ subscriptionStatus: 'active', updatedAt: new Date() })
          .where(eq(companies.recurrenteSubscriptionId, subscriptionId));
      }
      break;
    }

    // 2. Pago Fallido / Suscripción Cancelada
    case 'payment.failed':
    case 'subscription.canceled': {
      const subscriptionId = String(event.data?.['subscription_id'] || '');
      if (subscriptionId) {
        await db
          .update(companies)
          .set({ subscriptionStatus: 'canceled', updatedAt: new Date() })
          .where(eq(companies.recurrenteSubscriptionId, subscriptionId));
      }
      break;
    }

    // 3. Pago individual de cita / seña
    case 'charge.succeeded': {
      const paymentId = String(event.data?.['id'] || '');
      const amountQtz = Number(event.data?.['amount_in_cents'] || 0);
      const companyId = Number(event.data?.['metadata'] ? (event.data['metadata'] as Record<string, unknown>)['company_id'] : 0);

      if (companyId && paymentId) {
        await db.insert(payments).values({
          companyId,
          gateway: 'recurrente',
          gatewayPaymentId: paymentId,
          amountQtz,
          status: 'succeeded',
          cardBrand: String(event.data?.['card_brand'] || 'visa'),
          cardLastFour: String(event.data?.['card_last_four'] || '0000'),
          rawGatewayResponse: rawBody,
        });
      }
      break;
    }

    default:
      console.log(`[Recurrente Webhook] Evento no manejado: ${eventType}`);
  }

  return c.json({ success: true, received: true });
});
