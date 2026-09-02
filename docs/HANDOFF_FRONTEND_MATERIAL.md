# Handoff — Frontend: Angular Material (Datepicker + Timepicker) con tema Midnight Emerald

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Instalar **Angular Material 21** en Bookly y reemplazar los inputs nativos de fecha/hora (`datetime-local`, `date`, `time`) por **`MatDatepicker` + `MatTimepicker`** con tema oscuro Midnight Emerald, siguiendo el estándar AgentMemories §7.6 (patrón BarberApp). Preservar todas las validaciones existentes (fechas pasadas, min, ranges).

## 2. Estándares a seguir

- **LEER primero**: `/Users/rogelio/Documents/AgentMemories/angular/standards/07-design-system.md` — **§7.6 Datepicker de Angular Material (tema oscuro)** es la referencia exacta (patrón BarberApp). Adaptar los tokens de BarberApp (gold) a los de Bookly (Midnight Emerald en `frontend/src/styles/_tokens.scss`).
- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (03-components, 05-http-services, 06-forms, 13-naming).
- Angular 21 Standalone + Signals.

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/07-design-system.md` (§7.6).
2. `/Users/rogelio/Documents/Bookly/frontend/src/styles/_tokens.scss` — tokens Midnight Emerald (--color-primary, --color-surface-glass, --color-border, --color-text, etc.).
3. `/Users/rogelio/Documents/Bookly/frontend/src/styles/theme.scss` — estilos globales (para agregar los overrides de Material).
4. `/Users/rogelio/Documents/Bookly/frontend/src/styles.scss` — punto de entrada de estilos.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts` — datetime-local a migrar (con min + notPastValidator).
6. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/schedule/schedule.component.ts` — date/time de bloqueos a migrar (con min + timeRangeInvalid).
7. `/Users/rogelio/Documents/Bookly/frontend/src/app/app.config.ts` — providers (agregar provideAnimations si hace falta).
8. `/Users/rogelio/Documents/Bookly/frontend/angular.json` — styles (agregar theme de Material si se requiere).

## 4. Cambios REQUERIDOS

### 4.1 Instalar Angular Material 21
```bash
cd frontend
pnpm add @angular/material@21 @angular/cdk@21 @angular/animations@21
```
- Angular 21 → Material 21.2.x (compatible).
- Agregar `provideAnimations()` en `app.config.ts` (o `provideAnimationsAsync()`).
- Verificar que `@angular/material` usa tokens modernos (no prebuilt theme si personalizamos todo — preferir **sin prebuilt theme**, con overrides propios).

### 4.2 Tema oscuro global de Material (Midnight Emerald)
En `frontend/src/styles/theme.scss` (o styles.scss), agregar overrides globales siguiendo §7.6 pero con tokens de Bookly:
- `.mat-datepicker-content`: fondo `var(--color-surface-glass)`, borde `var(--color-border)`, radio `var(--radius-lg)`, sombra acorde.
- `.mat-calendar`: fondo degradado oscuro, texto `var(--color-text)`.
- `.mat-calendar-period-button`, `.mat-calendar-arrow` (fill `var(--color-primary)`), headers y labels con `var(--color-text-muted)`.
- `.mat-calendar-body-cell` hover/seleccionado con `--color-primary` + glow.
- **Timepicker** (`.mat-timepicker-*`) si Angular 21 lo expone: mismo tratamiento oscuro (fondo, texto, acentos).
- Usar tokens, no HEX duro. `!important` solo donde Material compita por especificidad.
- NO usar prebuilt theme de Material (para no sobrescribir el look custom).

### 4.3 Migrar inputs (3 archivos)
- **appointment-create**: `datetime-local` → `MatDatepicker` (fecha) + `MatTimepicker` (hora), o `MatDatepickerInput` + `MatTimepickerInput` combinados. Preservar `min` (minStartAt) y `notPastValidator` → traducir a los nuevos controles (Date para fecha). El submit sigue deshabilitado si inválido.
- **schedule (bloqueos)**: `date` → `MatDatepicker`; `startTime`/`endTime` → `MatTimepicker`. Preservar `min` (minBlockDate) y `timeRangeInvalid` (end > start).
- **schedule (horarios semanales)**: los `type="time"` de start/end/break → `MatTimepicker`.

### 4.4 Validaciones preservadas
- Fechas pasadas: `min` = hoy, y el backend sigue siendo la autoridad (`PAST_DATE`).
- Rangos horarios: `timeRangeInvalid` sigue funcionando.
- No romper el wizard público (booking.component NO usa inputs nativos de fecha — tiene calendario propio; no tocarlo salvo que sea necesario).

## 5. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend test -- --watch=false
```

## 6. Archivos PERMITIDOS

- `frontend/package.json` (agregar material/cdk/animations)
- `frontend/src/app/app.config.ts` (provideAnimations)
- `frontend/src/styles/theme.scss` o `frontend/src/styles.scss` (overrides Material)
- `frontend/src/app/features/admin/components/appointment-create/appointment-create.component.ts`
- `frontend/src/app/features/admin/pages/schedule/schedule.component.ts`
- (si se requiere por el setup) `frontend/angular.json` (styles)

**NO tocar**: workers/, packages/contracts/, backend, booking.component.ts (wizard público), otros pages, preview.html, docs/.

## 7. NO hacer

- NO usar prebuilt theme de Material que rompa el look custom.
- NO tocar backend/contracts.
- NO tocar el wizard público.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 8. Resultado esperado

Reportar: dependencias agregadas, cómo quedó el tema oscuro de Material (con qué tokens), qué inputs se migraron, build + tests (count), riesgos. Guardar descubrimientos en Engram project 'bookly'.
