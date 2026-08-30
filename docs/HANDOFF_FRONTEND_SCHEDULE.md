# Handoff — Frontend Fase 2: Página Schedule (horarios semanales)

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Crear la página `/app/schedule` donde el admin configura los **horarios semanales de disponibilidad** de la empresa (decisión D3: horario GENERAL, no por staff). Consume los endpoints `GET/POST /api/schedule/working-hours` que YA existen en backend.

Cierra hallazgo **JD-A-004** (falta la página schedule).

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (02-project-structure, 03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** (tokens en `frontend/src/styles/_tokens.scss`).
- **Responsive** (`frontend/src/styles/_breakpoints.scss`).
- Standalone + Signals + control flow `@if/@for`.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/` (relevantes).
2. `/Users/rogelio/Documents/Bookly/docs/CORE_FLOW_PLAN.md` §4 (decisiones D3 = horario general).
3. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts:85-98` — schema de working hours.
4. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts:273,284` — endpoints working-hours.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/admin.routes.ts` — rutas a modificar.
6. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/layout/admin-layout.component.ts` — nav a modificar.
7. Revisar el estilo del modal/forms en `services.component.ts` o `appointment-create.component.ts` como referencia.

## 4. Detalle del contrato (working-hours)

POST body:
```json
{
  "hours": [
    { "userId": null, "dayOfWeek": 1, "startTime": "09:00", "endTime": "17:00",
      "breakStartTime": "13:00", "breakEndTime": "14:00", "isActive": true }
  ]
}
```
- `userId`: **null** (horario general de empresa — decisión D3).
- `dayOfWeek`: 0 (Domingo) a 6 (Sábado).
- `startTime`/`endTime`: `HH:MM` requeridos.
- `breakStartTime`/`breakEndTime`: `HH:MM` opcionales.
- `isActive`: booleano.

GET devuelve `{ success, data: hours[] }` con `id`, `companyId`, `userId`, `dayOfWeek`, `startTime`, `endTime`, `breakStartTime`, `breakEndTime`, `isActive`.

## 5. Cambios REQUERIDOS

### 5.1 Página `/app/schedule`
- Crear `frontend/src/app/features/admin/pages/schedule/schedule.component.ts`.
- Vista: **7 días de la semana** (Lun-Dom). Para cada día:
  - Switch activo/inactivo.
  - Hora inicio (time input) y hora fin.
  - Break inicio/fin (opcionales).
  - Si el día no tiene horario configurado, mostrar como "no disponible" (placeholder).
- Botón **Guardar** que hace POST con el array `hours` (solo los días activos; `userId: null`).
- Cargar horarios existentes con GET al abrir (pre-llenar).
- Estilo Midnight Emerald + responsive (en móvil, 1 columna de días; en desktop grid).
- Signals para estado reactivo.

### 5.2 Rutas
- Agregar ruta `schedule` en `admin.routes.ts`.
- Agregar link "Horarios" en el nav del `admin-layout.component.ts`.

### 5.3 ApiService
- Agregar métodos `getWorkingHours()` (GET) y `saveWorkingHours(hours)` (POST) si no existen.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS (todo lo demás = desvío)

- `frontend/src/app/features/admin/pages/schedule/schedule.component.ts` (nuevo)
- `frontend/src/app/features/admin/admin.routes.ts` (agregar ruta)
- `frontend/src/app/features/admin/layout/admin-layout.component.ts` (agregar link nav)
- `frontend/src/app/core/services/api.service.ts` (agregar métodos working-hours)

**NO tocar**: workers/, packages/contracts/, backend, preview.html, estilos globales (_tokens/_breakpoints) salvo imprescindible, docs/.

## 8. NO hacer

- NO tocar backend/contracts.
- NO implementar horario por staff (solo general, userId null).
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona la página schedule, build result, riesgos. Guardar descubrimientos importantes en Engram project 'bookly'.
