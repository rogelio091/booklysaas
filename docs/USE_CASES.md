# Bookly — Especificación Funcional y Casos de Uso

> Documento vivo de referencia. Define el funcionamiento de la plataforma Bookly.
> Basado en el patrón multi-tenant validado en BarberApp y adaptado al dominio de agendamiento.
> Autoridad sobre este documento: equipo de desarrollo.

**Última actualización:** 2026-08-28

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
| `recurrente` | Pasarela de pago externa (suscripciones y señas) |
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
| `recurrente_subscription_id` | text | ID de suscripción en pasarela |
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

### 9.3 Flujo de suscripción (patrón BarberApp → Recurrente)

```
1. Superadmin crea empresa (empieza en TRIAL, 14 días).
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
**Post:** empresa en `trial` (14 días), dueño puede loguear.

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
