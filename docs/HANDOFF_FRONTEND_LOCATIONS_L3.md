# Handoff — Frontend L3: Gestión de Locations (panel admin)

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Crear la gestión de **ubicaciones (locations)** en el panel admin: CRUD de ubicaciones (tipo `fixed`/`mobile`), asignación de servicios y staff a cada ubicación, y respeto del límite por plan (máximo una móvil + maxLocations).

Cierra: JD-A-008 (CRUD locations), JD-A-009 (maxLocations), y habilita la gestión que el admin necesita.

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive** (`_tokens.scss`, `_breakpoints.scss`).
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/` (relevantes).
2. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — `locationResponseSchema` (id, companyId, name, address, slug, type, serviceRadiusKm, isActive), `createLocationSchema`, `updateLocationSchema`, `assignLocationStaffSchema`.
3. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts` — endpoints locations CRUD + staff assignment.
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/admin.routes.ts` — rutas.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/layout/admin-layout.component.ts` — nav.
6. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — métodos a agregar.
7. Referencia de estilo: `services.component.ts` (CRUD similar), `appointment-create.component.ts` (modales).

## 4. Endpoints (ya existen en backend)

| Método | Ruta | Body |
|---|---|---|
| GET | `/api/locations` | — |
| POST | `/api/locations` | createLocationSchema (name, address?, slug, type fixed\|mobile, serviceRadiusKm?, isActive) |
| PUT | `/api/locations/:id` | updateLocationSchema |
| DELETE | `/api/locations/:id` | soft-delete |
| GET | `/api/locations/:id/staff` | — |
| POST | `/api/locations/:id/staff` | `{ staffIds: number[] }` |

Reglas de negocio (backend):
- Máximo **una ubicación móvil** por empresa (400 `MOBILE_LIMIT_REACHED`).
- Límite `maxLocations` por plan (403 `LOCATIONS_LIMIT_REACHED`).
- Mostrar estos errores al usuario.

## 5. Cambios REQUERIDOS

### 5.1 Página `/app/locations`
- Crear `frontend/src/app/features/admin/pages/locations/locations.component.ts`.
- Lista de ubicaciones (tarjetas o tabla responsive): nombre, tipo (Fijo/Móvil), dirección, radio (si móvil), activo.
- Botón "+ Nueva Ubicación" + modal de crear/editar (nombre, tipo select fixed/mobile, dirección, slug, radio si móvil, activo).
- Botón eliminar (soft-delete).
- Manejar errores de límite (una móvil / maxLocations) mostrando el mensaje del backend.

### 5.2 Asignación de servicios y staff por ubicación
- En cada tarjeta/edición de ubicación, permitir asignar:
  - **Servicios** (checkbox de GET /api/services → POST via serviceLocations si hay endpoint; si no, dejar TODO).
  - **Staff** (POST /api/locations/:id/staff con staffIds de GET /api/staff).
- Si el endpoint de asignar servicios a ubicación no existe aún, dejar solo la de staff y marcar servicios como TODO.

### 5.3 Rutas y nav
- Agregar ruta `locations` en `admin.routes.ts`.
- Agregar link "Ubicaciones" en `admin-layout.component.ts`.

### 5.4 ApiService
- Agregar `getLocations()`, `createLocation(data)`, `updateLocation(id, data)`, `deleteLocation(id)`, `getLocationStaff(id)`, `assignLocationStaff(id, staffIds)`.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS

- `frontend/src/app/features/admin/pages/locations/locations.component.ts` (nuevo)
- `frontend/src/app/features/admin/admin.routes.ts` (ruta)
- `frontend/src/app/features/admin/layout/admin-layout.component.ts` (nav)
- `frontend/src/app/core/services/api.service.ts` (métodos locations)

**NO tocar**: workers/, packages/contracts/, backend, otros pages/components, preview.html, docs/.

## 8. NO hacer

- NO tocar backend/contracts.
- NO implementar el paso de ubicación en el wizard público (eso es L4).
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona el CRUD de locations y la asignación de staff, build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
