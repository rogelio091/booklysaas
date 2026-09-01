# Handoff — Frontend: UI de Bloqueos de disponibilidad

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Crear la UI para que el admin **bloquee fechas/horarios específicos** (deshabilitar disponibilidad), integrada en el panel. Cierra: JD-A-002/B-002 (UI de bloqueos inexistente), y usa el backend ya listo.

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/` (relevantes).
2. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — `blockedSlotResponseSchema` (id, companyId, userId, locationId, startAt, endAt, reason, createdAt), `createBlockedSlotSchema`.
3. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts` — endpoints bloques (GET/POST/DELETE /schedule/blocks).
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/schedule/schedule.component.ts` — para integrar o inspirar la UI.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/calendar/calendar.component.ts` — para mostrar días bloqueados.
6. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — métodos a agregar.
7. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/locations/locations.component.ts` — para select de ubicación.

## 4. Endpoints (ya existen en backend)

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/schedule/blocks?from=&to=` | `{ success, data: BlockedSlotDto[] }` (locationId, epoch ms) |
| POST | `/api/schedule/blocks` | body `{ userId?, locationId?, startAt, endAt, reason? }` → `{ success, data, warnings: { affectedAppointments } }` |
| DELETE | `/api/schedule/blocks/:id` | `{ success }` |

## 5. Cambios REQUERIDOS

### 5.1 Gestión de bloqueos (en `/app/schedule` o página dedicada)
- **Lista de bloqueos activos**: fecha/hora, ubicación (o "Toda la empresa"), motivo, con botón eliminar.
- **Botón "+ Bloquear"** que abre modal:
  - Fecha (date), hora inicio/fin (time) o rango completo del día.
  - Ubicación: select con las locations + opción "Toda la empresa".
  - Motivo (opcional).
  - Al guardar, **mostrar aviso** si el backend devuelve `warnings.affectedAppointments > 0` ("Hay N citas afectadas").
- Validación: el modal evita endAt <= startAt (el backend también lo valida).

### 5.2 Mostrar bloqueos en el calendario
- En `calendar.component.ts`: al cargar, obtener los bloques del rango visible (`GET /schedule/blocks?from=&to=`) y:
  - Marcar los **días bloqueados** en la vista mes (sombreado/color + tooltip con motivo).
  - En vista día/semana, mostrar las **franjas bloqueadas** como bloques sombreados.
- Integrar sin romper las citas existentes.

### 5.3 ApiService
- `getBlocks(from?, to?)`, `createBlock(data)`, `deleteBlock(id)`.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS

- `frontend/src/app/features/admin/pages/schedule/schedule.component.ts` (gestión de bloqueos) — o un sub-componente nuevo en `pages/schedule/`
- `frontend/src/app/features/admin/pages/calendar/calendar.component.ts` (mostrar bloques)
- `frontend/src/app/core/services/api.service.ts` (métodos de bloques)

**NO tocar**: workers/, packages/contracts/, backend, otros pages, preview.html, docs/.

## 8. NO hacer

- NO tocar backend/contracts.
- NO cambiar la lógica de reserva pública.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona la creación de bloqueos y el aviso de citas afectadas, cómo se muestran en el calendario, build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
