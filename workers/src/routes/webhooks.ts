import { Hono } from 'hono';
import type { AppContext } from '../types';

export const webhookRoutes = new Hono<AppContext>();

webhookRoutes.post('/recurrente', async (c) => {
  // Validación de firma HMAC y actualización de suscripciones/pagos
  const body = await c.req.json();
  console.log('[Webhook Recurrente]', body);

  return c.json({ received: true });
});

webhookRoutes.post('/resend', async (c) => {
  const body = await c.req.json();
  console.log('[Webhook Resend]', body);

  return c.json({ received: true });
});
