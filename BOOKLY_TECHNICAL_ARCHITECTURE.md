# Bookly — Arquitectura Técnica de Referencia

> Plano de construcción para el equipo de desarrollo.
> Documento técnico exhaustivo de **Bookly**, SaaS de agendamiento y gestión de citas de servicios.

| Campo | Valor |
|---|---|
| Producto | **Bookly** |
| Desarrollado por | **GhostlyApps** |
| Dominio de producción | `https://bookly.ghostlyapps.dev` |
| Portal público de reservas | `https://bookly.ghostlyapps.dev/book/:slug` |
| Audiencia | Profesionales y negocios de servicios (dentistas, psicólogos, médicos, fotógrafos, consultores, salones, spas, academias, etc.) |
| Modelo | SaaS multi-tenant por suscripción |

---

## Tabla de contenidos

1. [Identidad y dominio](#1-identidad-y-dominio)
2. [Visión general de la arquitectura](#2-visión-general-de-la-arquitectura)
3. [Stack tecnológico (proven stack)](#3-stack-tecnológico-proven-stack)
4. [Arquitectura multi-tenant y portal público](#4-arquitectura-multi-tenant-y-portal-público)
5. [Diseño de base de datos (Drizzle / D1)](#5-diseño-de-base-de-datos-drizzle--d1)
6. [Motor de disponibilidad (Slot Engine)](#6-motor-de-disponibilidad-slot-engine)
7. [Planes de monetización SaaS](#7-planes-de-monetización-saas)
8. [Estructura de directorios del proyecto](#8-estructura-de-directorios-del-proyecto)
9. [API de referencia](#9-api-de-referencia)
10. [Seguridad y aislamiento multi-tenant](#10-seguridad-y-aislamiento-multi-tenant)
11. [Notificaciones transaccionales](#11-notificaciones-transaccionales)
12. [Pagos recurrentes](#12-pagos-recurrentes)
13. [Observabilidad y monitoreo](#13-observabilidad-y-monitoreo)
14. [CI/CD y ambientes](#14-cicd-y-ambientes)
15. [Decisiones y trade-offs](#15-decisiones-y-trade-offs)

---

## 1. Identidad y dominio

**Bookly** es una plataforma SaaS que permite a profesionales y negocios de servicios publicar un **portal de reservas en línea** y gestionar su agenda, servicios, personal y pagos desde un único panel.

### 1.1 Conceptos de negocio

| Concepto | Definición |
|---|---|
| **Empresa / Tenant** | Negocio que se suscribe (clínica, consultorio, estudio, salón). Dueño de todos sus datos. |
| **Slug** | Identificador público único por empresa (`dr-morales-dental`, `estudio-foto-luna`). |
| **Staff / Profesional** | Persona que presta servicios y tiene agenda propia (dentista, fotógrafo, consultor). |
| **Servicio** | Unidad agendable con precio y duración (`Limpieza dental · 30 min · Q150`). |
| **Cliente final** | Persona que reserva desde el portal público, sin necesidad de crear cuenta. |
| **Cita (Appointment)** | Reserva confirmada de uno o más servicios con un staff en un rango horario. |
| **Slot** | Intervalo de tiempo disponible, calculado en tiempo real por el Slot Engine. |

### 1.2 Mapa de navegación público

- Portal público: `https://bookly.ghostlyapps.dev/book/:slug`
- Panel de administración (tenant): `https://bookly.ghostlyapps.dev/app` (SPA autenticada)
- Documentación de API: `https://bookly.ghostlyapps.dev/docs` (generada con OpenAPI)

---

## 2. Visión general de la arquitectura

Bookly sigue una arquitectura **monorepo + edge-first** con una separación estricta entre frontend, API y datos. Todo el backend corre en **Cloudflare Workers** (borde), lo que garantiza latencias de primera petición muy bajas (< 50 ms en regiones atendidas por el edge de Cloudflare).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE FINAL (Navegador)                       │
│   https://bookly.ghostlyapps.dev/book/:slug  (Angular 19, SPA)           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     CLOUDFLARE PAGES (CDN / Edge)                        │
│   Sirve el bundle estático de Angular con cache por hash de contenido    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ /api/* (ruta de proxy hacia Workers)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     CLOUDFLARE WORKERS — API (Hono)                     │
│   Routing · Auth · Validación (Zod) · Rate limiting · Lógica de dominio  │
└──────────────┬──────────────────────────────┬───────────────────────────┘
               │ SQL (Drizzle ORM)            │ HTTP (webhooks)
┌──────────────▼──────────────────┐  ┌────────▼───────────────────────────┐
│     CLOUDFLARE D1 (SQLite)     │  │   Servicios externos               │
│   Datos transaccionales        │  │  · Resend (email transaccional)    │
│   (schema versionado)          │  │  · Recurrente (pagos/suscripción)  │
└────────────────────────────────┘  │  · wa.me (deep link WhatsApp)      │
                                    └────────────────────────────────────┘
```

**Principios arquitectónicos:**

1. **Edge-first**: la lógica corre lo más cerca posible del usuario; D1 replica los datos en el borde.
2. **Multi-tenant por diseño**: cada tabla está particionada por `companyId`; ningún query cruza tenants.
3. **Stateless workers**: la sesión vive en un JWT firmado; no hay estado en memoria entre invocaciones.
4. **Schema versionado**: Drizzle + migraciones SQL tipadas garantizan reproducibilidad del esquema.
5. **Contract-first**: las APIs exponen un contrato OpenAPI validado con Zod.

---

## 3. Stack tecnológico (proven stack)

| Capa | Tecnología | Justificación |
|---|---|---|
| Frontend | **Angular 19** | Standalone Components, Signals, control flow `@if/@for`, SCSS modular, diseño Mobile-First. |
| Backend API | **Cloudflare Workers + Hono** | Edge computing, cold start ~0 ms, latencia < 50 ms, routing ergonómico y tipado. |
| Base de datos | **Cloudflare D1 (SQLite)** + **Drizzle ORM** | SQLite distribuido en el borde, migraciones SQL tipadas, sin servidor de DB que administrar. |
| Pagos | **Recurrente** | Suscripciones y cobros recurrentes con tarjeta Visa/Mastercard (débito y crédito); opcionalmente señas de cita. |
| Notificaciones | **Resend API** | Emails transaccionales (confirmación, recordatorios, alertas) con adjunto `.ics` y enlace directo `wa.me`. |
| Hosting | **Cloudflare Pages** (frontend) + **Cloudflare Workers** (API) | Ambientes Staging y Production, deploy atómico y rollback instantáneo. |

### 3.1 Angular 19 (frontend)

- **Standalone Components**: sin `NgModule`; cada componente declara sus propias dependencias.
- **Signals**: estado reactivo con `signal()`, `computed()`, `effect()`; migración progresiva desde `zone.js`.
- **Control Flow**: sintaxis `@if`, `@for`, `@switch` en templates.
- **SCSS modular**: estilos por componente con `:host`, variables de diseño (design tokens) y tema por tenant (color de marca).
- **Mobile-First**: el portal público se diseña primero para móvil; luego se enriquece en desktop.

```
frontend/
├── src/
│   ├── main.ts
│   ├── app/
│   │   ├── app.config.ts          # provideRouter, provideHttpClient, etc.
│   │   ├── app.routes.ts
│   │   ├── core/                  # guards, interceptors, servicios singulares
│   │   ├── shared/                # componentes y directivas reutilizables
│   │   ├── features/
│   │   │   ├── booking/           # portal público /book/:slug
│   │   │   └── admin/             # panel de gestión del tenant
│   │   └── styles/
│   │       ├── _tokens.scss       # design tokens
│   │       └── theme.scss
│   ├── environments/
│   │   ├── environment.ts         # staging
│   │   └── environment.prod.ts    # production
│   └── index.html
├── angular.json
├── package.json
└── tsconfig.json
```

### 3.2 Hono + Cloudflare Workers (backend)

- **Hono**: routing tipado, middlewares (`cors`, `logger`, `prettyJSON`), binding de entorno tipado con `Env`.
- **Zod**: validación de entrada en el borde; un schema compartido tipa request/response.
- **Drizzle ORM**: acceso tipado a D1 con migraciones generadas por `drizzle-kit`.
- **jose** (o equivalente): firma/verificación de JWT en el borde.

```ts
// workers/src/index.ts (esqueleto de referencia)
import { Hono } from "hono";
import { cors } from "hono/cors";
import { publicApi } from "./routes/public";
import { adminApi } from "./routes/admin";
import { webhooks } from "./routes/webhooks";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());
app.route("/api/public", publicApi);
app.route("/api", adminApi);
app.route("/webhooks", webhooks);

app.get("/health", (c) => c.json({ ok: true, ts: Date.now() }));

export default app;
```

---

## 4. Arquitectura multi-tenant y portal público

### 4.1 Modelo de aislamiento

Bookly usa **multi-tenancy por fila** (shared database, shared schema) con **aislamiento estricto por `companyId`**:

- Cada tabla de dominio lleva una columna `company_id` con clave foránea a `companies`.
- Toda consulta de lectura/escritura filtra por `company_id` de forma obligatoria.
- El `company_id` **nunca** proviene del cliente; se resuelve desde:
  - el **JWT** en el panel administrativo (`sub` → `user_id` → `company_id`), o
  - el **slug** del portal público (`/book/:slug` → `company_id`).

> Regla dura: **no existe un query de dominio sin predicado `WHERE company_id = ?`.** Se implementa con un helper `withTenant(db, companyId)` y se audita en code review.

### 4.2 Flujo del portal público

1. El cliente accede a `https://bookly.ghostlyapps.dev/book/:slug`.
2. El frontend resuelve el `slug` a un perfil público de empresa (`GET /api/public/:slug/company`).
3. Muestra catálogo de servicios con precio y duración.
4. El cliente elige servicio(s) y profesional específico, o **"Cualquiera disponible"**.
5. El calendario consulta disponibilidad en tiempo real (`GET /api/public/:slug/availability`).
6. El cliente elige un slot y registra sus datos (nombre, WhatsApp, email) **sin crear cuenta**.
7. Se crea la cita; se confirma en pantalla y se envía email con `.ics`.
8. Opcionalmente se captura una **seña** mediante Recurrente antes de confirmar.

### 4.3 Reglas de negocio del portal

| Regla | Descripción |
|---|---|
| Sin cuenta previa | El cliente final no necesita registro; se crea/vincula un `customers` por empresa. |
| Anti-doble-reserva | La creación de cita es transaccional y re-valida el slot al insertar (unique lock lógico). |
| Slot exclusivo | Un slot no puede ser reservado dos veces para el mismo staff; el engine excluye citas, descansos y bloqueos. |
| Confirmación inmediata | Pantalla + email con `.ics` y enlace `wa.me` para contactar al negocio. |

---

## 5. Diseño de base de datos (Drizzle / D1)

### 5.1 Convenciones

- **IDs**: enteros auto-incrementales por tabla (suficientes para SQLite en un solo escritor regional). Alternativa evaluada: UUID/ULID en `text` para escalar multi-región.
- **Moneda**: precios en **centavos de Quetzal** (`integer`), nunca `float`. Ej.: `Q149.00` → `14900`.
- **Fechas**: `timestamp_ms` (epoch en milisegundos, UTC). La zona horaria del tenant se aplica solo en presentación y en el Slot Engine.
- **Enums**: `text` con restricción de enum de Drizzle (SQLite no tiene `ENUM` nativo).
- **Soft deletes**: no se implementan de forma global; los registros cancelados usan columnas de estado (`status`).

### 5.2 `schema.ts` (referencia exacta)

```ts
// workers/src/db/schema.ts
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Bookly — Esquema Drizzle para Cloudflare D1 (SQLite).
 * Multi-tenant: toda tabla de dominio particiona por `company_id`.
 * Moneda: centavos de Quetzal (integer). Fechas: epoch ms (UTC).
 */

// Reutilizable: marcas de tiempo con default del motor.
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

// ---------------------------------------------------------------------------
// Catálogo de planes SaaS
// ---------------------------------------------------------------------------
export const saasPlans = sqliteTable(
  "saas_plans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code", { enum: ["basic", "pro", "enterprise"] }).notNull(),
    name: text("name").notNull(),
    // Precio mensual en centavos de Quetzal (Q149.00 -> 14900)
    monthlyPriceQtz: integer("monthly_price_qtz").notNull(),
    // Límite de staff: 1, 5 o -1 (ilimitado)
    maxStaff: integer("max_staff").notNull(),
    // JSON string[] con los features incluidos
    features: text("features", { mode: "json" }).$type<string[]>().notNull(),
    ...timestamps,
  },
  (t) => ({
    codeIdx: uniqueIndex("saas_plans_code_idx").on(t.code),
  }),
);

// ---------------------------------------------------------------------------
// Empresas (tenants)
// ---------------------------------------------------------------------------
export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Identificador público único del portal: /book/:slug
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    planId: integer("plan_id")
      .notNull()
      .references(() => saasPlans.id, { onDelete: "restrict" }),
    subscriptionStatus: text("subscription_status", {
      enum: ["trial", "active", "past_due", "canceled"],
    })
      .notNull()
      .default("trial"),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp_ms" }),
    subscriptionEndsAt: integer("subscription_ends_at", { mode: "timestamp_ms" }),
    // IANA timezone, p.ej. "America/Guatemala" — crítico para el Slot Engine.
    timezone: text("timezone").notNull().default("America/Guatemala"),
    logoUrl: text("logo_url"),
    brandColor: text("brand_color"),
    whatsappNumber: text("whatsapp_number"), // E.164, p.ej. "+50255555555"
    contactEmail: text("contact_email"),
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default(sql`'{}'`),
    ...timestamps,
  },
  (t) => ({
    slugIdx: uniqueIndex("companies_slug_idx").on(t.slug),
    planIdx: index("companies_plan_idx").on(t.planId),
  }),
);

// ---------------------------------------------------------------------------
// Usuarios (propietario, admins y staff de una empresa)
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull(),
    role: text("role", {
      enum: ["owner", "admin", "manager", "staff"],
    }).notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    // Email único dentro de la empresa (un mismo email puede existir en otra).
    companyEmailIdx: uniqueIndex("users_company_email_idx").on(
      t.companyId,
      t.email,
    ),
    companyIdx: index("users_company_idx").on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Servicios agendables
// ---------------------------------------------------------------------------
export const services = sqliteTable(
  "services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Precio en centavos; NULL = "precio a consultar"
    priceQtz: integer("price_qtz"),
    // Duración en minutos: 30, 60, 90...
    durationMinutes: integer("duration_minutes").notNull(),
    // Tiempo de colchón entre citas (minutos)
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    color: text("color"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index("services_company_idx").on(t.companyId),
    companyActiveIdx: index("services_company_active_idx").on(
      t.companyId,
      t.active,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relación staff <-> servicio (qué servicios presta cada profesional)
// ---------------------------------------------------------------------------
export const staffServices = sqliteTable(
  "staff_services",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => ({
    staffServiceIdx: uniqueIndex("staff_services_staff_service_idx").on(
      t.companyId,
      t.userId,
      t.serviceId,
    ),
    serviceIdx: index("staff_services_service_idx").on(t.serviceId),
  }),
);

// ---------------------------------------------------------------------------
// Horario laboral (por día de la semana)
// ---------------------------------------------------------------------------
export const workingHours = sqliteTable(
  "working_hours",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // NULL = horario por defecto de la empresa; valor = horario de un staff.
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    // 0 = domingo ... 6 = sábado
    dayOfWeek: integer("day_of_week").notNull(),
    // Hora en formato "HH:mm" local del tenant (p.ej. "09:00", "17:30")
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    // Descanso / almuerzo opcional dentro de la jornada
    breakStartTime: text("break_start_time"),
    breakEndTime: text("break_end_time"),
    ...timestamps,
  },
  (t) => ({
    companyUserDayIdx: uniqueIndex("working_hours_company_user_day_idx").on(
      t.companyId,
      t.userId,
      t.dayOfWeek,
    ),
    companyIdx: index("working_hours_company_idx").on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Bloqueos de agenda (vacaciones, feriados, mantenimiento, personal)
// ---------------------------------------------------------------------------
export const blockedSlots = sqliteTable(
  "blocked_slots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // NULL = bloqueo a nivel de empresa; valor = bloqueo de un staff.
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    reason: text("reason", {
      enum: ["holiday", "vacation", "personal", "maintenance", "other"],
    }).notNull(),
    ...timestamps,
  },
  (t) => ({
    // Búsqueda por rango de fechas (Slot Engine)
    rangeIdx: index("blocked_slots_company_range_idx").on(
      t.companyId,
      t.startAt,
      t.endAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Clientes finales (no requieren cuenta)
// ---------------------------------------------------------------------------
export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phoneWhatsapp: text("phone_whatsapp").notNull(), // E.164
    email: text("email"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    companyIdx: index("customers_company_idx").on(t.companyId),
    companyPhoneIdx: uniqueIndex("customers_company_phone_idx").on(
      t.companyId,
      t.phoneWhatsapp,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Citas
// ---------------------------------------------------------------------------
export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    // NULL = "Cualquiera disponible" (se asigna staff luego o en el check-in)
    staffId: integer("staff_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status", {
      enum: ["pending", "confirmed", "completed", "canceled", "no_show"],
    })
      .notNull()
      .default("confirmed"),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    // Snapshot del buffer aplicado al reservar (para reproducción exacta)
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    source: text("source", { enum: ["public_portal", "admin", "staff"] })
      .notNull()
      .default("public_portal"),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    // Slot Engine: solapamiento por staff en un rango de fechas
    staffRangeIdx: index("appointments_staff_range_idx").on(
      t.companyId,
      t.staffId,
      t.startAt,
      t.endAt,
    ),
    companyRangeIdx: index("appointments_company_range_idx").on(
      t.companyId,
      t.startAt,
      t.endAt,
    ),
    statusIdx: index("appointments_status_idx").on(t.companyId, t.status),
  }),
);

// ---------------------------------------------------------------------------
// Ítems de la cita (una cita puede incluir varios servicios)
// ---------------------------------------------------------------------------
export const appointmentItems = sqliteTable(
  "appointment_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    // Snapshots para inmutabilidad del registro histórico
    serviceName: text("service_name").notNull(),
    priceQtz: integer("price_qtz").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull(),
    ...timestamps,
  },
  (t) => ({
    appointmentIdx: index("appointment_items_appointment_idx").on(
      t.appointmentId,
    ),
    companyIdx: index("appointment_items_company_idx").on(t.companyId),
  }),
);

// ---------------------------------------------------------------------------
// Facturas
// ---------------------------------------------------------------------------
export const invoices = sqliteTable(
  "invoices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    appointmentId: integer("appointment_id").references(
      () => appointments.id,
      { onDelete: "set null" },
    ),
    // Número de factura secuencial por empresa (p.ej. "INV-000123")
    number: text("number").notNull(),
    subtotalQtz: integer("subtotal_qtz").notNull().default(0),
    taxQtz: integer("tax_qtz").notNull().default(0),
    totalQtz: integer("total_qtz").notNull().default(0),
    status: text("status", {
      enum: ["draft", "open", "paid", "void", "refunded"],
    })
      .notNull()
      .default("open"),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => ({
    companyNumberIdx: uniqueIndex("invoices_company_number_idx").on(
      t.companyId,
      t.number,
    ),
    appointmentIdx: index("invoices_appointment_idx").on(t.appointmentId),
  }),
);

// ---------------------------------------------------------------------------
// Pagos (tarjeta vía Recurrente, señas y suscripciones)
// ---------------------------------------------------------------------------
export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    provider: text("provider", { enum: ["recurrente"] })
      .notNull()
      .default("recurrente"),
    providerPaymentId: text("provider_payment_id"),
    amountQtz: integer("amount_qtz").notNull(),
    currency: text("currency").notNull().default("GTQ"),
    status: text("status", {
      enum: ["pending", "succeeded", "failed", "refunded"],
    })
      .notNull()
      .default("pending"),
    paymentMethod: text("payment_method", { enum: ["card"] }).notNull(),
    cardBrand: text("card_brand", { enum: ["visa", "mastercard"] }),
    cardLast4: text("card_last4"),
    // Referencia a la suscripción recurrente (plan SaaS o seña recurrente)
    subscriptionId: text("subscription_id"),
    ...timestamps,
  },
  (t) => ({
    invoiceIdx: index("payments_invoice_idx").on(t.invoiceId),
    companyIdx: index("payments_company_idx").on(t.companyId),
    providerPaymentIdx: uniqueIndex("payments_provider_payment_idx").on(
      t.providerPaymentId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Tipos derivados (útil para inserts/selects tipados)
// ---------------------------------------------------------------------------
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
```

### 5.3 Diagrama de relaciones (entidad-relación)

```
saasPlans 1 ────< companies 1 ────< users
                    │               │
                    │               ├───< workingHours
                    │               ├───< blockedSlots
                    │               └───< staffServices >──── services
                    │
                    ├───< services
                    ├───< customers 1 ────< appointments 1 ────< appointmentItems >── services
                    │                         │
                    │                         ├───< invoices 1 ────< payments
                    └───< invoices
```

### 5.4 Índices críticos

| Índice | Propósito |
|---|---|
| `companies.slug` (único) | Resolución del portal público por slug. |
| `appointments(company_id, staff_id, start_at, end_at)` | Solapamiento de citas por staff y rango (Slot Engine). |
| `appointments(company_id, start_at, end_at)` | Solapamiento a nivel empresa ("Cualquiera disponible"). |
| `blocked_slots(company_id, start_at, end_at)` | Exclusión de bloqueos por rango. |
| `working_hours(company_id, user_id, day_of_week)` (único) | Horario por staff y día. |
| `users(company_id, email)` (único) | Login único por empresa. |
| `customers(company_id, phone_whatsapp)` (único) | Deduplicación de clientes por WhatsApp. |

---

## 6. Motor de disponibilidad (Slot Engine)

El Slot Engine convierte el **horario laboral** en **slots disponibles**, restando descansos, citas existentes, buffer time y bloqueos.

### 6.1 Fórmula conceptual

```
Slots disponibles =
    Horario laboral (workingHours)
  - Descansos / almuerzo (break)
  - Citas existentes (appointments) + buffer time
  - Bloqueos (blockedSlots)
```

### 6.2 Algoritmo paso a paso

1. **Resolver el tenant**: a partir del `slug` (portal) o `companyId` (admin), obtener `companies.timezone`.

2. **Normalizar el día solicitado**: convertir la fecha pedida (`YYYY-MM-DD`) a la zona horaria del tenant. El Slot Engine opera **siempre en tiempo local del negocio** y almacena/expone en UTC.

3. **Determinar la ventana laboral**:
   - `dayOfWeek = date.getDay()` (0–6).
   - Leer `workingHours` para el staff objetivo; si no hay registro para el staff, usar el horario por defecto de la empresa (`userId IS NULL`).
   - Ventana base: `[startTime, endTime]` del día, p.ej. `09:00 → 17:00`.

4. **Aplicar descansos**: si existe `breakStartTime`/`breakEndTime`, marcar ese intervalo como no disponible.

5. **Calcular duración efectiva del servicio**: `duration = service.durationMinutes + bufferAfterMinutes` (el buffer se consume al final de la cita, por defecto).

6. **Generar slots candidatos**: partiendo de `startTime`, avanzar en pasos de `slotIntervalMinutes` (por defecto 15 min, configurable por empresa) hasta `endTime - duration`. Cada candidato es un instante de inicio.

7. **Cargar ocupación**:
   - Citas del staff en el rango `[startOfDay, endOfDay]` (en UTC), incluyendo estados `pending`/`confirmed`.
   - `blockedSlots` del staff y de la empresa en el mismo rango.
   - Cada cita genera un intervalo ocupado `[startAt, endAt + bufferMinutes]`.

8. **Evaluar solapamiento**: un candidato `[slotStart, slotStart + duration]` está **disponible** si no interseca ningún intervalo ocupado. Para "Cualquiera disponible", un slot está disponible si **al menos un staff** lo tiene libre.

9. **Emitir resultado**: lista de slots con `startAt` (UTC), `staffId` (o `null` si "cualquiera"), `staffName` y duración.

10. **Re-validación transaccional**: al reservar, se re-ejecuta el chequeo de solapamiento dentro de la misma transacción para evitar condiciones de carrera (doble reserva).

### 6.3 Pseudocódigo tipado

```ts
interface AvailabilityQuery {
  companyId: number;
  serviceId: number;      // o number[] si son varios servicios
  staffId?: number | null; // null = "Cualquiera disponible"
  date: string;            // "YYYY-MM-DD" (local del tenant)
  timezone: string;        // IANA, p.ej. "America/Guatemala"
}

interface Slot {
  startAt: number;         // epoch ms UTC
  endAt: number;
  staffId: number | null;
  staffName: string | null;
}

async function computeAvailability(
  db: DrizzleD1,
  q: AvailabilityQuery,
): Promise<Slot[]> {
  // 1. Día local del tenant
  const dayStart = zonedStartOfDay(q.date, q.timezone); // epoch ms UTC
  const dayEnd = zonedEndOfDay(q.date, q.timezone);

  // 2. Servicio y su duración + buffer
  const service = await db.query.services.findFirst({
    where: and(eq(services.companyId, q.companyId), eq(services.id, q.serviceId)),
  });
  const duration = service.durationMinutes + service.bufferAfterMinutes;

  // 3. Staffs candidatos
  const staffIds = q.staffId
    ? [q.staffId]
    : (await getStaffForService(db, q.companyId, q.serviceId)).map((s) => s.id);

  // 4. Horario laboral del día (staff o default de empresa)
  const hours = await getWorkingHours(db, q.companyId, q.staffId, dayOfWeek(q.date));

  // 5. Ocupación: citas activas + bloqueos
  const busy = await getBusyIntervals(db, q.companyId, staffIds, dayStart, dayEnd);
  // busy: Array<{ staffId: number | null; startAt: number; endAt: number }>

  // 6. Generar candidatos dentro de [start, end] respetando descanso
  const candidates = generateCandidates(hours, duration, slotIntervalMinutes);

  // 7. Filtrar candidatos por solapamiento
  const slots: Slot[] = [];
  for (const cand of candidates) {
    for (const staffId of staffIds) {
      if (!overlaps(cand.startAt, cand.endAt, busy, staffId)) {
        slots.push({ startAt: cand.startAt, endAt: cand.endAt, staffId, ... });
        break; // "Cualquiera disponible": basta un staff libre
      }
    }
  }
  return slots;
}

function overlaps(start: number, end: number, busy: Busy[], staffId: number | null) {
  return busy.some(
    (b) =>
      (b.staffId === null || b.staffId === staffId) &&
      start < b.endAt &&
      end > b.startAt,
  );
}
```

### 6.4 Reglas de solapamiento

| Regla | Resultado |
|---|---|
| `start < ocupado.end && end > ocupado.start` | Hay solapamiento (slot no disponible). |
| Cita con buffer | El intervalo ocupado es `[startAt, endAt + bufferMinutes]`. |
| Bloqueo de empresa (`userId = null`) | Bloquea a todos los staff. |
| Bloqueo de staff | Bloquea solo a ese staff. |
| Slot al borde (`end == ocupado.start`) | **Disponible** (sin solapamiento; el buffer ya se aplicó). |

### 6.5 Consideraciones de borde

- **Zonas horarias**: el engine nunca usa la zona del navegador del cliente; usa `companies.timezone` como fuente de verdad.
- **Horarios nocturnos** (fin > inicio, p.ej. `22:00 → 02:00`): el rango se interpreta como cruzando medianoche.
- **DST**: las operaciones de fecha usan la librería de zona horaria IANA del runtime para convertir correctamente.
- **Duración compuesta**: si una cita tiene varios servicios, la duración es la suma y el buffer se aplica una sola vez.

---

## 7. Planes de monetización SaaS

| Característica | Básico | Pro | Enterprise |
|---|---|---|---|
| Precio mensual | **Q149** | **Q299** | **Q599** |
| Profesionales / staff | 1 | Hasta 5 | Ilimitados |
| Citas | Ilimitadas | Ilimitadas | Ilimitadas |
| Portal público | ✅ | ✅ | ✅ |
| Recordatorios | Básicos | Avanzados | Avanzados |
| Multi-servicio | — | ✅ | ✅ |
| Pagos / señas | — | ✅ | ✅ |
| Multi-sucursal | — | — | ✅ |
| Soporte | Estándar | Prioritario | VIP |

### 7.1 Mapeo al schema

| Plan | `saasPlans.code` | `maxStaff` | `monthlyPriceQtz` |
|---|---|---|---|
| Básico | `basic` | `1` | `14900` |
| Pro | `pro` | `5` | `29900` |
| Enterprise | `enterprise` | `-1` | `59900` |

### 7.2 Lógica de enforcement del plan

- **Límite de staff**: al crear un `users` con `role = staff`, validar `COUNT(users WHERE company_id = ? AND role = 'staff') < saasPlans.maxStaff` (salvo `-1`).
- **Pagos/señas**: la creación de `payments` solo se habilita en Pro/Enterprise.
- **Multi-sucursal**: Enterprise. (Requiere evolución del schema: tabla `branches` con `company_id`, y `branch_id` en `users`, `services` y `appointments`. Se modela en la fase 2.)

### 7.3 Ciclo de suscripción

```
trial (14 días) → active → past_due (retry) → canceled
```

El estado se guarda en `companies.subscriptionStatus`. Los webhooks de Recurrente (`invoice.paid`, `subscription.canceled`, `payment.failed`) actualizan este estado y crean/actualizan `payments` e `invoices` de la suscripción.

---

## 8. Estructura de directorios del proyecto

Monorepo con workspaces npm/pnpm, dos aplicaciones principales y un paquete compartido de contratos.

```
bookly/
├── package.json                 # workspaces + scripts de orquestación
├── pnpm-workspace.yaml          # (o workspaces en package.json)
├── tsconfig.base.json
├── .gitignore
├── .editorconfig
├── .github/
│   └── workflows/
│       ├── ci.yml               # lint + test + typecheck
│       ├── deploy-staging.yml   # Workers + Pages → staging
│       └── deploy-production.yml# Workers + Pages → production
├── packages/
│   └── contracts/               # Tipos y schemas Zod compartidos FE/BE
│       ├── src/
│       │   ├── public.ts        # DTOs del portal público
│       │   ├── admin.ts         # DTOs del panel
│       │   └── index.ts
│       └── package.json
├── frontend/                    # Angular 19
│   ├── src/
│   │   ├── main.ts
│   │   ├── app/
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   ├── core/
│   │   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   └── interceptors/
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   ├── directives/
│   │   │   │   └── pipes/
│   │   │   ├── features/
│   │   │   │   ├── booking/     # portal público /book/:slug
│   │   │   │   │   ├── booking.routes.ts
│   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── booking-page/
│   │   │   │   │   │   ├── services-step/
│   │   │   │   │   │   ├── staff-step/
│   │   │   │   │   │   ├── calendar-step/
│   │   │   │   │   │   └── confirm-step/
│   │   │   │   │   └── components/
│   │   │   │   └── admin/       # panel de gestión del tenant
│   │   │   │       ├── admin.routes.ts
│   │   │   │       ├── dashboard/
│   │   │   │       ├── services/
│   │   │   │       ├── staff/
│   │   │   │       ├── schedule/
│   │   │   │       ├── appointments/
│   │   │   │       ├── customers/
│   │   │   │       ├── billing/
│   │   │   │       └── settings/
│   │   │   └── auth/
│   │   └── styles/
│   │       ├── _tokens.scss
│   │       └── theme.scss
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
└── workers/                     # Hono + Drizzle
    ├── src/
    │   ├── index.ts             # app Hono raíz
    │   ├── types.ts             # Env (bindings D1, KV, secrets)
    │   ├── db/
    │   │   ├── schema.ts        # schema Drizzle (sección 5)
    │   │   ├── client.ts        # drizzle(D1) con logger
    │   │   └── migrate.ts
    │   ├── middleware/
    │   │   ├── auth.ts          # JWT verify + tenancy
    │   │   ├── tenant.ts        # resuelve companyId por slug/JWT
    │   │   └── rate-limit.ts
    │   ├── routes/
    │   │   ├── public.ts        # portal público
    │   │   ├── admin.ts         # panel autenticado
    │   │   └── webhooks.ts      # Recurrente + Resend
    │   ├── services/
    │   │   ├── availability.ts  # Slot Engine
    │   │   ├── booking.ts       # creación transaccional de citas
    │   │   ├── billing.ts
    │   │   ├── notifications.ts # Resend + .ics + wa.me
    │   │   └── payments.ts
    │   └── utils/
    │       ├── time.ts          # zona horaria, epoch, .ics
    │       └── id.ts
    ├── drizzle/
    │   └── migrations/          # migraciones SQL generadas
    ├── drizzle.config.ts
    ├── wrangler.toml
    ├── package.json
    └── tsconfig.json
```

---

## 9. API de referencia

### 9.1 Portal público (`/api/public`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/public/:slug/company` | Perfil público: nombre, logo, color, WhatsApp, horario. |
| `GET` | `/api/public/:slug/services` | Catálogo de servicios activos (precio, duración). |
| `GET` | `/api/public/:slug/staff` | Lista de profesionales disponibles. |
| `GET` | `/api/public/:slug/availability` | Slots disponibles en tiempo real. Query: `serviceId`, `staffId?`, `date`, `timezone`. |
| `POST` | `/api/public/:slug/appointments` | Crea una reserva. Body: `customer`, `items[]`, `startAt`, `staffId?`. |
| `GET` | `/api/public/appointments/:token` | Estado de una reserva (confirmación con token público). |

### 9.2 Panel administrativo (`/api`, autenticado)

| Recurso | Rutas |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me` |
| Empresa | `GET/PATCH /api/company` |
| Servicios | `GET/POST /api/services`, `GET/PATCH/DELETE /api/services/:id` |
| Staff | `GET/POST /api/staff`, `GET/PATCH/DELETE /api/staff/:id` |
| Horarios | `GET/PUT /api/schedule/working-hours` |
| Bloqueos | `GET/POST /api/schedule/blocks`, `DELETE /api/schedule/blocks/:id` |
| Citas | `GET/POST /api/appointments`, `GET/PATCH/DELETE /api/appointments/:id` |
| Clientes | `GET/POST /api/customers`, `GET/PATCH /api/customers/:id` |
| Facturas | `GET /api/invoices`, `GET /api/invoices/:id` |
| Pagos | `GET /api/payments`, `POST /api/payments/checkout` |
| Suscripción | `GET /api/billing/subscription`, `POST /api/billing/checkout` |

### 9.3 Webhooks externos

| Método | Ruta | Origen |
|---|---|---|
| `POST` | `/webhooks/recurrente` | Eventos de pago/suscripción de Recurrente. |
| `POST` | `/webhooks/resend` | Eventos de entrega de email (opcional, para métricas). |

---

## 10. Seguridad y aislamiento multi-tenant

- **Autenticación**: JWT firmado (HS256/RS256) con claims `sub` (user_id) y `companyId`. Expiración corta + refresh token en cookie `httpOnly`.
- **Autorización**: RBAC por `role` (`owner`, `admin`, `manager`, `staff`). Un guard verifica `companyId` del JWT contra el recurso accedido.
- **Tenancy estricta**: helper `withTenant(db, companyId)`; todo query de dominio filtra por `company_id`. Prohibido `SELECT` sin filtro de tenant.
- **Portal público**: token de confirmación firmado (no adivinable) para consultar reservas sin login.
- **Rate limiting**: por IP (portal) y por usuario/tenant (API) para mitigar abuso del endpoint de disponibilidad.
- **Validación**: Zod en todos los cuerpos de request; nunca se confía en el `companyId` enviado por el cliente.
- **Secretos**: almacenados en variables de entorno de Cloudflare (encrypted), nunca en el repositorio.
- **Datos personales**: mínimos (nombre, teléfono, email); cifrado en tránsito (TLS) y en reposo (D1). Retención configurable por política de privacidad.

---

## 11. Notificaciones transaccionales

Motor de notificaciones basado en **Resend** con eventos de dominio.

| Evento | Email | Contenido |
|---|---|---|
| `appointment.created` | Cliente + negocio | Confirmación con detalles y adjunto `.ics`. |
| `appointment.reminder` | Cliente | Recordatorio (24h / 1h antes) con enlace `wa.me`. |
| `appointment.canceled` | Cliente | Cancelación y opción de reprogramar. |
| `payment.confirmed` | Cliente | Recibo de seña/suscripción. |

### 11.1 Flujo de confirmación

1. Al crear la cita, el servicio `notifications.ts` encola el email (o usa `waitUntil` del Worker).
2. Genera el archivo `.ics` (VCALENDAR) con `startAt`/`endAt` en UTC y `TZID` del tenant.
3. Adjunta el `.ics` al email de Resend.
4. Incluye enlace directo a WhatsApp: `https://wa.me/<whatsappNumber>?text=<mensaje codificado>`.

### 11.2 Ejemplo de payload `.ics`

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//GhostlyApps//Bookly//ES
BEGIN:VEVENT
UID:appt_123@bookly.ghostlyapps.dev
DTSTAMP:20250101T120000Z
DTSTART:20250110T160000Z
DTEND:20250110T163000Z
SUMMARY:Limpieza dental — Dr. Morales
LOCATION:Clínica Dental Morales
DESCRIPTION:Reserva confirmada. Contacto: https://wa.me/50255555555
END:VEVENT
END:VCALENDAR
```

---

## 12. Pagos recurrentes

Integración con **Recurrente** (tarjeta de crédito/débito Visa/Mastercard).

### 12.1 Casos de uso

1. **Suscripción SaaS** (mensual): el tenant paga su plan (Q149/Q299/Q599) con cobro recurrente.
2. **Seña de cita** (opcional, Pro/Enterprise): el cliente final deja un depósito antes de confirmar.

### 12.2 Flujo (checkout)

1. Frontend solicita un `checkout` al backend.
2. Backend crea la intención/sesión en Recurrente y devuelve la URL o token de pago.
3. Recurrente tokeniza la tarjeta y procesa el cobro (no se almacenan datos de tarjeta en Bookly).
4. Recurrente notifica por webhook (`payment.succeeded`, `payment.failed`, `subscription.canceled`).
5. Backend valida la firma del webhook y actualiza `payments` + `invoices` + `companies.subscriptionStatus`.

> **PCI-DSS**: Bookly nunca toca datos de tarjeta; la captura es 100% en el widget de Recurrente (iframe/tokenización).

---

## 13. Observabilidad y monitoreo

- **Logs**: `console.log` estructurado (JSON) capturado por Cloudflare Workers.
- **Métricas**: latencia y error rate por ruta; contadores de reservas por tenant y por plan.
- **Alertas**: umbral de errores 5xx, fallos de webhook, picos de rate limiting.
- **Trazabilidad**: `requestId` propagado en cada request (header `x-request-id`).
- **Health checks**: `GET /health` para balanceadores y monitores.

---

## 14. CI/CD y ambientes

| Ambiente | URL | Configuración |
|---|---|---|
| Staging | `https://bookly-staging.ghostlyapps.dev` | D1 y Workers de staging; datos de prueba. |
| Production | `https://bookly.ghostlyapps.dev` | D1 y Workers de producción; datos reales. |

**Pipeline (por PR → merge):**

1. `ci.yml`: lint (ESLint), typecheck (tsc), test unitarios (Vitest para workers, Karma/Jest para Angular).
2. `deploy-staging.yml` (rama `main`): publica Workers (`wrangler deploy --env staging`) y Pages.
3. `deploy-production.yml` (tag/release): publica Workers (`wrangler deploy --env production`) y Pages.

**Migraciones D1**: `wrangler d1 migrations apply bookly-db --env <env>` como paso previo al deploy de Workers.

---

## 15. Decisiones y trade-offs

| Decisión | Alternativa | Trade-off elegido |
|---|---|---|
| D1 (SQLite) | PostgreSQL (Neon/Supabase) | Menor latencia edge y cero-ops, a cambio de no tener joins distribuidos complejos. |
| Multi-tenant por fila | Base por tenant | Más simple y barato de operar; requiere disciplina de `company_id`. |
| IDs enteros | UUID/ULID | Simplicidad de índices; ULID se adopta si se escala multi-región. |
| Precios en centavos | `real`/`float` | Precisión monetaria exacta, evita errores de redondeo. |
| Snapshots en `appointmentItems` | Solo FK | Inmutabilidad histórica: si el precio cambia, la cita pasada no se altera. |
| Buffer al final de la cita | Buffer antes | Evita solapamientos inmediatos tras cada servicio; configurable por servicio. |

---

*Documento de referencia — Bookly by GhostlyApps. Versión 1.0.*
