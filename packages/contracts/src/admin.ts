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
