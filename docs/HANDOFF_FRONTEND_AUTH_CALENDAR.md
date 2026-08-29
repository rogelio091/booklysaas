# Handoff — Frontend: Login + AuthGuard + Panel + Calendario (Admin y Cliente)

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte. NO implementes lógica no pedida.**

---

## 1. Objetivo

Hacer funcional y probable el flujo de autenticación y el panel administrativo, e implementar las vistas de calendario:

1. **Pantalla de login** que funcione con el backend (endpoint `POST /api/auth/login`).
2. **AuthGuard** que proteja las rutas `/app`.
3. **Panel admin funcional** (ya hay estructura de Appointments y Services).
4. **Calendario del admin** con vista **mes, semana y día**.
5. **Calendario del cliente** (portal público) con vista **mes** para seleccionar día.

## 2. Estándares de frontend a seguir

- **`/Users/rogelio/Documents/AgentMemories/Standards_Angular.md`** — LEER Y CUMPLIR (Standalone, Signals, control flow `@if/@for`, SCSS, nomenclatura).
- Estilo visual: **Midnight Emerald** (tokens ya en `frontend/src/styles/_tokens.scss`).
- Todo **responsive** (mixins en `frontend/src/styles/_breakpoints.scss`).

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/Standards_Angular.md` (estándares).
2. `/Users/rogelio/Documents/Bookly/docs/USE_CASES.md` §7 (flujo reserva), §7.3 (estados).
3. `/Users/rogelio/Documents/Bookly/frontend/src/app/app.routes.ts` — rutas actuales.
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/admin.routes.ts` — rutas admin.
5. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/auth/auth.store.ts` — store de auth existente.
6. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/interceptors/jwt.interceptor.ts` — interceptor existente.
7. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/layout/admin-layout.component.ts` — layout.
8. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/admin/pages/appointments/appointments.component.ts` — lista actual.
9. `/Users/rogelio/Documents/Bookly/frontend/src/app/core/services/api.service.ts` — servicio API.
10. `/Users/rogelio/Documents/Bookly/packages/contracts/src/admin.ts` — tipos (loginRequestSchema, authResponseSchema).

## 4. Cambios REQUERIDOS

### 4.1 Pantalla de login
- Componente `frontend/src/app/features/auth/login/login.component.ts` (Standalone, Signals).
- Formulario email + password.
- Llama a `POST /api/auth/login` (via ApiService o HttpClient).
- En éxito: `authStore.setAuth(data)` y redirige a `/app/appointments`.
- En error: muestra mensaje `INVALID_CREDENTIALS`.
- Estilo Midnight Emerald + responsive.

### 4.2 AuthGuard
- `frontend/src/app/core/auth/auth.guard.ts` (CanActivateFn functional guard).
- Si no autenticado → redirige a `/app/login`.
- Aplicar a las rutas `/app` (en `app.routes.ts`).

### 4.3 Rutas
- `app.routes.ts`: agregar `/app/login` (público) y aplicar guard a `/app`.

### 4.4 Panel admin (ajustes menores)
- Asegurar que `AppointmentsComponent` y `ServicesComponent` consumen el API autenticado (el interceptor ya agrega el token).

### 4.5 Calendario del ADMIN — vista mes/semana/día
- Componente `frontend/src/app/features/admin/pages/calendar/calendar.component.ts`.
- Toggle de vista: **Mes | Semana | Día**.
- Muestra las citas del tenant (consume `GET /api/appointments`).
- Vista mes: grid mensual, marca días con citas.
- Vista semana: 7 columnas con citas por hora.
- Vista día: timeline de citas por hora.
- Estilo Midnight Emerald + responsive.

### 4.6 Calendario del CLIENTE — vista mes
- Dentro del wizard de reserva existente (`booking.component.ts`), el selector de fecha YA existe como "píldoras de 14 días". Cambiar/reforzar para que sea una **vista de calendario mensual** donde el cliente seleccione un día.
- NO romper el flujo del wizard (paso 3 ya muestra slots). Solo mejorar el selector de fecha a calendario mensual.
- Respeta la timezone del tenant (ver hallazgo JD-B-011).

### 4.7 Registrar la ruta del calendario admin
- Agregar `/app/calendar` al `admin.routes.ts` y al nav del layout.

## 5. Estructura de archivos a crear (referencia)

```
frontend/src/app/features/auth/login/login.component.ts
frontend/src/app/core/auth/auth.guard.ts
frontend/src/app/features/admin/pages/calendar/calendar.component.ts
```

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly
pnpm -r typecheck
pnpm --filter frontend build
```

> NO tocar backend. NO deployar. NO commitear (dejar en working tree).

## 7. Archivos PERMITIDOS (todo lo demás = desvío, se revierte)

- `frontend/src/app/features/auth/login/login.component.ts` (nuevo)
- `frontend/src/app/core/auth/auth.guard.ts` (nuevo)
- `frontend/src/app/features/admin/pages/calendar/calendar.component.ts` (nuevo)
- `frontend/src/app/app.routes.ts` (modificar)
- `frontend/src/app/features/admin/admin.routes.ts` (modificar)
- `frontend/src/app/features/admin/layout/admin-layout.component.ts` (solo agregar link calendario al nav)
- `frontend/src/app/core/services/api.service.ts` (solo si necesitas método login)
- `frontend/src/app/features/booking/booking.component.ts` (solo el selector de fecha → calendario mensual)
- `frontend/src/app/core/auth/auth.store.ts` (solo si falta método login, y ya existe)

**NO tocar**: workers/, packages/contracts/, estilos globales `_tokens.scss`/`theme.scss` (solo si es imprescindible), preview.html, docs/.

## 8. Resultado esperado

Reportar:
1. Archivos creados/modificados.
2. Ruta de login y credenciales esperadas.
3. Cómo se ve el calendario admin (mes/semana/día) y el del cliente (mes).
4. Typecheck/build OK.
5. Riesgos/decisiones.

## 9. NO hacer

- NO tocar backend.
- NO cambiar contratos.
- NO deployar.
- NO commitear.
- NO implementar funcionalidad extra no listada.
