# Plan del Flujo Core — Bookly

> Plan para dejar funcional el flujo central del programa. Basado en el diagnóstico del frontend (2026-08-30).
> **Este documento define QUÉ construir para que el admin pueda operar el negocio y el cliente pueda reservar.**

---

## 1. Objetivo del flujo core

Que el admin (logueado) pueda:
1. **Definir horarios semanales** de disponibilidad (working hours).
2. **Crear y editar servicios** (con duración/precio).
3. **Ver el calendario** de citas y **hacer clic en una cita** para ver/editar/cancelar.
4. **Crear citas manualmente** y **gestionar clientes**.

Y que el cliente final pueda reservar desde el portal, creando clientes automáticamente.

---

## 2. Alcance (bloques de trabajo)

### BLOQUE A — Horarios (Schedule)
- Nueva página admin `/app/schedule`.
- UI para configurar los horarios semanales por día (lun-dom): start, end, break (opcional), activo/inactivo.
- Consume `GET/POST /api/schedule/working-hours` (ya existen en backend).
- Responsive + Midnight Emerald.

### BLOQUE B — Calendario interactivo (clic en cita)
- Al hacer clic en una cita (apt-chip en vista semana/día) → abrir modal de **detalle de la cita**.
- El modal muestra: cliente, teléfono, servicio, staff, fecha/hora, estado, notas.
- Acciones: **cambiar estado** (confirmar/completar/cancelar), **editar**, **eliminar**.
- Consume `PATCH /api/appointments/:id/status` (ya existe) + `GET /api/appointments` (ya existe).
- Nota: el backend no tiene `PUT /api/appointments/:id` para editar — decidir si se agrega o solo cambio de estado.

### BLOQUE C — Editar servicios
- Agregar botón "Editar" en las tarjetas de servicio.
- El modal de servicio pasa a tener **modo edición** (pre-llenado) que llama `PUT /api/services/:id` (ya existe en backend).
- Mantener el modo crear (POST).

### BLOQUE D — Clientes
- Nueva página admin `/app/customers` para listar/buscar clientes (por nombre o teléfono).
- En el formulario de crear cita: **autocomplete de cliente por teléfono/nombre** — si no existe, se crea al guardar.
- El cliente se crea desde la reserva pública con: **nombre + teléfono + email (opcional)**.

---

## 3. Flujo end-to-end deseado

```
ADMIN:
1. Login → panel
2. Configura horarios (/app/schedule)
3. Crea/edita servicios (/app/services)
4. Ve el calendario (/app/calendar)
5. Clic en cita → detalle → cambia estado / cancela
6. Crea cita manual (seleccionando o creando cliente) 
7. Gestiona clientes (/app/customers)

CLIENTE FINAL:
1. Abre /book/:slug
2. Elige servicio + día (calendario mes) + slot
3. Ingresa nombre + teléfono + email (opcional)
4. Reserva → se crea el cliente automáticamente
```

---

## 4. Decisiones (fijadas 2026-08-30 tras Judgment Day + verify)

| # | Decisión | Resolución |
|---|---|---|
| D1 | Alcance del clic en cita | **Estado + eliminar** (no edición completa). Agregar `DELETE /api/appointments/:id` en backend. |
| D2 | Gestión de clientes | **Listar + buscar** (se crean solos al reservar). Agregar `GET /api/customers` + search en backend. |
| D3 | Horarios | **General de la empresa** (userId null). Simplifica la UI. |
| D4 | Clic en vista mes | **Solo semana/día** abren el detalle; en mes navega al día. |
| D5 | Email del cliente | **Opcional**. Cambiar contrato a `z.string().email().optional().nullable()` y ajustar el wizard. |

---

## 5. Fuera de alcance (fases posteriores)

- Pagos/anticipos (ya documentado en USE_CASES, otro bloque).
- Multi-sucursal/locations.
- Superadmin.
- Recordatorios por email.
- Turnstile/rate limiting (bloque de seguridad P3).

---

## 6. Orden de implementación sugerido

### Fase 1 — Backend (habilitar lo que falta) — cerrar con verify
1. [ ] `GET /api/customers` + search por nombre/teléfono (tenant-scoped).
2. [ ] `DELETE /api/appointments/:id` (o cancelar vía status).
3. [ ] Agregar `serviceName` al `GET /api/appointments` (join appointment_items).
4. [ ] `customerEmail` opcional en `createBookingSchema` (contracts/src/public.ts).

### Fase 2 — Frontend Bloque A: Schedule
5. [ ] Página `/app/schedule` (horarios semanales generales) consumiendo GET/POST working-hours.

### Fase 3 — Frontend Bloque B: Calendario interactivo
6. [ ] `(click)` en apt-chip (semana/día) → modal de detalle de cita.
7. [ ] Modal: mostrar servicio/cliente/staff/fecha/estado + acciones (cambiar estado, eliminar).

### Fase 4 — Frontend Bloque C: Editar servicios
8. [ ] Botón Editar en tarjetas + modo edición del modal (PUT).

### Fase 5 — Frontend Bloque D: Clientes
9. [ ] Página `/app/customers` (listar/buscar).
10. [ ] Autocomplete de cliente en el modal de crear cita.

### Fase 6 — Verificación end-to-end
11. [ ] Levantar local, probar flujo completo admin → cliente.

---

## 7. Hallazgos del Judgment Day + verify (fuente de implementación)

| ID | Severidad | Hallazgo | Acción |
|---|---|---|---|
| JD-001/002 | CRITICAL | Email opcional vs contrato obligatorio; sin endpoint de clientes | D5 + Fase 1.1 |
| JD-003 | CRITICAL | Sin serviceName en GET /appointments; sin click en apt-chip | Fase 1.3 + Fase 3 |
| JD-B-003 | BLOCKER | Falta DELETE /api/appointments/:id | Fase 1.2 |
| JD-A-004 | WARNING | /app/schedule no existe | Fase 2 |
| JD-A-005 | WARNING | Servicios UI solo crea | Fase 4 |
| JD-A-007 | WARNING | GET /appointments limit:100 sin filtro de fecha | Post-fase (paginación/date-range) |
| JD-B-006 | WARNING | Estado pending no bloquea slot en Slot Engine | Post-fase (si se introduce pending) |
