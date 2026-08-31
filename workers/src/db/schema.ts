import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Bookly — Esquema Drizzle para Cloudflare D1 (SQLite).
 * Multi-tenant: toda tabla de dominio particiona por `company_id`.
 * Moneda: centavos de Quetzal (integer). Fechas: epoch ms (UTC).
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// ---------------------------------------------------------------------------
// Planes SaaS y Suscripciones de Plataforma
// ---------------------------------------------------------------------------
export const saasPlans = sqliteTable('saas_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code', { enum: ['basic', 'pro', 'enterprise'] }).notNull().unique(),
  name: text('name').notNull(),
  monthlyPriceQtz: integer('monthly_price_qtz').notNull(),
  maxStaff: integer('max_staff').notNull().default(1),
  monthlyAppointments: integer('monthly_appointments').notNull().default(100),
  maxLocations: integer('max_locations').notNull().default(1),
  featuresJson: text('features_json').notNull().default('{}'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Empresas / Tenants
// ---------------------------------------------------------------------------
export const companies = sqliteTable(
  'companies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    planId: integer('plan_id')
      .notNull()
      .references(() => saasPlans.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    timezone: text('timezone').notNull().default('America/Guatemala'),
    currency: text('currency').notNull().default('GTQ'),
    brandColor: text('brand_color').default('#2563eb'),
    theme: text('theme', {
      enum: ['midnight-emerald', 'obsidian-luxe', 'titanium-oled'],
    })
      .notNull()
      .default('midnight-emerald'),
    logoUrl: text('logo_url'),
    subscriptionStatus: text('subscription_status', {
      enum: ['trial', 'active', 'past_due', 'canceled', 'locked'],
    })
      .notNull()
      .default('trial'),
    trialEndsAt: integer('trial_ends_at', { mode: 'timestamp_ms' }),
    recurrenteSubscriptionId: text('recurrente_subscription_id'),
    billingDay: integer('billing_day').notNull().default(1),
    recurrenteApiKeyEnc: text('recurrente_api_key_enc'),
    recurrenteWebhookSecretEnc: text('recurrente_webhook_secret_enc'),
    ...timestamps,
  },
  (t) => ({
    slugIdx: uniqueIndex('companies_slug_idx').on(t.slug),
  }),
);

// ---------------------------------------------------------------------------
// Lugares de Atención (Locations)
// ---------------------------------------------------------------------------
export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    slug: text('slug').notNull(),
    type: text('type', { enum: ['fixed', 'mobile'] })
      .notNull()
      .default('fixed'),
    serviceRadiusKm: integer('service_radius_km'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index('locations_company_idx').on(t.companyId),
    companySlugIdx: uniqueIndex('locations_company_slug_idx').on(
      t.companyId,
      t.slug,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Usuarios (Staff, Admins, Dueños)
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['superadmin', 'admin', 'staff'] })
      .notNull()
      .default('staff'),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    companyEmailIdx: uniqueIndex('users_company_email_idx').on(
      t.companyId,
      t.email,
    ),
    companyIdx: index('users_company_idx').on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Servicios ofrecidos por la Empresa
// ---------------------------------------------------------------------------
export const services = sqliteTable(
  'services',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').notNull(),
    bufferAfterMinutes: integer('buffer_after_minutes').notNull().default(0),
    priceQtz: integer('price_qtz').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    requiresDeposit: integer('requires_deposit', { mode: 'boolean' })
      .notNull()
      .default(false),
    depositAmountQtz: integer('deposit_amount_qtz').notNull().default(0),
    depositPercentage: integer('deposit_percentage'),
    autoConfirmOnPayment: integer('auto_confirm_on_payment', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index('services_company_idx').on(t.companyId),
    companyActiveIdx: index('services_company_active_idx').on(
      t.companyId,
      t.isActive,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relación Servicio <-> Lugares (pivot)
// ---------------------------------------------------------------------------
export const serviceLocations = sqliteTable(
  'service_locations',
  {
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.serviceId, t.locationId] }),
    companyIdx: index('service_locations_company_idx').on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Relación Staff <-> Servicios
// ---------------------------------------------------------------------------
export const staffServices = sqliteTable(
  'staff_services',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: uniqueIndex('staff_services_pk').on(t.userId, t.serviceId),
    companyIdx: index('staff_services_company_idx').on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Relación Staff <-> Lugares (pivot)
// ---------------------------------------------------------------------------
export const staffLocations = sqliteTable(
  'staff_locations',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.locationId] }),
    companyIdx: index('staff_locations_company_idx').on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Horarios Laborales (por Staff o General de la Empresa)
// ---------------------------------------------------------------------------
export const workingHours = sqliteTable(
  'working_hours',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    locationId: integer('location_id').references(() => locations.id, {
      onDelete: 'cascade',
    }),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 (Domingo) - 6 (Sábado)
    startTime: text('start_time').notNull(), // "09:00"
    endTime: text('end_time').notNull(),     // "17:00"
    breakStartTime: text('break_start_time'), // "13:00"
    breakEndTime: text('break_end_time'),     // "14:00"
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    companyUserDayIdx: index('working_hours_company_user_day_idx').on(
      t.companyId,
      t.userId,
      t.dayOfWeek,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Bloqueos de Horario
// ---------------------------------------------------------------------------
export const blockedSlots = sqliteTable(
  'blocked_slots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    locationId: integer('location_id').references(() => locations.id, {
      onDelete: 'cascade',
    }),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
    endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
    reason: text('reason'),
    ...timestamps,
  },
  (t) => ({
    companyRangeIdx: index('blocked_slots_company_range_idx').on(
      t.companyId,
      t.startAt,
      t.endAt,
    ),
    userRangeIdx: index('blocked_slots_user_range_idx').on(
      t.companyId,
      t.userId,
      t.startAt,
      t.endAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Clientes Finales
// ---------------------------------------------------------------------------
export const customers = sqliteTable(
  'customers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => ({
    companyPhoneIdx: index('customers_company_phone_idx').on(
      t.companyId,
      t.phone,
    ),
    companyEmailIdx: index('customers_company_email_idx').on(
      t.companyId,
      t.email,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Citas (Appointments)
// ---------------------------------------------------------------------------
export const appointments = sqliteTable(
  'appointments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    staffId: integer('staff_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    status: text('status', {
      enum: ['pending', 'confirmed', 'completed', 'canceled', 'no_show'],
    })
      .notNull()
      .default('confirmed'),
    startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(),
    endAt: integer('end_at', { mode: 'timestamp_ms' }).notNull(),
    bufferMinutes: integer('buffer_minutes').notNull().default(0),
    source: text('source', { enum: ['public_portal', 'admin', 'staff'] })
      .notNull()
      .default('public_portal'),
    publicToken: text('public_token'),
    locationId: integer('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    cancellationReason: text('cancellation_reason'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => ({
    staffRangeIdx: index('appointments_staff_range_idx').on(
      t.companyId,
      t.staffId,
      t.startAt,
      t.endAt,
    ),
    companyRangeIdx: index('appointments_company_range_idx').on(
      t.companyId,
      t.startAt,
      t.endAt,
    ),
    statusIdx: index('appointments_status_idx').on(t.companyId, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Ítems de la Cita (Servicios en la cita)
// ---------------------------------------------------------------------------
export const appointmentItems = sqliteTable(
  'appointment_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    appointmentId: integer('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    serviceId: integer('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    serviceName: text('service_name').notNull(),
    priceQtz: integer('price_qtz').notNull().default(0),
    durationMinutes: integer('duration_minutes').notNull(),
    ...timestamps,
  },
  (t) => ({
    appointmentIdx: index('appointment_items_appointment_idx').on(
      t.appointmentId,
    ),
    companyIdx: index('appointment_items_company_idx').on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Facturas y Cobros
// ---------------------------------------------------------------------------
export const invoices = sqliteTable(
  'invoices',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    appointmentId: integer('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    number: text('number').notNull(),
    subtotalQtz: integer('subtotal_qtz').notNull().default(0),
    taxQtz: integer('tax_qtz').notNull().default(0),
    totalQtz: integer('total_qtz').notNull().default(0),
    status: text('status', {
      enum: ['draft', 'open', 'paid', 'void', 'refunded'],
    })
      .notNull()
      .default('open'),
    dueAt: integer('due_at', { mode: 'timestamp_ms' }),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => ({
    companyNumberIdx: uniqueIndex('invoices_company_number_idx').on(
      t.companyId,
      t.number,
    ),
    appointmentIdx: index('invoices_appointment_idx').on(t.appointmentId),
  }),
);

// ---------------------------------------------------------------------------
// Pagos (Recurrente / Tarjetas)
// ---------------------------------------------------------------------------
export const payments = sqliteTable(
  'payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    invoiceId: integer('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),
    appointmentId: integer('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    gateway: text('gateway', {
      enum: ['recurrente', 'cash', 'transfer', 'other'],
    })
      .notNull()
      .default('recurrente'),
    gatewayPaymentId: text('gateway_payment_id'),
    amountQtz: integer('amount_qtz').notNull(),
    status: text('status', {
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
    })
      .notNull()
      .default('pending'),
    cardBrand: text('card_brand'),
    cardLastFour: text('card_last_four'),
    rawGatewayResponse: text('raw_gateway_response'),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index('payments_company_idx').on(t.companyId),
    invoiceIdx: index('payments_invoice_idx').on(t.invoiceId),
    appointmentIdx: index('payments_appointment_idx').on(t.appointmentId),
  }),
);

// ---------------------------------------------------------------------------
// Facturación del Tenant (ciclo de suscripción a Bookly)
// ---------------------------------------------------------------------------
export const tenantBillings = sqliteTable(
  'tenant_billings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }).notNull(),
    amountQtz: integer('amount_qtz').notNull(),
    status: text('status', {
      enum: ['pending', 'paid', 'overdue', 'void'],
    })
      .notNull()
      .default('pending'),
    recurrenteInvoiceId: text('recurrente_invoice_id'),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index('tenant_billings_company_idx').on(t.companyId),
    statusIdx: index('tenant_billings_status_idx').on(t.companyId, t.status),
  }),
);
