# Handoff — Backend: Asignación de servicios a ubicación (serviceLocations)

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Agregar el endpoint para **asignar servicios a una ubicación** (usando el pivot `serviceLocations` que ya existe en schema). Esto habilita que el wizard público (Fase L4) filtre los servicios disponibles por ubicación.

## 2. Contexto

- El pivot `serviceLocations` YA existe en `workers/src/db/schema.ts` (servicio↔ubicación, PK compuesta serviceId+locationId, con companyId).
- `locations` y `services` ya tienen CRUD en admin.
- **No existe** endpoint para leer/asignar los servicios de una ubicación (por eso en L3 quedó el botón "Servicios" como TODO).

## 3. Cambios REQUERIDOS

### 3.1 Contratos (`packages/contracts/src/admin.ts`)
- `assignLocationServicesSchema`: `{ serviceIds: number[] }`.
- (opcional) `locationWithServicesResponseSchema` si quieres incluir serviceIds en la respuesta de locations. Si no, el frontend puede cruzar por el endpoint de abajo.

### 3.2 Endpoints (`workers/src/routes/admin.ts`) — tenant-scoped
- `GET /api/locations/:id/services` — devuelve `{ success, data: ServiceResponseDto[] }` (los servicios asignados a esa ubicación).
- `POST /api/locations/:id/services` — body `{ serviceIds: number[] }`, semántica de **reemplazo** (borra los existentes del pivot para esa location y reinserta). Filtra a tenant.
- Verificar que la ubicación pertenece al tenant (404 si no).

### 3.3 (opcional) En el endpoint público GET /:slug/services
- Si es fácil, agregar filtro por `locationId` query param para devolver solo los servicios de esa ubicación vía `serviceLocations`. Si complica el flujo público, dejarlo como TODO y hacerlo en L4.

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
```

> NO hay migración (el pivot ya existe). NO tocar staging/prod.

## 5. Resultado esperado

Reportar: archivos modificados, shape de los endpoints, tests/typecheck, riesgos.

## 6. Archivos PERMITIDOS

- `workers/src/routes/admin.ts` (endpoints de servicios de ubicación)
- `packages/contracts/src/admin.ts` (schemas)
- (opcional) `workers/src/routes/public.ts` (solo el filtro de services por locationId)

**NO tocar**: schema.ts, slot-engine.ts, migraciones, frontend, seed.sql, wrangler.*.

## 7. NO hacer

- NO tocar schema (pivot existe).
- NO tocar slot-engine.
- NO tocar frontend.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.
