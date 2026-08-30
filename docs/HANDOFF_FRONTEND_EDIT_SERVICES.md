# Handoff — Frontend Fase 4: Editar servicios

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Agregar la capacidad de **editar servicios** en el panel admin. Hoy `services.component.ts` solo permite crear (POST). Se agrega un botón "Editar" en las tarjetas y un **modo edición** en el modal que llama `PUT /api/services/:id`, manteniendo el modo crear (POST).

Cierra hallazgo **JD-A-005** (servicios UI solo crea).

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/services/services.component.ts` — componente a modificar.
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — para el método update.
3. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — tipos `ServiceResponseDto`, `UpdateServiceDto`.

## 4. Contrato backend (ya existe)

- `POST /api/services` — crear (body: CreateServiceDto).
- `PUT /api/services/:id` — actualizar (body: UpdateServiceDto = CreateServiceDto.partial()).
- `GET /api/services` — listar (devuelve ServiceResponseDto[] con id, companyId, name, description, durationMinutes, bufferAfterMinutes, priceQtz, isActive, displayOrder).

## 5. Cambios REQUERIDOS

### 5.1 Botón Editar en tarjetas
- En `services.component.ts`, agregar un botón "Editar" en cada tarjeta de servicio (junto al estado o en un área de acciones de la tarjeta).
- Al hacer click → abrir el modal en **modo edición** con el formulario pre-llenado con los datos del servicio.

### 5.2 Modo edición del modal
- El modal pasa a soportar dos modos: **crear** (título "Crear Nuevo Servicio", POST) y **editar** (título "Editar Servicio", PUT a `/api/services/:id`).
- Mantener señal `editingService: signal<ServiceResponseDto | null>` — null = crear, con valor = editar.
- Al abrir en modo edición: pre-llenar `form` y `priceInput` (priceQtz/100) con los datos del servicio.
- `saveService()`: si `editingService()` es null → POST; si no → PUT con el id.
- Tras guardar (crear o editar) → cerrar modal + recargar lista.

### 5.3 ApiService
- Agregar método `updateService(id, data)` (PUT /api/services/:id) si no existe.

### 5.4 Form
- El formulario actual ya tiene: name, description, durationMinutes, price (como priceInput), priceQtz. No tiene el campo buffer visible (se mantiene oculto con valor 0 por decisión previa). NO agregar buffer a la UI.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS (todo lo demás = desvío)

- `frontend/src/app/features/admin/pages/services/services.component.ts` (botón editar + modo edición)
- `frontend/src/app/core/services/api.service.ts` (método updateService)

**NO tocar**: workers/, packages/contracts/, backend, otros pages/components, preview.html, docs/.

## 8. NO hacer

- NO agregar buffer a la UI.
- NO tocar backend/contracts.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos modificados, cómo funciona el modo edición, build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
