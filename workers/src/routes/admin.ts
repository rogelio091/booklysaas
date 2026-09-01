import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SignJWT } from "jose";
import { eq, and, desc, inArray, like, or, lt, gt, gte, lte } from "drizzle-orm";
import {
  loginRequestSchema,
  createServiceSchema,
  updateServiceSchema,
  createStaffSchema,
  updateStaffSchema,
  setWorkingHoursSchema,
  createBlockedSlotSchema,
  updateAppointmentStatusSchema,
  createAdminAppointmentSchema,
  updateCompanySettingsSchema,
  createLocationSchema,
  updateLocationSchema,
  assignLocationStaffSchema,
  assignLocationServicesSchema,
} from "@bookly/contracts";
import { authMiddleware } from "../middleware/auth";
import { verifyPassword } from "../utils/password";
import {
  users,
  companies,
  services,
  staffServices,
  workingHours,
  blockedSlots,
  appointments,
  customers,
  appointmentItems,
  locations,
  staffLocations,
  serviceLocations,
  saasPlans,
} from "../db/schema";
import { withTenant } from "../db/client";
import type { AppContext } from "../types";

export const adminRoutes = new Hono<AppContext>();

// ---------------------------------------------------------------------------
// Auth Público: Login
// ---------------------------------------------------------------------------
adminRoutes.post(
  "/auth/login",
  zValidator("json", loginRequestSchema),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const db = c.get("db");

    const user = await db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.isActive, true)),
    });

    if (!user) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Credenciales inválidas",
          },
        },
        401,
      );
    }

    // Anti-enumeración: mismo error para usuario inexistente y password incorrecta.
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Credenciales inválidas",
          },
        },
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
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
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
  },
);

// ---------------------------------------------------------------------------
// Rutas Protegidas de Administración
// ---------------------------------------------------------------------------
const protectedAdmin = new Hono<AppContext>();
protectedAdmin.use("*", authMiddleware);

// --- 1. CRUD de Servicios ---
protectedAdmin.get("/services", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const list = await db.query.services.findMany({
    where: withTenant(services, companyId),
    orderBy: [services.displayOrder],
  });

  return c.json({ success: true, data: list });
});

protectedAdmin.post(
  "/services",
  zValidator("json", createServiceSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    const [service] = await db
      .insert(services)
      .values({
        ...body,
        companyId,
      })
      .returning();

    return c.json({ success: true, data: service }, 201);
  },
);

protectedAdmin.put(
  "/services/:id",
  zValidator("json", updateServiceSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const body = c.req.valid("json");
    const db = c.get("db");

    const [updated] = await db
      .update(services)
      .set({ ...body, updatedAt: new Date() })
      .where(withTenant(services, companyId, eq(services.id, id)))
      .returning();

    if (!updated) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Servicio no encontrado" },
        },
        404,
      );
    }

    return c.json({ success: true, data: updated });
  },
);

protectedAdmin.delete("/services/:id", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const [deleted] = await db
    .update(services)
    .set({ isActive: false, updatedAt: new Date() })
    .where(withTenant(services, companyId, eq(services.id, id)))
    .returning();

  if (!deleted) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Servicio no encontrado" },
      },
      404,
    );
  }

  return c.json({ success: true, data: deleted });
});

// --- 2. CRUD de Staff ---
protectedAdmin.get("/staff", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const staffList = await db.query.users.findMany({
    where: withTenant(users, companyId),
  });

  const staffIds = staffList.map((s) => s.id);
  const serviceRelations =
    staffIds.length > 0
      ? await db.query.staffServices.findMany({
          where: withTenant(
            staffServices,
            companyId,
            inArray(staffServices.userId, staffIds),
          ),
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
    serviceIds: serviceRelations
      .filter((r) => r.userId === s.id)
      .map((r) => r.serviceId),
  }));

  return c.json({ success: true, data });
});

protectedAdmin.post(
  "/staff",
  zValidator("json", createStaffSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const { serviceIds, password, ...rest } = c.req.valid("json");
    const db = c.get("db");

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
  },
);

protectedAdmin.put(
  "/staff/:id",
  zValidator("json", updateStaffSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const { serviceIds, newPassword, ...rest } = c.req.valid("json");
    const db = c.get("db");

    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (newPassword) {
      updateData["passwordHash"] = newPassword;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(withTenant(users, companyId, eq(users.id, id)))
      .returning();

    if (!updated) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Staff no encontrado" },
        },
        404,
      );
    }

    if (serviceIds !== undefined) {
      await db
        .delete(staffServices)
        .where(
          withTenant(staffServices, companyId, eq(staffServices.userId, id)),
        );
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
  },
);

// --- 3. Horarios Laborales ---
protectedAdmin.get("/schedule/working-hours", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const hours = await db.query.workingHours.findMany({
    where: withTenant(workingHours, companyId),
  });

  return c.json({ success: true, data: hours });
});

protectedAdmin.post(
  "/schedule/working-hours",
  zValidator("json", setWorkingHoursSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const { hours } = c.req.valid("json");
    const db = c.get("db");

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

    return c.json({
      success: true,
      message: "Horarios actualizados correctamente",
    });
  },
);

// --- 4. Bloqueos de Horario ---
protectedAdmin.get("/schedule/blocks", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  // Filtro opcional por rango de fechas (epoch ms). "from" = bloques que
  // terminan en/después; "to" = bloques que inician en/antes.
  const fromRaw = c.req.query("from");
  const toRaw = c.req.query("to");
  const from = fromRaw !== undefined ? Number(fromRaw) : NaN;
  const to = toRaw !== undefined ? Number(toRaw) : NaN;

  const blocks = await db.query.blockedSlots.findMany({
    where: withTenant(
      blockedSlots,
      companyId,
      and(
        Number.isFinite(from) ? gte(blockedSlots.endAt, new Date(from)) : undefined,
        Number.isFinite(to) ? lte(blockedSlots.startAt, new Date(to)) : undefined,
      ),
    ),
    orderBy: [desc(blockedSlots.startAt)],
  });

  return c.json({
    success: true,
    data: blocks.map((b) => ({
      id: b.id,
      companyId: b.companyId,
      userId: b.userId,
      locationId: b.locationId,
      startAt: b.startAt.getTime(),
      endAt: b.endAt.getTime(),
      reason: b.reason,
      createdAt: b.createdAt.getTime(),
    })),
  });
});

protectedAdmin.post(
  "/schedule/blocks",
  zValidator("json", createBlockedSlotSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    const [block] = await db
      .insert(blockedSlots)
      .values({
        companyId,
        userId: body.userId ?? null,
        locationId: body.locationId ?? null,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        reason: body.reason ?? null,
      })
      .returning();

    // Citas confirmadas que se superponen con el rango bloqueado
    // (mismo tenant; misma locationId cuando el bloqueo es por ubicación).
    const affectedAppointments = await db.$count(
      appointments,
      and(
        eq(appointments.companyId, companyId),
        eq(appointments.status, "confirmed"),
        lt(appointments.startAt, block.endAt),
        gt(appointments.endAt, block.startAt),
        block.locationId !== null
          ? eq(appointments.locationId, block.locationId)
          : undefined,
      ),
    );

    return c.json(
      {
        success: true,
        data: {
          id: block.id,
          companyId: block.companyId,
          userId: block.userId,
          locationId: block.locationId,
          startAt: block.startAt.getTime(),
          endAt: block.endAt.getTime(),
          reason: block.reason,
          createdAt: block.createdAt.getTime(),
        },
        warnings: {
          affectedAppointments,
        },
      },
      201,
    );
  },
);

protectedAdmin.delete("/schedule/blocks/:id", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const [deleted] = await db
    .delete(blockedSlots)
    .where(withTenant(blockedSlots, companyId, eq(blockedSlots.id, id)))
    .returning();

  if (!deleted) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Bloqueo no encontrado" },
      },
      404,
    );
  }

  return c.json({ success: true, data: deleted });
});

// --- 5. Clientes ---
protectedAdmin.get("/customers", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const search = c.req.query("search")?.trim() || undefined;
  const parsedLimit = Number(c.req.query("limit"));
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.floor(parsedLimit), 100)
      : 50;

  const searchCondition = search
    ? or(
        like(customers.name, `%${search}%`),
        like(customers.phone, `%${search}%`),
      )
    : undefined;

  const list = await db.query.customers.findMany({
    where: withTenant(customers, companyId, searchCondition),
    orderBy: [desc(customers.createdAt)],
    limit,
  });

  return c.json({
    success: true,
    data: list.map((c) => ({
      id: c.id,
      companyId: c.companyId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      createdAt: c.createdAt.getTime(),
    })),
  });
});

// --- 5. Citas y Actualización de Estado ---
protectedAdmin.get("/appointments", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const list = await db.query.appointments.findMany({
    where: withTenant(appointments, companyId),
    orderBy: [desc(appointments.startAt)],
    limit: 100,
  });

  const customerIds = list.map((a) => a.customerId);
  const staffIds = list
    .map((a) => a.staffId)
    .filter((id): id is number => id !== null);

  const customerMap =
    customerIds.length > 0
      ? await db.query.customers.findMany({
          where: withTenant(
            customers,
            companyId,
            inArray(customers.id, customerIds),
          ),
        })
      : [];

  const staffMap =
    staffIds.length > 0
      ? await db.query.users.findMany({
          where: withTenant(users, companyId, inArray(users.id, staffIds)),
        })
      : [];

  const appointmentIds = list.map((a) => a.id);
  const items =
    appointmentIds.length > 0
      ? await db.query.appointmentItems.findMany({
          where: withTenant(
            appointmentItems,
            companyId,
            inArray(appointmentItems.appointmentId, appointmentIds),
          ),
        })
      : [];

  const data = list.map((a) => {
    const cust = customerMap.find((c) => c.id === a.customerId);
    const st = staffMap.find((s) => s.id === a.staffId);
    const item = items.find((i) => i.appointmentId === a.id);
    return {
      id: a.id,
      companyId: a.companyId,
      customerId: a.customerId,
      customerName: cust?.name ?? "Cliente Desconocido",
      customerPhone: cust?.phone ?? "",
      staffId: a.staffId,
      staffName: st?.name ?? null,
      serviceName: item?.serviceName ?? null,
      serviceId: item?.serviceId ?? null,
      priceQtz: item?.priceQtz ?? null,
      durationMinutes: item?.durationMinutes ?? null,
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

protectedAdmin.patch(
  "/appointments/:id/status",
  zValidator("json", updateAppointmentStatusSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const { status, cancellationReason } = c.req.valid("json");
    const db = c.get("db");

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
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Cita no encontrada" },
        },
        404,
      );
    }

    return c.json({ success: true, data: updated });
  },
);

protectedAdmin.post(
  "/appointments",
  zValidator("json", createAdminAppointmentSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    // El servicio debe existir y estar activo para este tenant.
    const service = await db.query.services.findFirst({
      where: and(
        eq(services.companyId, companyId),
        eq(services.id, body.serviceId),
        eq(services.isActive, true),
      ),
    });

    if (!service) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Servicio no encontrado" },
        },
        404,
      );
    }

    const endAt = body.startAt + service.durationMinutes * 60 * 1000;

    // 1. Buscar o crear cliente por companyId + phone.
    let customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.companyId, companyId),
        eq(customers.phone, body.customerPhone),
      ),
    });

    if (!customer) {
      const [newCustomer] = await db
        .insert(customers)
        .values({
          companyId,
          name: body.customerName,
          phone: body.customerPhone,
          email: body.customerEmail ?? null,
        })
        .returning();
      customer = newCustomer;
    }

    // 2. Insertar la cita.
    const [appointment] = await db
      .insert(appointments)
      .values({
        companyId,
        customerId: customer.id,
        staffId: body.staffId ?? null,
        status: "confirmed",
        startAt: new Date(body.startAt),
        endAt: new Date(endAt),
        bufferMinutes: service.bufferAfterMinutes,
        source: "admin",
        notes: body.notes ?? null,
      })
      .returning();

    // 3. Insertar el snapshot inmutable del servicio.
    await db.insert(appointmentItems).values({
      companyId,
      appointmentId: appointment.id,
      serviceId: service.id,
      serviceName: service.name,
      priceQtz: service.priceQtz,
      durationMinutes: service.durationMinutes,
    });

    return c.json(
      {
        success: true,
        data: {
          id: appointment.id,
          companyId: appointment.companyId,
          customerId: appointment.customerId,
          staffId: appointment.staffId,
          status: appointment.status,
          startAt: appointment.startAt.getTime(),
          endAt: appointment.endAt.getTime(),
          source: appointment.source,
          notes: appointment.notes,
        },
      },
      201,
    );
  },
);

// DELETE físico de una cita (tenant-scoped). El soft-delete se maneja con status 'canceled'.
protectedAdmin.delete("/appointments/:id", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const appointment = await db.query.appointments.findFirst({
    where: withTenant(appointments, companyId, eq(appointments.id, id)),
  });

  if (!appointment) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Cita no encontrada" },
      },
      404,
    );
  }

  await db
    .delete(appointmentItems)
    .where(
      withTenant(
        appointmentItems,
        companyId,
        eq(appointmentItems.appointmentId, id),
      ),
    );
  await db
    .delete(appointments)
    .where(withTenant(appointments, companyId, eq(appointments.id, id)));

  return c.json({ success: true, data: { id } });
});

// --- 6. Configuración de la Empresa / Tenant (Tema, Marca, etc.) ---
protectedAdmin.get("/company/settings", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Empresa no encontrada" },
      },
      404,
    );
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

protectedAdmin.patch(
  "/company/settings",
  zValidator("json", updateCompanySettingsSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    const [updated] = await db
      .update(companies)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(companies.id, companyId))
      .returning();

    if (!updated) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Empresa no encontrada" },
        },
        404,
      );
    }

    return c.json({ success: true, data: updated });
  },
);

// --- 7. CRUD de Ubicaciones (Locations) ---
protectedAdmin.get("/locations", async (c) => {
  const companyId = c.get("companyId")!;
  const db = c.get("db");

  const list = await db.query.locations.findMany({
    where: withTenant(locations, companyId),
    orderBy: [locations.name],
  });

  return c.json({ success: true, data: list });
});

protectedAdmin.post(
  "/locations",
  zValidator("json", createLocationSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const body = c.req.valid("json");
    const db = c.get("db");

    // Límite de una única ubicación móvil por empresa.
    if (body.type === "mobile") {
      const existingMobile = await db.query.locations.findFirst({
        where: withTenant(
          locations,
          companyId,
          and(eq(locations.type, "mobile"), eq(locations.isActive, true)),
        ),
      });
      if (existingMobile) {
        return c.json(
          {
            success: false,
            error: {
              code: "MOBILE_LIMIT_REACHED",
              message: "Solo se permite una ubicación móvil por empresa",
            },
          },
          400,
        );
      }
    }

    // Límite de ubicaciones activas según el plan (saasPlans.maxLocations).
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
    });
    const plan = company
      ? await db.query.saasPlans.findFirst({
          where: eq(saasPlans.id, company.planId),
        })
      : undefined;
    const maxLocations = plan?.maxLocations ?? 1;

    const activeCount = await db.$count(
      locations,
      withTenant(locations, companyId, eq(locations.isActive, true)),
    );

    if (activeCount >= maxLocations) {
      return c.json(
        {
          success: false,
          error: {
            code: "LOCATIONS_LIMIT_REACHED",
            message: `Límite de ubicaciones alcanzado (${maxLocations})`,
          },
        },
        403,
      );
    }

    const [location] = await db
      .insert(locations)
      .values({
        companyId,
        name: body.name,
        address: body.address ?? null,
        slug: body.slug,
        type: body.type,
        serviceRadiusKm: body.serviceRadiusKm ?? null,
        isActive: body.isActive,
      })
      .returning();

    return c.json({ success: true, data: location }, 201);
  },
);

protectedAdmin.put(
  "/locations/:id",
  zValidator("json", updateLocationSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const body = c.req.valid("json");
    const db = c.get("db");

    const [updated] = await db
      .update(locations)
      .set({ ...body, updatedAt: new Date() })
      .where(withTenant(locations, companyId, eq(locations.id, id)))
      .returning();

    if (!updated) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
        },
        404,
      );
    }

    return c.json({ success: true, data: updated });
  },
);

protectedAdmin.delete("/locations/:id", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const [deleted] = await db
    .update(locations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(withTenant(locations, companyId, eq(locations.id, id)))
    .returning();

  if (!deleted) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
      },
      404,
    );
  }

  return c.json({ success: true, data: deleted });
});

// Asignación de staff a una ubicación (pivot staff_locations).
protectedAdmin.get("/locations/:id/staff", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const location = await db.query.locations.findFirst({
    where: withTenant(locations, companyId, eq(locations.id, id)),
  });
  if (!location) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
      },
      404,
    );
  }

  const relations = await db.query.staffLocations.findMany({
    where: withTenant(
      staffLocations,
      companyId,
      eq(staffLocations.locationId, id),
    ),
  });

  const userIds = relations.map((r) => r.userId);
  const staff =
    userIds.length > 0
      ? await db.query.users.findMany({
          where: withTenant(users, companyId, inArray(users.id, userIds)),
        })
      : [];

  return c.json({
    success: true,
    data: staff.map((s) => ({ id: s.id, name: s.name, email: s.email })),
  });
});

protectedAdmin.post(
  "/locations/:id/staff",
  zValidator("json", assignLocationStaffSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const { staffIds } = c.req.valid("json");
    const db = c.get("db");

    const location = await db.query.locations.findFirst({
      where: withTenant(locations, companyId, eq(locations.id, id)),
    });
    if (!location) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
        },
        404,
      );
    }

    // Filtrar staffIds que pertenecen al tenant (aislamiento multi-tenant).
    const validStaff =
      staffIds.length > 0
        ? await db.query.users.findMany({
            where: withTenant(users, companyId, inArray(users.id, staffIds)),
          })
        : [];
    const validIds = validStaff.map((u) => u.id);

    // Reemplazar asignaciones existentes.
    await db
      .delete(staffLocations)
      .where(
        withTenant(
          staffLocations,
          companyId,
          eq(staffLocations.locationId, id),
        ),
      );

    if (validIds.length > 0) {
      await db.insert(staffLocations).values(
        validIds.map((userId) => ({
          companyId,
          locationId: id,
          userId,
        })),
      );
    }

    return c.json({ success: true, data: { staffIds: validIds } });
  },
);

// Asignación de servicios a una ubicación (pivot service_locations).
protectedAdmin.get("/locations/:id/services", async (c) => {
  const companyId = c.get("companyId")!;
  const id = Number(c.req.param("id"));
  const db = c.get("db");

  const location = await db.query.locations.findFirst({
    where: withTenant(locations, companyId, eq(locations.id, id)),
  });
  if (!location) {
    return c.json(
      {
        success: false,
        error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
      },
      404,
    );
  }

  const relations = await db.query.serviceLocations.findMany({
    where: withTenant(
      serviceLocations,
      companyId,
      eq(serviceLocations.locationId, id),
    ),
  });

  const serviceIds = relations.map((r) => r.serviceId);
  const serviceList =
    serviceIds.length > 0
      ? await db.query.services.findMany({
          where: withTenant(services, companyId, inArray(services.id, serviceIds)),
          orderBy: [services.displayOrder],
        })
      : [];

  return c.json({ success: true, data: serviceList });
});

protectedAdmin.post(
  "/locations/:id/services",
  zValidator("json", assignLocationServicesSchema),
  async (c) => {
    const companyId = c.get("companyId")!;
    const id = Number(c.req.param("id"));
    const { serviceIds } = c.req.valid("json");
    const db = c.get("db");

    const location = await db.query.locations.findFirst({
      where: withTenant(locations, companyId, eq(locations.id, id)),
    });
    if (!location) {
      return c.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Ubicación no encontrada" },
        },
        404,
      );
    }

    // Filtrar serviceIds que pertenecen al tenant (aislamiento multi-tenant).
    const validServices =
      serviceIds.length > 0
        ? await db.query.services.findMany({
            where: withTenant(services, companyId, inArray(services.id, serviceIds)),
          })
        : [];
    const validIds = validServices.map((s) => s.id);

    // Reemplazar asignaciones existentes.
    await db
      .delete(serviceLocations)
      .where(
        withTenant(
          serviceLocations,
          companyId,
          eq(serviceLocations.locationId, id),
        ),
      );

    if (validIds.length > 0) {
      await db.insert(serviceLocations).values(
        validIds.map((serviceId) => ({
          companyId,
          locationId: id,
          serviceId,
        })),
      );
    }

    return c.json({ success: true, data: { serviceIds: validIds } });
  },
);

adminRoutes.route("/", protectedAdmin);
