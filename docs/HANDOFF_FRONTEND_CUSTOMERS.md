# Handoff — Frontend Fase 5: Clientes + autocomplete

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Implementar la gestión de clientes en el panel admin:
1. **Página `/app/customers`** para listar/buscar clientes (decisión D2 = listar + buscar, no CRUD completo).
2. **Autocomplete de cliente** en el modal de crear cita (buscar por teléfono/nombre; si no existe, se crea al guardar).

Cierra hallazgo **JD-A-002 / JD-B-002** (sin endpoint/UI de clientes).

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — `CustomerResponseDto` (id, companyId, name, phone, email, notes, createdAt).
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — para métodos.
3. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/admin.routes.ts` — rutas.
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/layout/admin-layout.component.ts` — nav.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts` — modal a modificar (autocomplete).
6. Referencia de tabla responsive: `appointments.component.ts`.

## 4. Contrato backend (ya existe)

- `GET /api/customers?search=<nombre|telefono>&limit=<n>` — devuelve `{ success, data: CustomerResponseDto[] }`. `search` hace LIKE en name o phone. `limit` default 50 max 100.

## 5. Cambios REQUERIDOS

### 5.1 Página `/app/customers`
- Crear `frontend/src/app/features/admin/pages/customers/customers.component.ts`.
- Input de búsqueda (por nombre o teléfono) con botón buscar / debounce.
- Tabla de clientes (responsive, estilo tipo appointments: tabla en desktop, tarjetas en móvil con data-label).
- Columnas: nombre, teléfono, email (o "—"), fecha de creación.
- Mostrar estado vacío si no hay resultados.
- Al cargar, muestra los primeros 50 (GET sin search).

### 5.2 Autocomplete en crear cita
- En `appointment-create.component.ts`, reemplazar los inputs de texto plano `customerName`/`customerPhone` por un campo de **búsqueda de cliente**:
  - Input que busca clientes (GET /api/customers?search=...) al escribir.
  - Lista de sugerencias (por nombre + teléfono).
  - Al seleccionar un cliente existente → autocompleta nombre, teléfono y email.
  - Si no se selecciona ninguno (se escribe nuevo) → al guardar se crea el cliente nuevo (el backend ya hace find-or-create por teléfono).
- Mantener la posibilidad de escribir un cliente nuevo manualmente (nombre + teléfono + email opcional).

### 5.3 Rutas y nav
- Agregar ruta `customers` en `admin.routes.ts`.
- Agregar link "Clientes" en `admin-layout.component.ts`.

### 5.4 ApiService
- Agregar método `getCustomers(search?, limit?)` (GET /api/customers).

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

## 7. Archivos PERMITIDOS (todo lo demás = desvío)

- `frontend/src/app/features/admin/pages/customers/customers.component.ts` (nuevo)
- `frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts` (autocomplete de cliente)
- `frontend/src/app/features/admin/admin.routes.ts` (ruta)
- `frontend/src/app/features/admin/layout/admin-layout.component.ts` (link nav)
- `frontend/src/app/core/services/api.service.ts` (método getCustomers)

**NO tocar**: workers/, packages/contracts/, backend, otros pages/components, preview.html, docs/.

## 8. NO hacer

- NO implementar crear/editar/eliminar clientes desde una página dedicada (solo listar/buscar). El alta de clientes ocurre al reservar o al crear cita.
- NO tocar backend/contracts.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivos creados/modificados, cómo funciona la búsqueda de clientes y el autocomplete, build result, riesgos. Guardar descubrimientos en Engram project 'bookly'.
