# Handoff — Backend L2: Slot Engine location-aware

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Hacer que el **Slot Engine sea location-aware**: agregar `locationId` a sus interfaces, filtrar staff por `staffLocations`, y conectar el pipeline público (availability + booking) para que acepte y filtre por ubicación. Cierra JD-A-002/B-003 (Slot Engine location-unaware).

**Precondición (ya hecho en L1):** tabla `locations` con `type` (fixed/mobile), pivot `staffLocations`, CRUD admin. El schema YA tiene `locationId` en `workingHours`, `blockedSlots`, `appointments`.

## 2. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/workers/src/services/slot-engine.ts` — el motor a modificar.
2. `/Users/rogelio/Documents/Bookly/workers/src/routes/public.ts` — pipeline de availability + booking.
3. `/Users/rogelio/Documents/Bookly/workers/src/db/schema.ts` — locations, staffLocations, workingHours/blockedSlots con locationId.
4. `/Users/rogelio/Documents/Bookly/workers/src/db/client.ts` — withTenant.
5. `/Users/rogelio/Documents/Bookly/packages/contracts/src/public.ts` — schemas públicos (agregar locationId).
6. `/Users/rogelio/Documents/Bookly/workers/src/services/slot-engine.spec.ts` — tests existentes (no romper).

## 3. Cambios REQUERIDOS

### 3.1 Slot Engine (`workers/src/services/slot-engine.ts`)
Agregar `locationId` a las interfaces de dominio:
- `WorkingHoursEntry`: + `locationId: number | null`.
- `BlockedSlotEntry`: + `locationId: number | null`.
- `AppointmentEntry`: + `locationId: number | null`.
- `AvailabilityRequest`: + `locationId: number | null` (el lugar consultado) y `staffByLocation?: Map<number, number[]>` o similar (staff→locations para filtrar).
- `StaffEntry`: mantener.

**Lógica de filtrado (crítica):**
- En "Cualquiera disponible" (`staffId = null`), **filtrar `request.staff` a solo los staff asignados a `request.locationId`** vía `staffByLocation` (staffLocations pivot). Un staff solo aparece si cubre ese lugar.
- En filtrado de `workingHours`: un horario aplica si `locationId === null` (general) **o** `locationId === request.locationId`.
- En filtrado de `blockedSlots`: un bloqueo aplica si `locationId === null` (general) **o** `locationId === request.locationId`, y si `userId === null` (empresa) o `userId === staffId`.
- `appointments`: un appointment ocupa slot en la misma ubicación (o general).

**Compatibilidad hacia atrás:** si `request.locationId` es null/undefined, el motor debe comportarse como hoy (sin filtro de ubicación) para no romper tests existentes. Mantener los 18 tests de slot-engine pasando (adaptar solo si un test asume sin-location, no romper).

### 3.2 Contratos públicos (`packages/contracts/src/public.ts`)
- `availabilityQuerySchema`: agregar `locationId: z.coerce.number().int().positive().optional().nullable()`.
- `createBookingSchema`: agregar `locationId: z.coerce.number().int().positive().optional().nullable()`.
- `publicCompanySchema`: si aplica, considerar agregar la lista de locations o dejarlo para L3.

### 3.3 Pipeline público (`workers/src/routes/public.ts`)
- **GET /:slug/availability**: aceptar `locationId` del query. Al cargar:
  - `workingHours`: filtrar por locationId (general o del lugar).
  - `blockedSlots`: filtrar por locationId (general o del lugar).
  - `staff`: filtrar por `staffLocations` si hay locationId.
  - Pasar `locationId` al `computeAvailability`.
- **GET /:slug/services**: opcionalmente filtrar servicios por ubicación vía `serviceLocations` (si locationId en query). Si es mucho, dejarlo como TODO.
- **POST /:slug/book**: aceptar `locationId` y guardarlo en `appointments.locationId` (hoy inserta null).

### 3.4 Tests
- Actualizar/agregar tests del slot-engine para el caso location-aware (staff solo en su lugar, horarios por lugar, bloqueos por lugar). No romper los 18 existentes.

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
```

> NO hay migración en este bloque (solo código). NO tocar staging/prod.

## 5. Resultado esperado

Reportar: archivos modificados, cómo filtra ahora por locationId, tests pasando (count), riesgos.

## 6. Archivos PERMITIDOS

- `workers/src/services/slot-engine.ts`
- `workers/src/services/slot-engine.spec.ts`
- `workers/src/routes/public.ts`
- `packages/contracts/src/public.ts`

**NO tocar**: schema.ts, admin.ts, migraciones, frontend, seed.sql, wrangler.*.

## 7. NO hacer

- NO tocar schema (ya tiene locationId).
- NO tocar admin.ts.
- NO tocar frontend.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.
