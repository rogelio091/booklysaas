import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignJWT } from 'jose';
import { eq, and, desc } from 'drizzle-orm';
import { loginRequestSchema } from '@bookly/contracts';
import { authMiddleware } from '../middleware/auth';
import { users, companies, appointments, customers } from '../db/schema';
import type { AppContext } from '../types';

export const adminRoutes = new Hono<AppContext>();

// Auth: Login
adminRoutes.post('/auth/login', zValidator('json', loginRequestSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = c.get('db');

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), eq(users.isActive, true)),
  });

  if (!user) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } },
      401,
    );
  }

  // En producción se valida passwordHash con Web Crypto / Argon2
  const secret = new TextEncoder().encode(c.env.JWT_SECRET);
  const token = await new SignJWT({
    sub: String(user.id),
    companyId: user.companyId,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    },
  });
});

// Rutas protegidas
const protectedAdmin = new Hono<AppContext>();
protectedAdmin.use('*', authMiddleware);

// Listar Citas del Tenant
protectedAdmin.get('/appointments', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const list = await db.query.appointments.findMany({
    where: eq(appointments.companyId, companyId),
    orderBy: [desc(appointments.startAt)],
    limit: 50,
  });

  return c.json({ success: true, data: list });
});

adminRoutes.route('/', protectedAdmin);
