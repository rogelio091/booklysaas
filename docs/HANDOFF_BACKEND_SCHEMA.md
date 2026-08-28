# Handoff — Backend Agent: Migración de Schema + Cifrado Base

> Documento de traspaso para el agente de backend (gentle-ai-worker o sdd-apply).
> **Este documento es la única autoridad de trabajo para este bloque.** Lee primero los archivos citados, no asumas nada.

---

## 1. Objetivo del bloque

Ejecutar la **migración de schema** que habilita los hallazgos pendientes de la especificación, y crear la **utilidad de cifrado simétrico** base. Este bloque NO implementa la lógica de negocio completa (confirmación, pagos, superadmin); solo deja la **estructura de datos** y la **infraestructura criptográfica** listas.

Cierra los siguientes hallazgos del Judgment Day:
- **JD-003** (entidad `locations`)
- **JD-004** (límites por plan: `monthlyAppointments`, `billing_day`)
- **JD-005** (estado `locked` + `TenantBilling`)
- **JD-A-006** (campo `is_default` en services)
- **JD-B-012** (token público de cancelación)
- **P-001 / P-014** (utilidad de cifrado simétrico AES)
- **P-006 / P-007 / P-008** (columnas de pagos/keys del tenant)

---

## 2. Archivos que DEBES leer primero (en este orden)

1. **`docs/USE_CASES.md`** — especificación funcional completa. Presta especial atención a:
   - §2.1 (tabla `companies`)
   - §3.1 (tabla `services` + `is_default`)
   - §4.1–§4.3 (tabla `locations` + pivot `service_locations`)
   - §5.1–§5.2 (working_hours / blocked_slots con `location_id`)
   - §7.3 (estados de cita + token público)
   - §9.1–§9.4 (planes, límites, `TenantBilling`, estado `locked`)
   - §9.5–§9.6 (doble integración Recurrente + anticipo/seña)
   - §14 y §14.1 (hallazgos, fuente de implementación)

2. **`workers/src/db/schema.ts`** — schema Drizzle ACTUAL (para saber qué agregar).

3. **`workers/src/db/migrations/`** — migraciones existentes (`0000_*`, `0001_*`) y `meta/_journal.json`.

4. **`workers/drizzle.config.ts`** — config de drizzle-kit.

5. **`workers/wrangler.toml`** + **`wrangler.staging.toml`** + **`wrangler.prod.toml`** — para el scheduled trigger del cron (hallazgo P-010).

---

## 3. Cambios de schema REQUERIDOS

### 3.1 `saasPlans` — agregar columna
```ts
monthlyAppointments: integer('monthly_appointments').notNull().default(100),
```

### 3.2 `companies` — agregar columnas
```ts
billingDay: integer('billing_day').notNull().default(1),
subscriptionStatus: text(... enum: ['trial','active','past_due','canceled','locked']),  // + 'locked'
recurrenteApiKeyEnc: text('recurrente_api_key_enc'),   // cifrado AES
recurrenteWebhookSecretEnc: text('recurrente_webhook_secret_enc'),  // cifrado AES
```

### 3.3 NUEVA tabla `locations` (lugares de atención)
```ts
id, companyId, name, address, slug (unique por company), isActive, timestamps
```
Índice: `companyIdx` on companyId.

### 3.4 NUEVA tabla pivote `serviceLocations`
```ts
serviceId, locationId, companyId  // PK compuesta (serviceId, locationId)
```
Índice: `companyIdx`.

### 3.5 `services` — agregar columnas
```ts
isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
requiresDeposit: integer('requires_deposit', { mode: 'boolean' }).notNull().default(false),
depositAmountQtz: integer('deposit_amount_qtz').notNull().default(0),
depositPercentage: integer('deposit_percentage'),  // 0-100, alternativa al monto fijo
autoConfirmOnPayment: integer('auto_confirm_on_payment', { mode: 'boolean' }).notNull().default(false),
```

### 3.6 `workingHours` — agregar columna
```ts
locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }),  // nullable
```

### 3.7 `blockedSlots` — agregar columna
```ts
locationId: integer('location_id').references(() => locations.id, { onDelete: 'cascade' }),  // nullable
```

### 3.8 `appointments` — agregar columnas
```ts
publicToken: text('public_token'),  // token no adivinable para autogestión del cliente
locationId: integer('location_id').references(() => locations.id, { onDelete: 'set null' }),  // nullable
```

### 3.9 `payments` — agregar columnas
```ts
appointmentId: integer('appointment_id').references(() => appointments.id, { onDelete: 'set null' }),  // nullable
```
> P-008: sin `appointment_id` no se puede auto-confirmar ni reembolsar una cita.

### 3.10 NUEVA tabla `tenantBillings` (ciclo de suscripción)
```ts
id, companyId (fk), periodStart, periodEnd, amountQtz,
status: enum ['pending','paid','overdue','void'],
recurrenteInvoiceId (text), paidAt, timestamps
```
Índices: `companyIdx`, `statusIdx`.

---

## 4. Utilidad de cifrado simétrico (CIERRA P-001 / P-014)

Crear **`workers/src/utils/crypto.ts`** usando Web Crypto API (AES-GCM, autenticado):

```ts
// API
encryptSecret(plaintext: string, key: CryptoKey): Promise<string>  // formato: iv.base64 + tag + ciphertext
decryptSecret(payload: string, key: CryptoKey): Promise<string>
generateDataKey(secret: string): Promise<CryptoKey>  // deriva clave desde env SECRET con HKDF
```

Requisitos:
- Usar **AES-GCM** (cifrado autenticado, 128/256).
- Soporte **key versioning**: prefijo en el payload (ej: `v1:iv.ciphertext`).
- Permitir **rotación**: la clave maestra vive en `env.ENCRYPTION_KEY` (secret de Cloudflare), NO en el código.
- Nunca exponer el texto plano; solo texto cifrado en DB.
- Escribir tests unitarios (`crypto.spec.ts`): round-trip cifra→descifra, y descifrado con payload corrupto debe fallar.

Agregar `ENCRYPTION_KEY` a los 3 `wrangler.*.toml` como var/secret documentada.

---

## 5. Scheduled trigger para cron (CIERRA P-010 parcial)

Configurar un trigger programado en los `wrangler.*.toml` para futura liberación de slots con seña no pagada y recordatorios:
```toml
[triggers]
crons = ["0 * * * *"]  # cada hora
```
> Solo deja la infraestructura. La lógica del cron se implementa en un bloque posterior.

---

## 6. Generar y verificar

```bash
# 1. Generar la migración nueva
cd workers && pnpm db:generate

# 2. Verificar typecheck
pnpm -r typecheck

# 3. Ejecutar tests (deben pasar: slot-engine 18, notification 3, webhooks 2, + crypto nuevos)
pnpm --filter bookly-api test

# 4. Aplicar a staging (NO a producción)
pnpm --filter bookly-api db:migrate:staging
```

> **NO** aplicar migración a producción (`db:migrate:prod`) en este bloque. Solo staging.

---

## 7. Resultado esperado

Al terminar, reportar:
1. Archivos modificados/creados.
2. Migración generada (nombre).
3. Tests pasando (incluir count de crypto).
4. Qué hallazgos quedaron cerrados y cuáles quedan abiertos.
5. Cualquier riesgo o decisión que requiera al dueño del producto.

---

## 8. NO hacer en este bloque

- NO implementar la lógica de confirmación `pending→confirmed`.
- NO implementar el flujo completo de checkout Recurrente.
- NO implementar superadmin routes.
- NO tocar producción.
- NO crear el webhook `/webhooks/tenant-payments` (bloque posterior).
- NO commitear a `master`; trabajar solo en `develop`.
