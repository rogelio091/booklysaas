# Handoff — Frontend Fase 3: Calendario interactivo (clic en cita → detalle)

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Hacer que al **hacer clic en una cita** en el calendario admin (vistas semana/día) se abra un **modal de detalle** con la información de la cita y acciones para **cambiar estado** y **eliminar**.

Cierra hallazgo **JD-003** (sin click en apt-chip, sin modal de detalle).

## 2. Decisiones ya fijadas (D1)

- D1: el clic en cita permite **cambiar estado + eliminar** (no edición completa).
- D4: el detalle se abre en vistas **semana y día**; en vista mes, el clic navega al día.

## 3. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 4. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/calendar/calendar.component.ts` — componente a modificar.
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — para agregar métodos.
3. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — tipos `AppointmentAdminDto` (ya incluye serviceName), `UpdateAppointmentStatusDto`.
4. Referencia de modal: `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts` (estilo del modal).

## 5. Datos disponibles

`GET /api/appointments` ya devuelve por cita: id, customerName, customerPhone, staffName, serviceName, serviceId, priceQtz, durationMinutes, status, startAt, endAt, source, cancellationReason, notes.

Backend ya tiene:
- `PATCH /api/appointments/:id/status` — body `{ status, cancellationReason? }`. Estados: pending, confirmed, completed, canceled, no_show.
- `DELETE /api/appointments/:id` — elimina físicamente.

## 6. Cambios REQUERIDOS

### 6.1 Click en las citas
- En `calendar.component.ts`, agregar `(click)` a los `apt-chip` en vista **semana** y **día** (hoy no tienen handler).
- Al hacer click → abrir modal de detalle de esa cita.
- En vista **mes**, al hacer click en un día con citas → navegar a ese día (vista día). Mantener el comportamiento actual del click en el día.

### 6.2 Modal de detalle de cita
- Crear componente `frontend/src/app/features/admin/components/appointment-detail/appointment-detail.component.ts`.
- Muestra: servicio (serviceName), cliente (customerName + customerPhone), staff (staffName o "Cualquiera disponible"), fecha/hora (startAt-endAt), estado (pill), precio, notas, origen.
- Acciones:
  - **Cambiar estado**: botones/select para `confirmed` / `completed` / `canceled` / `no_show` (según estado actual). Llama `PATCH /api/appointments/:id/status`. Si es `canceled`, permitir ingresar `cancellationReason`.
  - **Eliminar**: botón "Eliminar" con confirmación (confirm()). Llama `DELETE /api/appointments/:id`.
- Emite evento `changed` para que el calendario recargue.

### 6.3 ApiService
- Agregar `updateAppointmentStatus(id, status, cancellationReason?)` (PATCH) y `deleteAppointment(id)` (DELETE) si no existen.

### 6.4 Recarga
- Tras cambiar estado o eliminar, el modal se cierra y el calendario recarga `GET /api/appointments`.

## 7. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 8. Archivos PERMITIDOS (todo lo demás = desvío)

- `frontend/src/app/features/admin/pages/calendar/calendar.component.ts` (agregar click + integrar modal)
- `frontend/src/app/features/admin/components/appointment-detail/appointment-detail.component.ts` (nuevo)
- `frontend/src/app/core/services/api.service.ts` (agregar métodos status/delete)

**NO tocar**: workers/, packages/contracts/, backend, otros pages/components, preview.html, docs/.

## 9. NO hacer

- NO implementar edición completa (reprogramar/cambiar staff) — solo estado + eliminar.
- NO tocar backend/contracts.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 10. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona el click → detalle → acciones, build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
