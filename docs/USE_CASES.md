# Bookly — Especificación Funcional y Casos de Uso

> Documento vivo de referencia. Define el funcionamiento de la plataforma Bookly.
> Basado en el patrón multi-tenant validado en BarberApp y adaptado al dominio de agendamiento.
> Autoridad sobre este documento: equipo de desarrollo.

**Última actualización:** 2026-08-28 (pagos del tenant + anticipo/seña + trial 30 días)

---

## 1. Actores y Roles

### 1.1 Roles de usuario

| Rol | Descripción | Alcance |
|---|---|---|
| `superadmin` | Dueño de la plataforma Bookly | Crear empresas, gestionar suscripciones, ver todos los tenants, facturación masiva |
| `admin` | Dueño del negocio / tenant | Configurar servicios, horarios, lugares, staff; gestionar citas; ver panel completo |
| `staff` | Profesional del negocio | Ver y gestionar su propia agenda; estado de sus citas |

### 1.2 Actores externos

| Actor | Descripción |
|---|---|
| `cliente` | Persona que reserva desde el portal público SIN crear cuenta |
| `sistema` | Procesos automáticos (webhooks, cron, notificaciones) |
| `recurrente` | Pasarela de pago externa — 2 usos: (a) suscripción a Bookly (key de la plataforma), (b) cobro de anticipos/señas al tenant (key propia del negocio) |
| `resend` | Servicio de email transaccional |

---

## 2. Modelo Multi-Tenant (Empresa)

### 2.1 Tabla `companies`

Cada empresa es un **tenant aislado por `company_id`**. Toda query de dominio filtra por este campo (helper `withTenant()`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | integer | PK autoincremental |
| `name` | text | Nombre del negocio |
| `slug` | text (unique) | Identificador del link público `/book/:slug` |
| `email` | text | Contacto |
| `phone` | text | |
| `timezone` | text | IANA, fuente de verdad del Slot Engine |
| `currency` | text | `GTQ` |
| `brand_color` | text | Marca |
| `theme` | enum | `midnight-emerald` \| `obsidian-luxe` \| `titanium-oled` |
| `logo_url` | text | |
| `plan_id` | fk → `saas_plans` | Plan activo |
| `subscription_status` | enum | `trial` \| `active` \| `past_due` \| `canceled` \| `locked` |
| `trial_ends_at` | timestamp | |
| `recurrente_subscription_id` | text | ID de suscripción en pasarela (cobro a Bookly) |
| `recurrente_api_key_enc` | text | **API key de Recurrente del tenant (cifrada)** para cobrar anticipos/señas — write-only, nunca se expone |
| `recurrente_webhook_secret_enc` | text | Secreto de webhook del tenant (cifrado) para validar pagos de sus citas |
| `billing_day` | int | Día de facturación |

### 2.2 Aislamiento

Regla dura: **no existe query de dominio sin `WHERE company_id = ?`**. Implementado con `withTenant(table, companyId)` y auditado en code review. El `company_id` NUNCA viene del body del cliente (salvo superadmin); se resuelve desde el JWT.

---

## 3. Catálogo de Servicios (núcleo de la reserva)

### 3.1 Tabla `services`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | integer | PK |
| `company_id` | fk | |
| `name` | text | Ej: "Limpieza Dental Profunda" |
| `description` | text | |
| `duration_minutes` | int | **Define los slots del calendario** |
| `buffer_after_minutes` | int | Espacio libre tras la cita |
| `price_qtz` | int | Precio en centavos enteros (Q149.00 → 14900) |
| `is_active` | boolean | Muestra/oculta en portal |
| `display_order` | int | Orden en el catálogo |
| `is_default` | boolean | Marca el "servicio general" (negocios sin catálogo) |

### 3.2 Regla del tiempo enlazado al servicio

El **Slot Engine requiere la duración del servicio** para generar disponibilidad. Por ello:

- El cliente **siempre elige un servicio** antes de ver horarios.
- La duración del servicio determina cuántos slots caben en el día.
- Las empresas que no quieren catálogo crean UN **servicio general** (`is_default: true`, ej: "Cita estándar · 60 min") y el cliente solo elige horario.

---

## 4. Lugares de Atención (en vez de "sucursal")

> Decisión: el concepto no es "sucursal corporativa" sino **dónde se presta el servicio físicamente**.

### 4.1 Tabla `locations`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | integer | PK |
| `company_id` | fk | |
| `name` | text | Ej: "Consultorio Zona 10" |
| `address` | text | |
| `is_active` | boolean | |

### 4.2 Relaciones

- `services ↔ locations`: un servicio puede atenderse en **1 o más** lugares (tabla pivote `service_locations`).
- `staff ↔ locations`: un staff atiende en sus lugares asignados.
- `working_hours` puede ser por `location_id` (horarios propios por lugar).

### 4.3 Comportamiento en el portal

- Si la empresa tiene **1 lugar** por defecto → no se muestra al cliente.
- Si tiene **varios** → el cliente elige lugar (opcional) antes de ver horarios.
- El link público puede apuntar a un lugar específico: `/book/:slug?location=consultorio-zona-10`.

---

## 5. Horarios Disponibles

### 5.1 Tabla `working_hours`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | integer | PK |
| `company_id` | fk | |
| `location_id` | fk nullable | `null` = aplica a toda la empresa |
| `user_id` | fk nullable | `null` = horario general, sino específico de staff |
| `day_of_week` | int | 0-6 |
| `start_time` | text | "09:00" |
| `end_time` | text | "17:00" |
| `break_start_time` | text | Opcional, "13:00" |
| `break_end_time` | text | Opcional, "14:00" |
| `is_active` | boolean | |

### 5.2 Tabla `blocked_slots`

Bloqueos puntuales (vacaciones, mantenimiento):

| Campo | Tipo |
|---|---|
| `id` | integer |
| `company_id` | fk |
| `location_id` | fk nullable |
| `user_id` | fk nullable (`null` = toda la empresa) |
| `start_at` / `end_at` | timestamp |

---

## 6. Motor de Disponibilidad (Slot Engine)

Ecuación del motor:

```
Horario laboral − descansos − citas (con buffer) − bloqueos = slots libres
```

- Opera **siempre** en la zona horaria de la empresa (`companies.timezone`), nunca la del navegador.
- Reglas de solapamiento *half-open* `[start, end)`.
- Soporta "Cualquiera disponible": slot libre si **al menos un staff** lo tiene libre.
- **Re-validación transaccional** al reservar (anti doble-reserva): se re-ejecuta el chequeo dentro de la misma transacción antes del INSERT.

---

## 7. Portal Público y Reserva

### 7.1 Flujo del cliente (sin crear cuenta)

```
1. El cliente abre el link público /book/:slug
2. (si aplica) Elige el lugar de atención
3. Elige un SERVICIO (con su duración/precio)
4. (si aplica) Elige staff o "Cualquiera disponible"
5. El calendario muestra solo los slots que caben con la duración del servicio
6. Selecciona fecha y horario
7. Ingresa nombre, WhatsApp/email
8. Confirma la cita → estado "pending"
9. Recibe email de "solicitud recibida" con .ics pendiente
```

### 7.2 Confirmación de la cita

> Decisión: la cita se crea como **`pending`** y requiere **confirmación del negocio**.

- El negocio la confirma o cancela desde el panel.
- Al confirmar → estado `confirmed` → se envía email definitivo con archivo `.ics` y enlace WhatsApp.
- Al cancelar → estado `canceled` → email de aviso.
- Beneficio: evita citas fantasma y no-shows.

### 7.3 Estados de la cita

`pending → confirmed → completed`
`pending → canceled`
`confirmed → canceled` (por negocio o cliente)
`confirmed → no_show`

---

## 8. Superadmin (Gestión de la Plataforma)

### 8.1 Funcionalidades

| Funcionalidad | Endpoint (propuesto) |
|---|---|
| Listar todos los tenants con uso | `GET /api/superadmin/companies` |
| Crear empresa + dueño | `POST /api/superadmin/companies` |
| Ver detalle de un tenant | `GET /api/superadmin/companies/:id` |
| Cambiar plan de una empresa | `PATCH /api/superadmin/companies/:id/plan` |
| Ver suscripciones | `GET /api/superadmin/billings` |
| Forzar facturación masiva | `POST /api/superadmin/billings/generate` |
| Bloquear/desbloquear empresa | `POST /api/superadmin/companies/:id/lock` |

### 8.2 UI

Rutas frontend: `/superadmin/companies`, `/superadmin/companies/new`, `/superadmin/billings`.

Protegidas con middleware `requireRole(['superadmin'])`.

---

## 9. Suscripciones y Link de Pago

### 9.1 Planes SaaS (`saas_plans`)

| Plan | Precio | Staff activo | Citas/mes | Ubicaciones |
|---|---|---|---|---|
| `basic` | Q149/mes | 1 | 100 | 1 |
| `pro` | Q299/mes | 5 | 500 | 5 |
| `enterprise` | Q599/mes | ∞ | ∞ | ∞ |

### 9.2 Límites por plan (juicio fijado)

| Límite | Decisión |
|---|---|
| **Usuarios activos (staff)** | Sí — Basic 1 / Pro 5 / Enterprise ∞ |
| **Citas por mes** | Sí — Basic 100 / Pro 500 / Enterprise ∞ (métrica de uso real) |
| **Máx. clientes** | No |
| **Máx. servicios** | No |

**Enforcement de citas/mes**: al llegar al tope mensual, la empresa no puede aceptar más reservas hasta el siguiente ciclo (se le ofrece upgrade). Contador se resetea por `billing_day`.

> ✅ **DECISIÓN CONFIRMADA (2026-08-28, Judgment Day):** se aplican **cuotas de citas por mes**.
> Esta decisión deroga la línea "Citas: Ilimitadas" de `BOOKLY_TECHNICAL_ARCHITECTURE.md` para todos los planes.
> **`BOOKLY_TECHNICAL_ARCHITECTURE.md` queda desactualizado en: límites de citas, roles (owner/manager) y multi-sucursal Enterprise — debe actualizarse.**

### 9.3 Flujo de suscripción (patrón BarberApp → Recurrente)

```
1. Superadmin crea empresa (empieza en TRIAL, **30 días**).
2. Cron verifica trial vencido → crea TenantBilling PENDING.
3. Admin paga → POST /api/billings/:id/create-checkout
   → Recurrente POST /api/checkouts (charge_type: one_time)
   → metadata.invoiceId inyectado
4. Recurrente redirige al link de pago.
5. Pago OK → webhook POST /api/webhooks/recurrente
   → verifica estado paid server-to-server
   → extrae invoiceId de metadata
   → marca billing PAID → company subscription_status = active
6. Empresa activa.
```

### 9.4 Bloqueo por morosidad

- `past_due` tras 15 días sin pago.
- `locked` tras 29 días → se bloquea el login del tenant.
- Al pagar, se reactiva.

---

## 9.5 Doble integración Recurrente (suscripción + pagos del tenant)

Bookly maneja **dos integraciones Recurrente independientes**:

| | Suscripción (a Bookly) | Anticipos/Señas (al tenant) |
|---|---|---|
| Quién cobra | Bookly | El negocio (tenant) |
| API key | `RECURRENTE_API_KEY` (secreto global de la plataforma) | `companies.recurrente_api_key_enc` (key del tenant, cifrada) |
| Webhook | `/webhooks/recurrente` (firmado con secreto global) | `/webhooks/tenant-payments` (firmado con el secreto del tenant) |
| Registro | `TenantBilling` | `payments` |

> **Regla:** las dos integraciones NUNCA comparten API key ni webhook. Un pago de cita no debe afectar el estado de la suscripción y viceversa.

---

## 9.6 Anticipo / Seña de cita con confirmación automática

### Configuración por servicio (`services`)

| Campo | Tipo | Notas |
|---|---|---|
| `requires_deposit` | boolean | Si el servicio exige anticipo para reservar |
| `deposit_amount_qtz` | int | Monto fijo de la seña (centavos) |
| `deposit_percentage` | int nullable | Alternativa: % del precio (0-100) |
| `auto_confirm_on_payment` | boolean | `true` → el pago de la seña confirma la cita automáticamente |

### Flujo de reserva con seña

```
1. El servicio exige anticipo (requires_deposit = true).
2. El cliente elige servicio + slot y llega al paso de pago.
3. El portal genera un checkout Recurrente con la key DEL TENANT.
4. El cliente paga la seña (deposit_amount_qtz o %).
5. Webhook /webhooks/tenant-payments valida el pago (server-to-server).
6. Si auto_confirm_on_payment:
   → cita pasa directo a confirmed (no espera al admin)
   → se envía email definitivo con .ics
7. Si NO auto_confirm: la cita queda pending esperando al admin
   (el pago se registra pero no confirma).
```

### Reglas de negocio

- **Pago recibido = confirmación automática** (cuando el servicio lo habilita): el compromiso financiero garantiza el slot y reduce no-shows.
- Si la seña NO se paga en X minutos, la reserva pendiente se libera (el slot vuelve a estar disponible).
- El pago se registra en `payments` con `gateway = recurrent`, `gatewayPaymentId`, y referencia a la cita.
- Al cancelar la cita, se emite reembolso (regla de reembolso del tenant, configuración posterior).

### Seguridad de la API key del tenant (write-only)

- La key se guarda **cifrada** en `companies.recurrente_api_key_enc` con clave de cifrado de la plataforma (los Secrets de Cloudflare son por-worker; en multi-tenant la credencial vive en DB).
- **Nunca** se devuelve en `GET` — es write-only. La UI muestra "✔ clave configurada" en vez del valor.
- Input `type="password"` + nunca loguear ni exponer.
- Webhook firmado con el secreto del propio tenant.

---

## 10. Notificaciones

| Evento | Canal | Contenido |
|---|---|---|
| Solicitud de cita recibida | Email | Resumen + "pendiente de confirmación" |
| Cita confirmada | Email + WhatsApp | `.ics`, enlace `wa.me` |
| Cita cancelada | Email | Aviso |
| Recordatorio (N horas antes) | Email/WhatsApp | Cita próxima |
| Factura de suscripción | Email | Link de pago |

---

## 11. Casos de Uso Principales

### CU-01: Alta de empresa (superadmin)
**Actor:** superadmin. **Precondición:** autenticado.
1. Ingresa nombre, slug, email del dueño, plan inicial.
2. Sistema crea `company` (trial), `user` admin dueño, y asigna plan.
3. Se genera el `recurrente_subscription_id` para el futuro cobro.
**Post:** empresa en `trial` (30 días), dueño puede loguear.

### CU-02: Configurar servicio
**Actor:** admin. **Precondición:** empresa activa.
1. Crea servicio con nombre, duración, buffer, precio.
2. (Opcional) lo marca como servicio general.
3. Lo asigna a uno o más lugares de atención.
**Post:** servicio visible en el portal.

### CU-03: Definir horarios disponibles
**Actor:** admin.
1. Configura `working_hours` por día (o por staff/lugar).
2. Configura bloqueos puntuales.
**Post:** el Slot Engine usa estos datos.

### CU-04: Compartir link público
**Actor:** admin.
1. Copia `https://.../book/:slug`.
2. Lo comparte con clientes externos.
**Post:** cualquiera puede ver disponibilidad y reservar sin cuenta.

### CU-05: Reservar cita (cliente)
**Actor:** cliente (anónimo).
1. Abre link, elige lugar (si aplica), servicio, staff (opcional).
2. Ve slots, elige fecha/hora.
3. Ingresa datos de contacto.
4. Confirma → cita `pending`.
**Post:** email de solicitud recibida; negocio ve la cita en panel.

### CU-06: Confirmar cita (negocio)
**Actor:** admin/staff.
1. Ve citas `pending`.
2. Confirma o cancela.
**Post:** `confirmed` + email con `.ics`, o `canceled` + aviso.

### CU-07: Pagar suscripción
**Actor:** admin.
1. Ve factura pendiente.
2. Paga vía link Recurrente.
**Post:** billing PAID, empresa `active`.

### CU-08: Enforcement de límites
**Actor:** sistema.
1. Al crear staff: valida `count(active users) < plan.maxStaff`.
2. Al reservar: valida `count(citas del mes) < plan.monthlyAppointments`.
**Post:** si se excede, rechaza con aviso de upgrade.

### CU-09: Configurar pagos del negocio (API key del tenant)
**Actor:** admin. **Precondición:** empresa activa.
1. Ingresa su API key de Recurrente (input `type="password"`).
2. Ingresa el secreto de webhook correspondiente.
3. Sistema la cifra y guarda en `companies.recurrente_api_key_enc`.
4. Activa la recepción de anticipos/señas.
**Post:** los servicios que lo requieran pueden cobrar seña; la key nunca se expone en consultas.

### CU-10: Reservar con seña (cliente + pago)
**Actor:** cliente, sistema, recurrente (key del tenant).
1. Cliente elige servicio que exige anticipo y un slot.
2. Llega al paso de pago → checkout Recurrente (key del tenant).
3. Paga la seña.
4. Webhook `/webhooks/tenant-payments` valida y registra el pago.
5. Si `auto_confirm_on_payment` → cita a `confirmed` + email `.ics`.
**Post:** cita confirmada por pago, o pending según configuración del servicio.

---

## 12. Fuera de Alcance (fases posteriores)

- Reportes financieros avanzados (exportación Excel/PDF).
- Módulo de inventario de productos.
- App móvil nativa.
- Múltiples monedas en vivo.
- Pasarelas de pago alternativas.

---

## 13. Checklist de Implementación (orden sugerido)

1. [ ] Límites por plan en backend (maxStaff, citas/mes) + enforcement
2. [ ] Superadmin: CRUD de empresas + gestión de planes
3. [ ] Servicio general (`is_default`) + ajuste del wizard
4. [ ] Entidad `locations` + relaciones servicios/staff/horarios
5. [ ] Flujo de suscripción completo con Recurrente (checkout + webhook)
6. [ ] Bloqueo por morosidad (past_due → locked)
7. [ ] Confirmación de cita por el negocio (pending → confirmed)
8. [ ] Recordatorios por email/WhatsApp (cron)
9. [ ] RequireRole en rutas admin
10. [ ] Panel superadmin en frontend
11. [ ] Configuración de API key del tenant (cifrada, write-only) + doble integración Recurrente
12. [ ] Anticipo/seña por servicio + confirmación automática al pagar (`requires_deposit`, `deposit_*`, `auto_confirm_on_payment`)
13. [ ] Webhook `/webhooks/tenant-payments` separado del webhook de suscripción

---

## 14. Hallazgos del Judgment Day (fuente de implementación)

> Revisión adversarial con dos jueces ciegos (judge-a / judge-b) sobre este documento vs. la implementación actual.
> **Cada hallazgo es un gap que la implementación DEBE cerrar.** Los hallazgos `deterministic` son verificables por código; `inferential` requieren decisión.

| ID | Severidad | Hallazgo | Dónde aplicar | Evidencia |
|---|---|---|---|---|
| JD-001 | CRITICAL | La cita debe nacer `pending` y requerir confirmación, pero hoy se inserta `confirmed` y se envía `.ics` inmediato | `routes/public.ts:274-312` + wizard | deterministic |
| JD-002 | CRITICAL | Falta re-validación transaccional del slot en `POST /book` (anti doble-reserva) | `routes/public.ts:272-288` + Slot Engine | deterministic |
| JD-003 | BLOCKER | Entidad `locations` (lugares de atención) + pivot `service_locations` + `location_id` no existen en schema | `db/schema.ts` | deterministic |
| JD-004 | BLOCKER | `monthlyAppointments` y `billing_day` no existen en schema; contradice arquitectura (ya derogada) | `db/schema.ts` `saasPlans`/`companies` | deterministic |
| JD-005 | BLOCKER | Estado `locked` y gracia 15/29 días no modelados; webhook pasa directo a `canceled` | `routes/webhooks.ts:93-101` + enum | deterministic |
| JD-006 | BLOCKER | `staff_services` no se respeta: disponibilidad devuelve TODOS los staff activos, sin filtrar por servicio | `routes/public.ts:145-190` | deterministic |
| JD-A-005 | CRITICAL | Query de disponibilidad carga TODAS las citas confirmadas sin filtro de fecha (perf / timeout) | `routes/public.ts:118-125` | deterministic |
| JD-B-009 | BLOCKER | Staff no puede confirmar citas (solo admin) y ve agenda completa del tenant | `routes/admin.ts:568` + `middleware/auth.ts:93-94` | deterministic |
| JD-B-010 | BLOCKER | Transiciones de estado de cita sin validar estado actual (cancelada→confirmada posible) | `routes/admin.ts:568-582` | deterministic |
| JD-B-011 | BLOCKER | Frontend usa timezone del navegador en vez de la del tenant | `booking.component.ts:623-634` | deterministic |
| JD-B-012 | BLOCKER | No hay token público de cancelación ni ruta de autogestión del cliente | `schema.ts` + `routes/public.ts` | deterministic |
| JD-B-014 | BLOCKER | Superadmin no tiene ruta cross-tenant; `users` exige `companyId` para todo usuario | `schema.ts:83-85` | inferential |
| JD-A-006 | WARNING | Campo `is_default` (servicio general) no existe en schema | `db/schema.ts` `services` | deterministic |
| JD-A-010 | WARNING | Disponibilidad devuelve staff sin filtrar por asignación a servicio | `routes/public.ts:110-116` | deterministic |
| JD-B-013 | WARNING | Servicio con `is_active=false` sigue reservable vía request manipulado | `routes/public.ts:134-136, 225-227` | deterministic |
| JD-A-012/015/016 | WARNING | Contradicciones con `BOOKLY_TECHNICAL_ARCHITECTURE.md` (multi-sucursal, límites, roles owner/manager) — documento debe sincronizarse | docs | inferential |
| JD-007 | WARNING | Doble integración Recurrente (suscripción vs pagos del tenant) requiere separación estricta de webhooks y claves; la key del tenant debe cifrarse en D1 (write-only) | `routes/webhooks.ts` + `db/schema.ts` `companies` | inferential |

### 14.1 Hallazgos de la revisión de pagos del tenant (Judgment Day, 2026-08-28)

> Revisión adversarial enfocada en §9.5, §9.6, CU-09 y CU-10 (pagos del negocio, anticipo/seña).
> **Estos hallazgos DEBEN cerrarse antes de implementar la capa de pagos.**

| ID | Severidad | Hallazgo | Dónde aplicar | Evidencia |
|---|---|---|---|---|
| P-001 | CRITICAL | No existe utilidad de cifrado simétrico (AES) en el código; sin ella las API keys del tenant quedarían en texto plano | `workers/src` (nuevo crypto util) | deterministic |
| P-002 | CRITICAL | Solo existe `/webhooks/recurrente` (secreto global); falta `/webhooks/tenant-payments` para aislar las 2 integraciones | `routes/webhooks.ts:47` | deterministic |
| P-003 | CRITICAL | El webhook valida TODOS los eventos con el secreto global; webhooks del tenant con su propio secreto fallarían la verificación | `routes/webhooks.ts:50` | deterministic |
| P-004 | CRITICAL | `charge.succeeded` confía en `metadata.company_id` sin validar contexto del tenant — payload forjado inyecta pagos para cualquier empresa | `routes/webhooks.ts:110-125` | deterministic |
| P-005 | CRITICAL | Sin idempotencia en `gatewayPaymentId` — la entrega at-least-once de Recurrente duplica pagos y confirmaciones | `routes/webhooks.ts:112-125` + schema | deterministic |
| P-006 | BLOCKER | `companies` sin `recurrente_api_key_enc` ni `recurrente_webhook_secret_enc` — CU-09 no implementable | `db/schema.ts` | deterministic |
| P-007 | BLOCKER | `services` sin `requires_deposit`, `deposit_amount_qtz`, `deposit_percentage`, `auto_confirm_on_payment` — CU-10 no implementable | `db/schema.ts` | deterministic |
| P-008 | BLOCKER | `payments` sin `appointment_id` — no se puede enlazar pago a cita para auto-confirmar o reembolsar | `db/schema.ts` `payments` | deterministic |
| P-009 | BLOCKER | `POST /book` fija `status: 'confirmed'` — la cita con anticipo se confirma antes de pagar | `routes/public.ts:281` | deterministic |
| P-010 | BLOCKER | No hay cron/expiración para liberar slots con anticipo no pagado tras X minutos | `wrangler.toml` + nuevo scheduled handler | deterministic |
| P-011 | BLOCKER | No hay endpoint/API de reembolso; enum `refunded` existe pero sin código que lo transicione | `routes/admin.ts` + `payments` | deterministic |
| P-012 | BLOCKER | `charge.succeeded` solo inserta el pago; nunca actualiza la cita, verifica `auto_confirm_on_payment` ni envía email | `routes/webhooks.ts` | deterministic |
| P-013 | WARNING | `subscription_status` enum sin estado `locked` | `db/schema.ts` | deterministic |
| P-014 | WARNING | El diseño de cifrado no especifica key versioning, rotación, rotación, AAD ligado al tenant ni cifrado autenticado | §9.6 | inferential |
| P-015 | WARNING | Riesgo de exponer la key cifrada vía endpoint de detalle de empresa sin filtro de columnas | `routes/admin.ts` | inferential |

---
### Estado de los hallazgos

- Todos quedan `open` y se cierran conforme la implementación los aborde.
- JD-004 quedó **resuelto por decisión de producto** (cuotas aplicadas) pero **pendiente de schema** (`monthlyAppointments`, `billing_day`).
- Verificar contra el código fuente al implementar cada ítem del checklist.
