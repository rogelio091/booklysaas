# Handoff — Backend Fase 1: Endpoints del flujo core

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Agregar al backend los 4 cambios verificados como necesarios para el flujo core. Cierra hallazgos:
- **JD-001/002** (email opcional + sin endpoint de clientes)
- **JD-003** (sin serviceName en GET /appointments)
- **JD-B-003** (falta DELETE de cita)

## 2. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/docs/CORE_FLOW_PLAN.md` §4 (decisiones) y §6 (plan).
2. `/Users/rogelio/Documents/Bookly/docs/USE_CASES.md` §2 (multi-tenant), §7.3 (estados).
3. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts` — rutas admin actuales.
4. `/Users/rogelio/Documents/Bookly/workers/src/db/schema.ts` — tablas (customers, appointments, appointmentItems).
5. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` y `public.ts` — schemas.

## 3. Cambios REQUERIDOS

### 3.1 `GET /api/customers` (nuevo) — listar/buscar clientes
- Tenant-scoped por `companyId` del contexto.
- Parámetros opcionales de búsqueda por query string: `search` (busca en `name` o `phone` con `like`), `limit` (default 50, max 100).
- Devuelve `{ success, data: CustomerDto[] }` con: id, companyId, name, phone, email, notes, createdAt.
- Agregar schema `customerResponseSchema` en `packages/contracts/src/admin.ts`.

### 3.2 `DELETE /api/appointments/:id` (nuevo) — eliminar cita
- Tenant-scoped. Si la cita no existe en el tenant → 404.
- Eliminar también sus `appointmentItems` (por cascade en schema, pero verificar) y devolver `{ success, data: { id } }`.
- Nota: es DELETE físico (el soft-delete se maneja con status 'canceled'). Decisión D1 = estado + eliminar.

### 3.3 `GET /api/appointments` — agregar `serviceName`
- Modificar el mapeo actual para incluir `serviceName` (y opcionalmente `serviceId`, `priceQtz`, `durationMinutes`) tomados de `appointmentItems` (join/query).
- Actualizar `appointmentAdminSchema` en `packages/contracts/src/admin.ts` para incluir `serviceName` (nullable).

### 3.4 `customerEmail` opcional en la reserva pública
- En `packages/contracts/src/public.ts`, cambiar `createBookingSchema.customerEmail` de:
  `z.string().email('Email inválido')` → `z.string().email('Email inválido').optional().nullable()`
- NO tocar el frontend (bloque posterior). Solo el contrato.
- Verificar que `public.ts` maneja bien `undefined`/`null` al crear el customer (debe guardar null si no viene).

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
```

## 5. Resultado esperado

Reportar:
1. Archivos modificados/creados.
2. Forma de cada endpoint (GET /customers, DELETE /appointments/:id, nuevo serviceName).
3. Tests + typecheck (count).
4. Riesgos/decisiones.

## 6. Archivos PERMITIDOS (todo lo demás = desvío, se revierte)

- `workers/src/routes/admin.ts` (agregar GET /customers, DELETE /appointments/:id, y serviceName en GET /appointments)
- `packages/contracts/src/admin.ts` (customerResponseSchema, serviceName en appointmentAdminSchema)
- `packages/contracts/src/public.ts` (customerEmail opcional)

**NO tocar**: schema.ts, types.ts, wrangler.*, index.ts, routes/public.ts, routes/webhooks.ts, frontend/, migraciones, crypto.ts, password.ts.

## 7. NO hacer

- NO tocar frontend.
- NO cambiar schema (no hay migración en este bloque — los campos ya existen).
- NO deployar. NO commitear (dejar en working tree, branch develop).
