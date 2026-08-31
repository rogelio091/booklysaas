import { z } from 'zod';

// Company Public Profile
export const publicCompanySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  brandColor: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  theme: z.enum(['midnight-emerald', 'obsidian-luxe', 'titanium-oled']).default('midnight-emerald'),
});

export type PublicCompanyDto = z.infer<typeof publicCompanySchema>;

// Public Location (atención fija o móvil)
export const publicLocationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  address: z.string().nullable().optional(),
  type: z.enum(['fixed', 'mobile']).default('fixed'),
  serviceRadiusKm: z.number().int().nonnegative().nullable().optional(),
  slug: z.string(),
});

export type PublicLocationDto = z.infer<typeof publicLocationSchema>;

// Public Service
export const publicServiceSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive(),
  priceQtz: z.number().int().nonnegative(),
});

export type PublicServiceDto = z.infer<typeof publicServiceSchema>;

// Public Staff Member
export const publicStaffSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type PublicStaffDto = z.infer<typeof publicStaffSchema>;

// Availability Query
export const availabilityQuerySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  staffId: z.coerce.number().int().positive().optional().nullable(),
  locationId: z.coerce.number().int().positive().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
});

export type AvailabilityQueryDto = z.infer<typeof availabilityQuerySchema>;

// Slot Item
export const slotSchema = z.object({
  startAt: z.number().int().positive(), // Epoch ms UTC
  endAt: z.number().int().positive(),
  staffId: z.number().int().nullable(),
  staffName: z.string().nullable(),
});

export type SlotDto = z.infer<typeof slotSchema>;

// Public Booking Request
export const createBookingSchema = z.object({
  serviceId: z.number().int().positive(),
  staffId: z.number().int().nullable().optional(),
  locationId: z.coerce.number().int().positive().optional().nullable(),
  startAt: z.number().int().positive(), // Epoch ms UTC
  customerName: z.string().min(2, 'El nombre es obligatorio'),
  customerPhone: z.string().min(8, 'Teléfono o WhatsApp requerido'),
  customerEmail: z.string().email('Email inválido').optional().nullable(),
  customerAddress: z.string().optional(), // Dirección de destino para reservas móviles
  notes: z.string().optional(),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;
