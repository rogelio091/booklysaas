# Handoff — Frontend: Inputs de fecha/hora (estilo + validación de pasados)

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Dos cosas:
1. **Estilizar los inputs de fecha/hora** para que sean coherentes con la UI Midnight Emerald (hoy son `datetime-local`/`time`/`date` nativos sin estilo, se ven "muy simples").
2. **Validar fechas pasadas en la UI** (el backend ya lo hace — ahora el frontend también): el usuario no debe poder seleccionar horarios ya pasados, y al crear cita el `datetime-local` debe tener `min` de hoy.

Cierra el hallazgo: "te deja seleccionar un horario que ya pasó" + "inputs muy simples".

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Estilo **Midnight Emerald** + **responsive**.
- Standalone + Signals + control flow.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/` (relevantes).
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/booking/booking.component.ts` — wizard público (selector de fecha es calendario propio; revisar que deshabilite días pasados y que los slots del día de hoy solo muestren horas futuras).
3. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts` — modal crear cita (input `datetime-local`).
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/schedule/schedule.component.ts` — modal de bloqueos (inputs `date`/`time`).
5. `/Users/rogelio/Documents/Bookly/frontend/src/styles/_tokens.scss` + `_breakpoints.scss` — tokens y responsive.

## 4. Cambios REQUERIDOS

### 4.1 Estilo de inputs de fecha/hora (coherente con Midnight Emerald)
- Crear estilos consistentes para `input[type="date"]`, `input[type="time"]`, `input[type="datetime-local"]`:
  - Fondo oscuro (var(--color-surface-glass)), borde (var(--color-border)), texto claro.
  - `color-scheme: dark` para que el native picker se vea oscuro.
  - Focus con borde primario + glow (como los demás inputs).
  - Si es posible, un wrapper/clase compartida (ej. `.datetime-field`) — pueden definirla en cada componente o como utilidad global si no rompe.
- Aplicarlo a: appointment-create (datetime-local), schedule (date/time de bloqueos), y donde haya date/time.

### 4.2 Validación de fechas pasadas (UI)
- **appointment-create (admin)**: el `datetime-local` debe tener `min` = ahora local formateado (`YYYY-MM-DDTHH:mm`). Si el usuario elige un valor pasado, mostrar error y deshabilitar submit.
- **booking (público)**:
  - El calendario mensual ya deshabilita días pasados (verificar `cell.isPast`).
  - Los slots del día de hoy: el backend ya no los devuelve (filtra pasados), pero por UX el frontend también puede marcar/ocultar horas pasadas si el backend los devuelve (doblemente seguro).
  - Al seleccionar un slot, si el backend responde 400 `PAST_DATE` al reservar, mostrar el mensaje.
- **schedule (bloqueos)**: la fecha del bloqueo debe ser hoy o futura (min). El rango horario ya valida end>start.

### 4.3 Manejo del error PAST_DATE
- En el submit del booking: si el backend devuelve `PAST_DATE`, mostrar mensaje y recargar disponibilidad.

## 5. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend test -- --watch=false
```

## 6. Archivos PERMITIDOS

- `frontend/src/app/features/booking/booking.component.ts`
- `frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts`
- `frontend/src/app/features/admin/pages/schedule/schedule.component.ts`
- (solo si es imprescindible para no duplicar) `frontend/src/styles/theme.scss` — agregar estilos base para date/time/datetime-local. Preferir estilos por componente.

**NO tocar**: workers/, packages/contracts/, backend, otros pages, preview.html, docs/.

## 7. NO hacer

- NO tocar backend/contracts.
- NO cambiar la lógica de negocio (solo validación/estilo).
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 8. Resultado esperado

Reportar: archivos modificados, cómo quedó el estilo de los inputs, cómo se validan pasados (min, deshabilitados, mensajes), build + tests (count), riesgos. Guardar descubrimientos en Engram project 'bookly'.
