import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc } from 'drizzle-orm';
import { availabilityQuerySchema, createBookingSchema } from '@bookly/contracts';
import {
  companies,
  services,
  users,
  appointments,
  appointmentItems,
  customers,
  workingHours,
  blockedSlots,
} from '../db/schema';
import { computeAvailability } from '../services/slot-engine';
import type { AppContext } from '../types';

export const publicRoutes = new Hono<AppContext>();

// 1. Obtener perfil público de la empresa por slug
publicRoutes.get('/:slug/company', async (c) => {
  const { slug } = c.req.param();
  const db = c.get('db');

  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
    columns: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      brandColor: true,
      logoUrl: true,
    },
  });

  if (!company) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' },
      },
      404,
    );
  }

  return c.json({ success: true, data: company });
});

// 2. Obtener catálogo de servicios activos
publicRoutes.get('/:slug/services', async (c) => {
  const { slug } = c.req.param();
  const db = c.get('db');

  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
    columns: { id: true },
  });

  if (!company) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } },
      404,
    );
  }

  const activeServices = await db.query.services.findMany({
    where: and(eq(services.companyId, company.id), eq(services.isActive, true)),
    columns: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceQtz: true,
    },
    orderBy: [asc(services.displayOrder)],
  });

  return c.json({ success: true, data: activeServices });
});

// 3. Obtener staff disponible
publicRoutes.get('/:slug/staff', async (c) => {
  const { slug } = c.req.param();
  const db = c.get('db');

  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
    columns: { id: true },
  });

  if (!company) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } },
      404,
    );
  }

  const staffList = await db.query.users.findMany({
    where: and(eq(users.companyId, company.id), eq(users.isActive, true)),
    columns: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  });

  return c.json({ success: true, data: staffList });
});

// 4. Consultar disponibilidad (Slot Engine)
publicRoutes.get(
  '/:slug/availability',
  zValidator('query', availabilityQuerySchema),
  async (c) => {
    const { slug } = c.req.param();
    const query = c.req.valid('query');
    const db = c.get('db');

    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, slug),
    });

    if (!company) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } },
        404,
      );
    }

    // 4. Consultar disponibilidad real con el Slot Engine
    const service = await db.query.services.findFirst({
      where: and(eq(services.companyId, company.id), eq(services.id, query.serviceId)),
    });

    if (!service) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Servicio no encontrado' } },
        404,
      );
    }

    const staffMembers = await db.query.users.findMany({
      where: and(eq(users.companyId, company.id), eq(users.isActive, true)),
      columns: { id: true, name: true },
    });

    const hours = await db.query.workingHours.findMany({
      where: and(eq(workingHours.companyId, company.id), eq(workingHours.isActive, true)),
    });

    const existingAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.companyId, company.id),
        eq(appointments.status, 'confirmed'),
      ),
    });

    const blocks = await db.query.blockedSlots.findMany({
      where: eq(blockedSlots.companyId, company.id),
    });

    const slots = computeAvailability({
      date: query.date,
      timezone: company.timezone,
      serviceDurationMinutes: service.durationMinutes,
      intervalMinutes: 15,
      workingHours: hours.map((h) => ({
        userId: h.userId,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        breakStartTime: h.breakStartTime,
        breakEndTime: h.breakEndTime,
        isActive: h.isActive,
      })),
      appointments: existingAppointments.map((a) => ({
        staffId: a.staffId,
        startAt: a.startAt.getTime(),
        endAt: a.endAt.getTime(),
        bufferAfterMinutes: a.bufferMinutes ?? 0,
      })),
      blockedSlots: blocks.map((b) => ({
        userId: b.userId,
        startAt: b.startAt.getTime(),
        endAt: b.endAt.getTime(),
      })),
      staff: staffMembers.map((s) => ({ id: s.id, name: s.name })),
      staffId: query.staffId ?? null,
    });

    return c.json({
      success: true,
      data: {
        date: query.date,
        timezone: company.timezone,
        slots,
      },
    });
  },
);

// 5. Crear reserva sin cuenta
publicRoutes.post(
  '/:slug/book',
  zValidator('json', createBookingSchema),
  async (c) => {
    const { slug } = c.req.param();
    const body = c.req.valid('json');
    const db = c.get('db');

    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, slug),
    });

    if (!company) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } },
        404,
      );
    }

    const service = await db.query.services.findFirst({
      where: and(eq(services.companyId, company.id), eq(services.id, body.serviceId)),
    });

    if (!service) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Servicio no encontrado' } },
        404,
      );
    }

    // 1. Crear o buscar cliente
    let customer = await db.query.customers.findFirst({
      where: and(eq(customers.companyId, company.id), eq(customers.phone, body.customerPhone)),
    });

    if (!customer) {
      const [newCustomer] = await db
        .insert(customers)
        .values({
          companyId: company.id,
          name: body.customerName,
          phone: body.customerPhone,
          email: body.customerEmail,
        })
        .returning();
      customer = newCustomer;
    }

    const endAt = body.startAt + service.durationMinutes * 60 * 1000;

    // 2. Insertar cita
    const [appointment] = await db
      .insert(appointments)
      .values({
        companyId: company.id,
        customerId: customer.id,
        staffId: body.staffId ?? null,
        status: 'confirmed',
        startAt: new Date(body.startAt),
        endAt: new Date(endAt),
        bufferMinutes: service.bufferAfterMinutes,
        source: 'public_portal',
        notes: body.notes,
      })
      .returning();

    // 3. Insertar ítem de cita con snapshot inmutable
    await db.insert(appointmentItems).values({
      companyId: company.id,
      appointmentId: appointment.id,
      serviceId: service.id,
      serviceName: service.name,
      priceQtz: service.priceQtz,
      durationMinutes: service.durationMinutes,
    });

    return c.json({
      success: true,
      data: {
        appointmentId: appointment.id,
        status: appointment.status,
        startAt: appointment.startAt.getTime(),
        endAt: appointment.endAt.getTime(),
        customerName: customer.name,
        serviceName: service.name,
      },
    });
  },
);
