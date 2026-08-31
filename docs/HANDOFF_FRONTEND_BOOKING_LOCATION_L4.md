# Handoff — Frontend L4: Wizard de reserva con ubicación

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Agregar el **paso de elegir ubicación** al wizard público de reserva (`/book/:slug`), filtrar servicios/horarios por lugar, y para ubicaciones **móviles** pedir dirección del cliente y dejar la cita en `pending` (confirmación manual). Cierra: JD-A-011 (wizard sin paso de ubicación), JD-B-003 (sin locationId), JD-B-002 (sin dirección).

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/` (relevantes).
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/booking/booking.component.ts` — el wizard actual (4 pasos: Servicio→Staff→FechaHora→Datos).
3. `/Users/rogelio/Documents/Bookly/packages/contracts/src/public.ts` — schemas: availabilityQuerySchema + createBookingSchema (ya tienen locationId opcional), publicCompanySchema.
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — métodos públicos.
5. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — locationResponseSchema (type fixed|mobile).

## 4. Estado actual del backend (ya listo)

- `GET /api/public/:slug/company` → perfil de la empresa.
- `GET /api/public/:slug/availability?serviceId=&date=&staffId=&locationId=` → ya filtra por locationId (L2).
- `POST /api/public/:slug/book` → ya acepta `locationId` y lo persiste (L2).
- El Slot Engine ya filtra staff/horarios/bloqueos por ubicación (L2).

**Falta en el flujo público:**
- Endpoint para listar las locations públicas de una empresa (o exponerlas en `/company`).
- Filtrar servicios por ubicación vía `serviceLocations` (se dejó como TODO).
- Campo de dirección del cliente para reservas móviles.

## 5. Cambios REQUERIDOS

### 5.1 Endpoint de locations públicas (si no existe)
- Si `GET /api/public/:slug/company` no devuelve las locations, agregar `GET /api/public/:slug/locations` que devuelva `{ success, data: PublicLocationDto[] }` (id, name, address?, type, serviceRadiusKm?, slug). **Esto es backend** — si no existe, marcarlo como bloqueo y avisar al orquestador.

### 5.2 Wizard — nuevo paso de ubicación
- Agregar un paso (o sub-paso al inicio) donde el cliente elige la ubicación, **solo si la empresa tiene más de una** (si tiene 1, se usa por defecto sin mostrar).
- Cada ubicación se muestra con su tipo: **Fijo** ("En tu local") o **Móvil** ("A domicilio").
- Al elegir ubicación, cargar los **servicios disponibles en ese lugar** (filtrar por serviceLocations si el endpoint lo permite; si no, mostrar todos).

### 5.3 Dirección para móvil
- Si la ubicación es `mobile`, el paso de datos del cliente debe incluir un campo **dirección de destino** (adonde viaja el negocio).
- Persistirla en la reserva (si el contrato no tiene campo address, usar `notes` o agregar `customerAddress` al contrato — decidir).

### 5.4 Confirmación manual para móvil
- La cita móvil queda en `pending` (el negocio confirma). La fija puede seguir el flujo actual.

### 5.5 Adaptar el wizard
- El wizard pasa a: Ubicación (opcional) → Servicio → Staff → FechaHora → Datos.
- Pasar `locationId` a availability y al book.
- Mantener responsive + Midnight Emerald.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS

- `frontend/src/app/features/booking/booking.component.ts` (paso de ubicación)
- `frontend/src/app/core/services/api.service.ts` (métodos públicos de locations/servicios por ubicación)
- `packages/contracts/src/public.ts` (si hace falta campo dirección)
- (solo si es imprescindible) `workers/src/routes/public.ts` (endpoint de locations públicas)

**NO tocar**: schema.ts, admin.ts, slot-engine.ts, migraciones, otros pages admin, preview.html, docs/.

## 8. NO hacer

- NO tocar el CRUD de locations admin (ya listo).
- NO implementar confirmación/pagos (otras fases).
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona el paso de ubicación, si hubo que tocar backend (locations públicas / dirección), build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
