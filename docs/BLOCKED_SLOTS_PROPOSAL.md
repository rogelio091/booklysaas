# Propuesta: Gestión de Bloqueos de Disponibilidad (Calendario Admin)

> Feature para que el admin pueda deshabilitar fechas/horarios específicos desde el calendario.
> Basado en verify: el backend YA soporta blockedSlots (GET/POST/DELETE /api/schedule/blocks) y el Slot Engine ya los respeta. Solo falta UI.

---

## 1. Problema que resuelve

El admin configura horarios semanales (working hours), pero no puede:
- Deshabilitar un **día puntual** (ej: mañana no hay servicio por mantenimiento).
- Deshabilitar un **rango horario específico** de un día (ej: Lunes 30 de 14:00-16:00 ocupado).
- Habilitar **horarios extra** puntuales (ej: sábado extra de emergencia).

## 2. Solución propuesta

Usar la entidad `blockedSlots` existente (startAt/endAt/reason, company-wide por defecto).

### Bloqueos de exclusión (deshabilitar)
- Desde el calendario, el admin selecciona una **fecha** o un **rango horario** → lo marca como bloqueado.
- El Slot Engine deja de ofrecer esos slots al cliente.
- El bloqueo se muestra visualmente en el calendario admin (color de peligro/sombreado).

### Excepciones de extensión (habilitar extras) — decisión
- Para "habilitar extras" (horario extra fuera del semanal), `blockedSlots` NO sirve (es solo exclusión). Se necesitaría una entidad de "working hours excepcionales" o marcar un slot como disponible extra.
- **Recomendación**: en esta fase, implementar SOLO bloqueos de exclusión (deshabilitar fechas/horarios), que es el caso de uso principal que pediste. Los "extras" se dejan para una fase posterior (requiere modelo distinto).

## 3. Interacción en el calendario (UI)

### Opción A — Click en fecha/hora abre menú de bloqueo (recomendado)
- En vista día o semana: hacer **click derecho** (o botón "Bloquear" en el detalle del día/hora) → crea un bloqueo para ese rango.
- Alternativa más simple: un botón "Bloquear fecha" al hacer click en un día de la vista mes (además de navegar al día).

### Opción B — Panel de bloqueos separado
- Una sub-sección en `/app/schedule` para listar/crear/eliminar bloqueos puntuales (por fecha/hora).
- Más explícito pero menos integrado al calendario.

### Opción C — Híbrida (recomendado por veredicto)
- En el calendario, los días con bloqueo se muestran sombreados.
- Al hacer click en un día de la vista mes: si tiene bloqueos → abre un pequeño panel con los bloqueos del día + opción de crear/eliminar. Si tiene citas → navega al día.
- Vista día/semana: botón "Bloquear este horario" en cada slot libre o en el detalle.

## 4. Requisitos

- Consumir `GET/POST/DELETE /api/schedule/blocks` (ya existen).
- Mostrar días con bloqueo en el calendario (sombreado + tooltip con el motivo).
- Crear bloqueo: seleccionar fecha (y opcionalmente hora inicio/fin + motivo).
- Eliminar bloqueo: desde el panel/detalle.
- Respetar el Slot Engine (ya lo hace — no requiere cambio backend).

## 5. Decisiones pendientes para el juicio

| # | Decisión |
|---|---|
| B1 | ¿Incluir "horarios extra" (working hours excepcionales) en esta fase, o solo bloqueos de exclusión? |
| B2 | ¿Interacción: opción A (click), B (panel), o C (híbrida)? |
| B3 | ¿Los bloqueos son solo de empresa (company-wide) o por staff? (hoy el contrato soporta ambos) |
| B4 | ¿Cómo mostrar visualmente los días bloqueados en el calendario? |

## 6. Fuera de alcance (fase posterior)

- Working hours excepcionales (habilitar extras fuera del horario semanal).
- Bloqueos recurrentes (ej: todos los lunes).
