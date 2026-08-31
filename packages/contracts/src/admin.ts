import { z } from 'zod';

// Auth Login Request
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequestDto = z.infer<typeof loginRequestSchema>;

// Auth Login Response
export const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'staff', 'superadmin']),
    companyId: z.number(),
  }),
});

export type AuthResponseDto = z.infer<typeof authResponseSchema>;

// ---------------------------------------------------------------------------
// Servicios (Admin CRUD)
// ---------------------------------------------------------------------------
export const createServiceSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().positive('La duración debe ser positiva'),
  bufferAfterMinutes: z.number().int().nonnegative().default(0),
  priceQtz: z.number().int().nonnegative('El precio debe ser en centavos enteros'),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;

export const serviceResponseSchema = createServiceSchema.extend({
  id: z.number(),
  companyId: z.number(),
});
export type ServiceResponseDto = z.infer<typeof serviceResponseSchema>;

// ---------------------------------------------------------------------------
// Staff (Admin CRUD)
// ---------------------------------------------------------------------------
export const createStaffSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: z.enum(['admin', 'staff']).default('staff'),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  serviceIds: z.array(z.number().int().positive()).optional(),
});

export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial().omit({ password: true }).extend({
  newPassword: z.string().min(6).optional(),
});
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

export const staffResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'staff', 'superadmin']),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  isActive: z.boolean(),
  serviceIds: z.array(z.number()),
});
export type StaffResponseDto = z.infer<typeof staffResponseSchema>;

// ---------------------------------------------------------------------------
// Lugares de Atención (Locations)
// ---------------------------------------------------------------------------
export const locationTypeSchema = z.enum(['fixed', 'mobile']);

export const createLocationSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  address: z.string().optional().nullable(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido (minúsculas, números y guiones)'),
  type: locationTypeSchema.default('fixed'),
  serviceRadiusKm: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CreateLocationDto = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = createLocationSchema.partial();
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;

export const locationResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  slug: z.string(),
  type: locationTypeSchema,
  serviceRadiusKm: z.number().nullable(),
  isActive: z.boolean(),
});
export type LocationResponseDto = z.infer<typeof locationResponseSchema>;

export const assignLocationStaffSchema = z.object({
  staffIds: z.array(z.number().int().positive()),
});
export type AssignLocationStaffDto = z.infer<typeof assignLocationStaffSchema>;

// ---------------------------------------------------------------------------
// Horarios Laborales (Working Hours)
// ---------------------------------------------------------------------------
export const workingHourItemSchema = z.object({
  userId: z.number().int().nullable().optional(), // null = default de empresa
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  breakStartTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  breakEndTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const setWorkingHoursSchema = z.object({
  hours: z.array(workingHourItemSchema),
});
export type SetWorkingHoursDto = z.infer<typeof setWorkingHoursSchema>;

// ---------------------------------------------------------------------------
// Bloqueos de Horario (Blocked Slots)
// ---------------------------------------------------------------------------
export const createBlockedSlotSchema = z.object({
  userId: z.number().int().nullable().optional(), // null = toda la empresa
  startAt: z.number().int().positive(), // epoch ms UTC
  endAt: z.number().int().positive(),
  reason: z.string().optional().nullable(),
});
export type CreateBlockedSlotDto = z.infer<typeof createBlockedSlotSchema>;

// ---------------------------------------------------------------------------
// Clientes (Admin)
// ---------------------------------------------------------------------------
export const customerResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.number(),
});
export type CustomerResponseDto = z.infer<typeof customerResponseSchema>;

// ---------------------------------------------------------------------------
// Citas (Appointments)
// ---------------------------------------------------------------------------
export const appointmentAdminSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  customerId: z.number(),
  customerName: z.string(),
  customerPhone: z.string(),
  staffId: z.number().nullable(),
  staffName: z.string().nullable(),
  serviceName: z.string().nullable(),
  serviceId: z.number().nullable(),
  priceQtz: z.number().nullable(),
  durationMinutes: z.number().nullable(),
  status: z.enum(['pending', 'confirmed', 'completed', 'canceled', 'no_show']),
  startAt: z.number(),
  endAt: z.number(),
  source: z.enum(['public_portal', 'admin', 'staff']),
  cancellationReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type AppointmentAdminDto = z.infer<typeof appointmentAdminSchema>;

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'canceled', 'no_show']),
  cancellationReason: z.string().optional(),
});
export type UpdateAppointmentStatusDto = z.infer<typeof updateAppointmentStatusSchema>;

export const createAdminAppointmentSchema = z.object({
  customerName: z.string().min(2, 'El nombre es requerido'),
  customerPhone: z.string().min(8, 'Teléfono requerido'),
  customerEmail: z.string().email('Email inválido').optional().nullable(),
  serviceId: z.number().int().positive(),
  staffId: z.number().int().positive().nullable().optional(),
  startAt: z.number().int().positive(), // Epoch ms UTC
  notes: z.string().optional().nullable(),
});
export type CreateAdminAppointmentDto = z.infer<typeof createAdminAppointmentSchema>;

// ---------------------------------------------------------------------------
// Configuración de Empresa (Settings)
// ---------------------------------------------------------------------------
export const updateCompanySettingsSchema = z.object({
  name: z.string().min(2).optional(),
  timezone: z.string().optional(),
  brandColor: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  theme: z.enum(['midnight-emerald', 'obsidian-luxe', 'titanium-oled']).optional(),
});
export type UpdateCompanySettingsDto = z.infer<typeof updateCompanySettingsSchema>;

