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
  staffLocations,
  locations,
  serviceLocations,
} from '../db/schema';
import { computeAvailability } from '../services/slot-engine';
import { sendAppointmentConfirmationEmail } from '../services/notification';
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
      theme: true,
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

// 1b. Obtener ubicaciones públicas activas de la empresa
publicRoutes.get('/:slug/locations', async (c) => {
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

  const locationList = await db.query.locations.findMany({
    where: and(eq(locations.companyId, company.id), eq(locations.isActive, true)),
    columns: {
      id: true,
      name: true,
      address: true,
      slug: true,
      type: true,
      serviceRadiusKm: true,
    },
    orderBy: [asc(locations.id)],
  });

  return c.json({ success: true, data: locationList });
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

  // Filtro opcional por ubicación vía pivot service_locations.
  const locationIdRaw = c.req.query('locationId');
  const locationId = locationIdRaw ? Number(locationIdRaw) : null;

  let result = activeServices;
  if (locationId != null && Number.isInteger(locationId) && locationId > 0) {
    const relations = await db.query.serviceLocations.findMany({
      where: and(
        eq(serviceLocations.companyId, company.id),
        eq(serviceLocations.locationId, locationId),
      ),
    });

    if (relations.length > 0) {
      const serviceIds = new Set(relations.map((r) => r.serviceId));
      result = activeServices.filter((s) => serviceIds.has(s.id));
    }
  }

  return c.json({ success: true, data: result });
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

    const locationId = query.locationId ?? null;

    // staffByLocation: locationId -> staffIds asignados (pivot staff_locations).
    let staffByLocation: Map<number, number[]> | undefined;
    let eligibleStaffIds: Set<number> | undefined;

    if (locationId != null) {
      const assignments = await db.query.staffLocations.findMany({
        where: eq(staffLocations.companyId, company.id),
        columns: { userId: true, locationId: true },
      });

      staffByLocation = new Map<number, number[]>();
      for (const assignment of assignments) {
        const existing = staffByLocation.get(assignment.locationId) ?? [];
        existing.push(assignment.userId);
        staffByLocation.set(assignment.locationId, existing);
      }

      eligibleStaffIds = new Set(staffByLocation.get(locationId) ?? []);
    }

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
      locationId,
      staffByLocation,
      workingHours: hours.map((h) => ({
        userId: h.userId,
        locationId: h.locationId,
        dayOfWeek: h.dayOfWeek,
        startTime: h.startTime,
        endTime: h.endTime,
        breakStartTime: h.breakStartTime,
        breakEndTime: h.breakEndTime,
        isActive: h.isActive,
      })),
      appointments: existingAppointments.map((a) => ({
        staffId: a.staffId,
        locationId: a.locationId,
        startAt: a.startAt.getTime(),
        endAt: a.endAt.getTime(),
        bufferAfterMinutes: a.bufferMinutes ?? 0,
      })),
      blockedSlots: blocks.map((b) => ({
        userId: b.userId,
        locationId: b.locationId,
        startAt: b.startAt.getTime(),
        endAt: b.endAt.getTime(),
      })),
      staff: staffMembers
        .filter((s) => eligibleStaffIds == null || eligibleStaffIds.has(s.id))
        .map((s) => ({ id: s.id, name: s.name })),
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

    // Reservas móviles quedan 'pending' (confirmación manual del negocio).
    let status: 'confirmed' | 'pending' = 'confirmed';
    if (body.locationId != null) {
      const location = await db.query.locations.findFirst({
        where: and(eq(locations.companyId, company.id), eq(locations.id, body.locationId)),
      });
      if (location?.type === 'mobile') {
        status = 'pending';
      }
    }

    // Dirección de destino (móvil) se persiste en notes ya que no hay columna dedicada.
    const notes = body.customerAddress
      ? `Dirección: ${body.customerAddress}` + (body.notes ? ` · ${body.notes}` : '')
      : body.notes;

    // 2. Insertar cita
    const [appointment] = await db
      .insert(appointments)
      .values({
        companyId: company.id,
        customerId: customer.id,
        staffId: body.staffId ?? null,
        locationId: body.locationId ?? null,
        status,
        startAt: new Date(body.startAt),
        endAt: new Date(endAt),
        bufferMinutes: service.bufferAfterMinutes,
        source: 'public_portal',
        notes,
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

    // 4. Enviar email transaccional con .ics en segundo plano si hay API key
    if (c.env?.RESEND_API_KEY && body.customerEmail) {
      sendAppointmentConfirmationEmail({
        apiKey: c.env.RESEND_API_KEY,
        to: body.customerEmail,
        customerName: customer.name,
        companyName: company.name,
        serviceName: service.name,
        startAt: new Date(body.startAt),
        endAt: new Date(endAt),
        appointmentId: appointment.id,
      }).catch((err) => console.error('[Notification dispatch error]', err));
    }

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
