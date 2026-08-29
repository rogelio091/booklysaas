# Handoff — Backend: Auth funcional (PBKDF2 hash + login + requireRole)

> Documento de traspaso para el agente de backend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes tocar los archivos listados en §6. Cualquier cambio fuera de esa lista se revierte. NO implementes lógica no pedida.**

---

## 1. Objetivo

Hacer que el login de Bookly sea **completamente funcional y seguro** usando el mismo estándar de hashing que BarberApp (PBKDF2-SHA256 via Web Crypto). Cierra los hallazgos:
- **JD-001 parcial** (login sin validar password)
- Necesidad de `requireRole` básico.

## 2. Estándar de hashing (copiar de BarberApp)

Replicar EXACTAMENTE el patrón de `/Users/rogelio/Documents/BarberApp/workers/src/utils/password.ts`:

- **Algoritmo**: PBKDF2-SHA256 via Web Crypto API (nativo, cabe en el budget de CPU del plan Free de Workers).
- **Formato**: `pbkdf2$<iterations>$<saltHex>$<hashHex>`
- **Iteraciones**: 100,000 (máximo soportado por CF Workers Web Crypto).
- **Salt**: 16 bytes aleatorios por usuario.
- **Verificación con comparación en tiempo constante** (anti timing attack).
- **NO usar Argon2id ni bcrypt** (solo PBKDF2 para Bookly; no hay hashes legacy).

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/BarberApp/workers/src/utils/password.ts` — **referencia de implementación exacta**.
2. `/Users/rogelio/Documents/Bookly/docs/USE_CASES.md` §1.1 (roles), §2.2 (aislamiento).
3. `/Users/rogelio/Documents/Bookly/workers/src/routes/admin.ts` — login actual (líneas ~35-70).
4. `/Users/rogelio/Documents/Bookly/workers/src/middleware/auth.ts` — middleware actual.
5. `/Users/rogelio/Documents/Bookly/workers/src/db/schema.ts` — tabla `users` (tiene `passwordHash`).
6. `/Users/rogelio/Documents/Bookly/workers/src/db/seed.sql` — seeds actuales (passwords en texto plano).

## 4. Cambios REQUERIDOS

### 4.1 Crear `workers/src/utils/password.ts`
- `hashPassword(password)` → `pbkdf2$100000$<saltHex>$<hashHex>`
- `verifyPassword(password, stored)` → comparación en tiempo constante, devuelve false si malformado.
- Crear `workers/src/utils/password.spec.ts` con tests: hash→verify ok, password incorrecta false, hash malformado false.

### 4.2 Modificar `workers/src/routes/admin.ts` (SOLO el login, líneas ~35-70)
- Tras encontrar el usuario, **verificar** `await verifyPassword(password, user.passwordHash)`.
- Si falla → `INVALID_CREDENTIALS` 401 (mismo código para usuario inexistente y password incorrecta, anti enumeración).

### 4.3 Modificar `workers/src/db/seed.sql`
- Reemplazar `password123` por el **hash PBKDF2 real** de la contraseña `password123`.
- Generar el hash con el script (4.4) o calculando a mano con la función.

### 4.4 Crear script para generar hash (útil para futuros users)
- `workers/scripts/hash-password.ts` (o similar): recibe una password por CLI/env y devuelve el hash. Útil para que el dueño cree usuarios.

### 4.5 Agregar `requireRole` básico al middleware
- En `workers/src/middleware/auth.ts` (o un archivo nuevo `workers/src/middleware/require-role.ts`), agregar una función `requireRole(roles: Role[])` que devuelva 403 si el rol del JWT no está en la lista.
- NO refactorizar los routes existentes para usarlo en todos; solo dejar la utilidad disponible y usarla en los endpoints de superadmin cuando existan. (Se deja lista para bloques futuros.)

## 5. Comandos

```bash
cd /Users/rogelio/Documents/Bookly
pnpm -r typecheck
pnpm --filter bookly-api test   # debe seguir pasando (slot-engine 18, notification 3, webhooks 2) + password nuevos
```

> NO aplicar migración (no hay cambios de schema en este bloque). NO tocar producción.

## 6. Archivos PERMITIDOS (todo lo demás = desvío, se revierte)

- `workers/src/utils/password.ts` (nuevo)
- `workers/src/utils/password.spec.ts` (nuevo)
- `workers/src/routes/admin.ts` (solo el bloque del login)
- `workers/src/db/seed.sql` (solo la línea de passwords)
- `workers/scripts/hash-password.ts` (nuevo)
- `workers/src/middleware/require-role.ts` (nuevo, opcional si lo separas)

**NO tocar**: schema.ts, types.ts, wrangler.*, index.ts, routes/public.ts, routes/webhooks.ts, frontend/, packages/contracts/, crypto.ts, migraciones.

## 7. Resultado esperado

Reportar:
1. Archivos modificados/creados.
2. Hash generado para `password123` (para que el dueño pueda loguear).
3. Tests pasando (count).
4. Cómo probar el login (curl o endpoint).
5. Riesgos/decisiones.

## 8. NO hacer

- NO implementar superadmin routes.
- NO tocar frontend.
- NO cambiar schema.
- NO deployar.
- NO commitear (dejar cambios en working tree).
