# Handoff — Backend: Validación de fechas/horarios pasados

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Validar en el **backend** que no se ofrezcan ni se reserven **fechas/horarios pasados** (el frontend puede fallar o el navegador cacheado puede enviar fechas viejas — el servidor debe ser la autoridad). Cierra el hallazgo del usuario: "te deja seleccionar un horario que ya pasó".

## 2. Estado actual (verificado)

- El **Slot Engine** (`workers/src/services/slot-engine.ts`) genera slots sin filtrar los que ya pasaron (no hay comparación con `Date.now()`).
- `GET /:slug/availability` (public.ts) devuelve slots del Slot Engine tal cual.
- `POST /:slug/book` (public.ts) inserta la cita sin validar que `body.startAt` sea futuro.

## 3. Cambios REQUERIDOS

### 3.1 Slot Engine (`workers/src/services/slot-engine.ts`)
- En `computeAvailability`, **descartar los slots cuyo `startAt <= Date.now()`** (o `startAt < now`). Considerar que el Slot Engine es puro y recibe epoch ms; puede recibir opcionalmente un `now` (para testear) o usar `Date.now()`.
- **Importante**: mantener los tests existentes — algunos pueden usar fechas del pasado como fixture. Si un test existente depende de slots "pasados", ajustarlo para usar fechas futuras o pasar `now` explícito.

### 3.2 Booking POST (`workers/src/routes/public.ts`)
- Antes de insertar, validar `body.startAt > Date.now()`. Si es pasado → 400 `{ code: 'PAST_DATE', message: 'La fecha seleccionada ya pasó' }`.
- Opcional: también validar que `body.startAt` esté dentro del horario laboral (reusando el Slot Engine o una validación simple) — si es mucho, dejarlo como nota.

### 3.3 Tests
- Agregar test del slot-engine: slots en el pasado NO se devuelven (pasar `now` explícito).
- Agregar/verificar que los tests existentes pasen.

## 4. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter bookly-api test
cd /Users/rogelio/Documents/Bookly && pnpm -r typecheck
```

> NO hay migración. NO tocar staging/prod.

## 5. Resultado esperado

Reportar: archivos modificados, cómo se filtra el pasado (engine + booking), tests (count), riesgos.

## 6. Archivos PERMITIDOS

- `workers/src/services/slot-engine.ts`
- `workers/src/services/slot-engine.spec.ts`
- `workers/src/routes/public.ts`

**NO tocar**: schema.ts, contracts, admin.ts, frontend, migraciones, wrangler.*.

## 7. NO hacer

- NO tocar frontend (bloque separado).
- NO cambiar contratos.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.
