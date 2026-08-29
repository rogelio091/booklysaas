import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SignJWT } from 'jose';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  loginRequestSchema,
  createServiceSchema,
  updateServiceSchema,
  createStaffSchema,
  updateStaffSchema,
  setWorkingHoursSchema,
  createBlockedSlotSchema,
  updateAppointmentStatusSchema,
  updateCompanySettingsSchema,
} from '@bookly/contracts';
import { authMiddleware } from '../middleware/auth';
import { verifyPassword } from '../utils/password';
import {
  users,
  companies,
  services,
  staffServices,
  workingHours,
  blockedSlots,
  appointments,
  customers,
} from '../db/schema';
import { withTenant } from '../db/client';
import type { AppContext } from '../types';

export const adminRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Auth Público: Login
// ---------------------------------------------------------------------------
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

  // Anti-enumeración: mismo error para usuario inexistente y password incorrecta.
  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return c.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } },
      401,
    );
  }

  // Token JWT firmado con HMAC SHA-256
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

// ---------------------------------------------------------------------------
// Rutas Protegidas de Administración
// ---------------------------------------------------------------------------
const protectedAdmin = new Hono<AppContext>();
protectedAdmin.use('*', authMiddleware);

// --- 1. CRUD de Servicios ---
protectedAdmin.get('/services', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const list = await db.query.services.findMany({
    where: withTenant(services, companyId),
    orderBy: [services.displayOrder],
  });

  return c.json({ success: true, data: list });
});

protectedAdmin.post('/services', zValidator('json', createServiceSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const body = c.req.valid('json');
  const db = c.get('db');

  const [service] = await db
    .insert(services)
    .values({
      ...body,
      companyId,
    })
    .returning();

  return c.json({ success: true, data: service }, 201);
});

protectedAdmin.put('/services/:id', zValidator('json', updateServiceSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const id = Number(c.req.param('id'));
  const body = c.req.valid('json');
  const db = c.get('db');

  const [updated] = await db
    .update(services)
    .set({ ...body, updatedAt: new Date() })
    .where(withTenant(services, companyId, eq(services.id, id)))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Servicio no encontrado' } }, 404);
  }

  return c.json({ success: true, data: updated });
});

protectedAdmin.delete('/services/:id', async (c) => {
  const companyId = c.get('companyId')!;
  const id = Number(c.req.param('id'));
  const db = c.get('db');

  const [deleted] = await db
    .update(services)
    .set({ isActive: false, updatedAt: new Date() })
    .where(withTenant(services, companyId, eq(services.id, id)))
    .returning();

  if (!deleted) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Servicio no encontrado' } }, 404);
  }

  return c.json({ success: true, data: deleted });
});

// --- 2. CRUD de Staff ---
protectedAdmin.get('/staff', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const staffList = await db.query.users.findMany({
    where: withTenant(users, companyId),
  });

  const staffIds = staffList.map((s) => s.id);
  const serviceRelations = staffIds.length > 0
    ? await db.query.staffServices.findMany({
        where: withTenant(staffServices, companyId, inArray(staffServices.userId, staffIds)),
      })
    : [];

  const data = staffList.map((s) => ({
    id: s.id,
    companyId: s.companyId,
    name: s.name,
    email: s.email,
    role: s.role,
    phone: s.phone,
    avatarUrl: s.avatarUrl,
    isActive: s.isActive,
    serviceIds: serviceRelations.filter((r) => r.userId === s.id).map((r) => r.serviceId),
  }));

  return c.json({ success: true, data });
});

protectedAdmin.post('/staff', zValidator('json', createStaffSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const { serviceIds, password, ...rest } = c.req.valid('json');
  const db = c.get('db');

  const [newStaff] = await db
    .insert(users)
    .values({
      ...rest,
      passwordHash: password, // En producción usar Web Crypto hash
      companyId,
    })
    .returning();

  if (serviceIds && serviceIds.length > 0) {
    await db.insert(staffServices).values(
      serviceIds.map((serviceId) => ({
        companyId,
        userId: newStaff.id,
        serviceId,
      })),
    );
  }

  return c.json(
    {
      success: true,
      data: {
        ...newStaff,
        serviceIds: serviceIds ?? [],
      },
    },
    201,
  );
});

protectedAdmin.put('/staff/:id', zValidator('json', updateStaffSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const id = Number(c.req.param('id'));
  const { serviceIds, newPassword, ...rest } = c.req.valid('json');
  const db = c.get('db');

  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (newPassword) {
    updateData['passwordHash'] = newPassword;
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(withTenant(users, companyId, eq(users.id, id)))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Staff no encontrado' } }, 404);
  }

  if (serviceIds !== undefined) {
    await db.delete(staffServices).where(withTenant(staffServices, companyId, eq(staffServices.userId, id)));
    if (serviceIds.length > 0) {
      await db.insert(staffServices).values(
        serviceIds.map((serviceId) => ({
          companyId,
          userId: id,
          serviceId,
        })),
      );
    }
  }

  return c.json({
    success: true,
    data: {
      ...updated,
      serviceIds: serviceIds ?? [],
    },
  });
});

// --- 3. Horarios Laborales ---
protectedAdmin.get('/schedule/working-hours', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const hours = await db.query.workingHours.findMany({
    where: withTenant(workingHours, companyId),
  });

  return c.json({ success: true, data: hours });
});

protectedAdmin.post('/schedule/working-hours', zValidator('json', setWorkingHoursSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const { hours } = c.req.valid('json');
  const db = c.get('db');

  // Reemplazar horarios existentes
  await db.delete(workingHours).where(withTenant(workingHours, companyId));

  if (hours.length > 0) {
    await db.insert(workingHours).values(
      hours.map((h) => ({
        companyId,
        userId: h.userId ?? null,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        breakStartTime: h.breakStartTime ?? null,
        breakEndTime: h.breakEndTime ?? null,
        isActive: h.isActive ?? true,
      })),
    );
  }

  return c.json({ success: true, message: 'Horarios actualizados correctamente' });
});

// --- 4. Bloqueos de Horario ---
protectedAdmin.get('/schedule/blocks', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const blocks = await db.query.blockedSlots.findMany({
    where: withTenant(blockedSlots, companyId),
    orderBy: [desc(blockedSlots.startAt)],
  });

  return c.json({
    success: true,
    data: blocks.map((b) => ({
      id: b.id,
      companyId: b.companyId,
      userId: b.userId,
      startAt: b.startAt.getTime(),
      endAt: b.endAt.getTime(),
      reason: b.reason,
    })),
  });
});

protectedAdmin.post('/schedule/blocks', zValidator('json', createBlockedSlotSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const body = c.req.valid('json');
  const db = c.get('db');

  const [block] = await db
    .insert(blockedSlots)
    .values({
      companyId,
      userId: body.userId ?? null,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      reason: body.reason ?? null,
    })
    .returning();

  return c.json(
    {
      success: true,
      data: {
        id: block.id,
        companyId: block.companyId,
        userId: block.userId,
        startAt: block.startAt.getTime(),
        endAt: block.endAt.getTime(),
        reason: block.reason,
      },
    },
    201,
  );
});

protectedAdmin.delete('/schedule/blocks/:id', async (c) => {
  const companyId = c.get('companyId')!;
  const id = Number(c.req.param('id'));
  const db = c.get('db');

  const [deleted] = await db
    .delete(blockedSlots)
    .where(withTenant(blockedSlots, companyId, eq(blockedSlots.id, id)))
    .returning();

  if (!deleted) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Bloqueo no encontrado' } }, 404);
  }

  return c.json({ success: true, data: deleted });
});

// --- 5. Citas y Actualización de Estado ---
protectedAdmin.get('/appointments', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const list = await db.query.appointments.findMany({
    where: withTenant(appointments, companyId),
    orderBy: [desc(appointments.startAt)],
    limit: 100,
  });

  const customerIds = list.map((a) => a.customerId);
  const staffIds = list.map((a) => a.staffId).filter((id): id is number => id !== null);

  const customerMap = customerIds.length > 0
    ? await db.query.customers.findMany({
        where: withTenant(customers, companyId, inArray(customers.id, customerIds)),
      })
    : [];

  const staffMap = staffIds.length > 0
    ? await db.query.users.findMany({
        where: withTenant(users, companyId, inArray(users.id, staffIds)),
      })
    : [];

  const data = list.map((a) => {
    const cust = customerMap.find((c) => c.id === a.customerId);
    const st = staffMap.find((s) => s.id === a.staffId);
    return {
      id: a.id,
      companyId: a.companyId,
      customerId: a.customerId,
      customerName: cust?.name ?? 'Cliente Desconocido',
      customerPhone: cust?.phone ?? '',
      staffId: a.staffId,
      staffName: st?.name ?? null,
      status: a.status,
      startAt: a.startAt.getTime(),
      endAt: a.endAt.getTime(),
      source: a.source,
      cancellationReason: a.cancellationReason,
      notes: a.notes,
    };
  });

  return c.json({ success: true, data });
});

protectedAdmin.patch('/appointments/:id/status', zValidator('json', updateAppointmentStatusSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const id = Number(c.req.param('id'));
  const { status, cancellationReason } = c.req.valid('json');
  const db = c.get('db');

  const [updated] = await db
    .update(appointments)
    .set({
      status,
      cancellationReason: cancellationReason ?? null,
      updatedAt: new Date(),
    })
    .where(withTenant(appointments, companyId, eq(appointments.id, id)))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Cita no encontrada' } }, 404);
  }

  return c.json({ success: true, data: updated });
});

// --- 6. Configuración de la Empresa / Tenant (Tema, Marca, etc.) ---
protectedAdmin.get('/company/settings', async (c) => {
  const companyId = c.get('companyId')!;
  const db = c.get('db');

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } }, 404);
  }

  return c.json({
    success: true,
    data: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      timezone: company.timezone,
      brandColor: company.brandColor,
      logoUrl: company.logoUrl,
      theme: company.theme,
      subscriptionStatus: company.subscriptionStatus,
    },
  });
});

protectedAdmin.patch('/company/settings', zValidator('json', updateCompanySettingsSchema), async (c) => {
  const companyId = c.get('companyId')!;
  const body = c.req.valid('json');
  const db = c.get('db');

  const [updated] = await db
    .update(companies)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } }, 404);
  }

  return c.json({ success: true, data: updated });
});

adminRoutes.route('/', protectedAdmin);
