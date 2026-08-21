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

// Appointment Admin Item
export const appointmentAdminSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  customerId: z.number(),
  customerName: z.string(),
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
