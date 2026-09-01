# Handoff — Backend: Bloqueos de disponibilidad (fix + locationId)

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Mejorar los bloqueos de disponibilidad (`blockedSlots`) cerrando hallazgos del Judgment Day:
- **B1 (BLOCKER):** validar `startAt < endAt` — hoy se aceptan bloqueos invertidos/cero que nunca bloquean.
- **B5:** agregar `locationId` al contrato y al guardado (el Slot Engine ya es location-aware desde L2).
- **B2:** al crear un bloqueo, detectar y reportar citas confirmadas afectadas en ese rango (para que la UI avise).

## 2. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — `createBlockedSlotSchema` (líneas ~145-151).
2. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts` — endpoints de bloques (líneas ~390-460).
3. `/Users/rogelio/Documents/Bookly/workers/src/db/schema.ts` — tabla `blockedSlots` (tiene `locationId` y `userId`).
4. `/Users/rogelio/Documents/Bookly/workers/src/db/client.ts` — `withTenant`.

## 3. Cambios REQUERIDOS

### 3.1 Contrato (`packages/contracts/src/admin.ts`)
- `createBlockedSlotSchema`: agregar `locationId: z.number().int().positive().nullable().optional()` (null = toda la empresa).
- Agregar `.refine((d) => d.endAt > d.startAt, { message: 'endAt debe ser mayor que startAt', path: ['endAt'] })` — **cierra B1**.
- Agregar `blockedSlotResponseSchema` (id, companyId, userId, locationId, startAt, endAt, reason, createdAt) — el GET hoy devuelve shape ad-hoc.

### 3.2 Endpoints (`workers/src/routes/admin.ts`)
- **POST /schedule/blocks**: guardar `locationId: body.locationId ?? null`. Tras insertar, **contar citas confirmadas** en el rango `[startAt, endAt]` (mismo tenant, mismas locationId si aplica) y devolver `{ success, data: block, warnings: { affectedAppointments: number } }`.
- **GET /schedule/blocks**: devolver el shape de `blockedSlotResponseSchema` (con locationId y epoch ms). Opcional: aceptar query `from`/`to` para filtrar por rango de fechas (mejora de perf, sugerencia A2 del juicio).
- **DELETE /schedule/blocks/:id**: ya existe, verificar tenant-scoped.

### 3.3 (opcional) query pública
- `routes/public.ts` ya filtra bloques por locationId (L2). Verificar que sigue correcto; no cambiar si funciona.

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
```

> NO hay migración (blockedSlots ya tiene locationId). NO tocar staging/prod.

## 5. Resultado esperado

Reportar: archivos modificados, shape del endpoint POST (incl warnings), cómo se valida startAt<endAt, tests/typecheck, riesgos.

## 6. Archivos PERMITIDOS

- `packages/contracts/src/admin.ts` (schema)
- `workers/src/routes/admin.ts` (endpoints bloques)

**NO tocar**: schema.ts, slot-engine.ts, routes/public.ts, frontend, migraciones, seed.sql, wrangler.*.

## 7. NO hacer

- NO tocar schema (blockedSlots ya tiene locationId).
- NO tocar slot-engine (ya es location-aware).
- NO tocar frontend.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.
