# Handoff — Backend L1: Schema locations (fijo/móvil) + CRUD admin

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Sentar la base del modelo de **ubicaciones con tipos** (fijo + móvil) en el backend. Este bloque solo hace **schema + CRUD admin + contratos**. El Slot Engine location-aware es el bloque L2 (posterior).

Cierra: JD-A-001/B-001 (type/slug), JD-A-008/B-006 (CRUD locations), JD-A-009/B-008 (maxLocations), y la base para staffLocations.

## 2. Contexto

- `locations` YA existe en `workers/src/db/schema.ts:84-105` con: id, companyId, name, address, slug, isActive, timestamps. **Falta `type` y `serviceRadiusKm`.**
- `serviceLocations` pivot existe (servicio↔lugar).
- `staffServices` pivot existe (staff↔servicio).
- **NO existe `staffLocations` pivot** (staff↔lugar) — crearlo.
- `saasPlans` tiene maxStaff + monthlyAppointments. **Falta `maxLocations`.**
- NO hay CRUD de locations en admin.ts.

## 3. Cambios REQUERIDOS

### 3.1 Schema (`workers/src/db/schema.ts`)
- **`locations`**: agregar `type` (enum `['fixed','mobile']`, notNull, default 'fixed') y `serviceRadiusKm` (integer nullable).
- **NUEVA tabla `staffLocations`** (pivot staff↔lugar):
  - `userId` (fk → users, cascade), `locationId` (fk → locations, cascade), `companyId` (fk → companies, cascade).
  - PK compuesta (userId, locationId). Índice por companyId.
- **`saasPlans`**: agregar `maxLocations` (integer, notNull, default 1).

### 3.2 Contratos (`packages/contracts/src/admin.ts`)
- `createLocationSchema`: name (min2), address (opcional), slug (regex slug), type (enum fixed|mobile), serviceRadiusKm (opcional int), isActive (default true).
- `updateLocationSchema` = partial.
- `locationResponseSchema`: id, companyId, name, address, slug, type, serviceRadiusKm, isActive.
- Agregar `maxLocations` al schema de plan si existe uno (opcional).

### 3.3 CRUD locations (`workers/src/routes/admin.ts`)
- `GET /api/locations` — listar ubicaciones del tenant (con tenant-scoped).
- `POST /api/locations` — crear (validar con createLocationSchema; validar límite de una móvil por empresa si aplica).
- `PUT /api/locations/:id` — actualizar.
- `DELETE /api/locations/:id` — soft-delete (isActive=false) o físico.
- Todos tenant-scoped con `withTenant`.

### 3.4 (Opcional) endpoint de asignación staff→locations
- `POST /api/locations/:id/staff` (body: staffIds[]) y `GET /api/locations/:id/staff` — para gestionar staffLocations. Si es demasiado, dejarlo como TODO y solo crear el schema/pivot.

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly/workers && pnpm db:generate   # genera migración 0003
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
cd /Users/rogelio/Documents/Bookly/workers && pnpm db:migrate    # aplicar a D1 local
```

> Aplicar la migración SOLO a local (no staging/prod). Reset local ya hecho por el orquestador.

## 5. Resultado esperado

Reportar: archivos, migración generada (nombre), shape de cada endpoint, tests/typecheck, riesgos.

## 6. Archivos PERMITIDOS

- `workers/src/db/schema.ts` (locations.type, serviceRadiusKm, staffLocations, saasPlans.maxLocations)
- `workers/src/db/migrations/` (nueva migración 0003 + meta)
- `packages/contracts/src/admin.ts` (schemas de locations)
- `workers/src/routes/admin.ts` (CRUD locations + staffLocations)

**NO tocar**: Slot Engine (slot-engine.ts), routes/public.ts, frontend, seed.sql, wrangler.*.

## 7. NO hacer

- NO reescribir el Slot Engine (bloque L2).
- NO tocar routes/public.ts.
- NO tocar frontend.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.
