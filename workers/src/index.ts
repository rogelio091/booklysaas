import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { createDbClient } from './db/client';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';
import { webhookRoutes } from './routes/webhooks';
import type { AppContext } from './types';

const app = new Hono<AppContext>();

// Middlewares globales
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: (origin) => origin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Inyección de D1 Database y Drizzle en el contexto de Hono
app.use('*', async (c, next) => {
  if (c.env?.DB) {
    const db = createDbClient(c.env.DB);
    c.set('db', db);
  }
  await next();
});

// Manejador global de errores
app.onError((err, c) => {
  console.error(`[Unhandled Error] ${c.req.method} ${c.req.url}:`, err);
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          c.env?.ENVIRONMENT === 'production'
            ? 'Ha ocurrido un error inesperado'
            : err.message,
      },
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Ruta ${c.req.method} ${c.req.path} no encontrada`,
      },
    },
    404,
  );
});

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: Date.now(),
    env: c.env?.ENVIRONMENT ?? 'unknown',
  }),
);

// Montaje de rutas
app.route('/api/public', publicRoutes);
app.route('/api', adminRoutes);
app.route('/webhooks', webhookRoutes);

export default app;
