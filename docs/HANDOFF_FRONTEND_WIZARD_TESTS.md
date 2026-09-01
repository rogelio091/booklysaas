# Handoff — Frontend: Tests del Booking Wizard

> Documento de traspaso para el agente de frontend. **Única autoridad de este bloque.**
> **REGLA ANTI-DESVÍO: solo puedes crear/modificar los archivos listados en §7. Cualquier cambio fuera de esa lista se revierte.**

---

## 1. Objetivo

Escribir **tests unitarios** del booking wizard (`booking.component.ts`) que validen el comportamiento de `canProceed` — específicamente que el botón de confirmar se habilita cuando el usuario completa todos los datos. Esto evita la regresión del bug recién corregido (el botón quedaba deshabilitado porque `canProceed` no reaccionaba a cambios).

## 2. Estándares a seguir

- `/Users/rogelio/Documents/AgentMemories/angular/standards/` (16-testing.md principalmente).
- Proyecto usa Vitest (ver `frontend/package.json` y `angular.json` test builder).

## 3. Archivos a leer primero

1. `/Users/rogelio/Documents/AgentMemories/angular/standards/16-testing.md` — estándar de testing.
2. `/Users/rogelio/Documents/Bookly/frontend/src/app/features/booking/booking.component.ts` — el componente a testear.
3. `/Users/rogelio/Documents/Bookly/frontend/angular.json` — config de test (builder `@angular/build:unit-test` con Vitest).
4. `/Users/rogelio/Documents/Bookly/frontend/src/app/app.spec.ts` — ejemplo de test existente (patrón).
5. `/Users/rogelio/Documents/Bookly/frontend/tsconfig.spec.json` — config TS de tests.

## 4. Qué testear

Crear `frontend/src/app/features/booking/booking.component.spec.ts` (si no existe). Cubrir:

1. **canProceed para paso 'data'**:
   - Deshabilitado cuando los campos están vacíos.
   - Habilitado cuando customerName (>=2), customerPhone (>=8), customerEmail (con @) están completos, y NO es móvil.
   - Si es móvil: requiere además customerAddress (>=5).
   - Usar el componente aislado (no HTTP real — mock del ApiService).

2. **Regresión del bug**: que al setear las señales `customerName.set(...)`, `customerPhone.set(...)`, `customerEmail.set(...)`, el `canProceed()` para el paso 'data' cambia de false a true.

3. **Pasos del wizard** (si es factible): que `stepOrder` incluye 'location' solo si hay >1 location, y que el paso 'data' es el último.

4. **Mock del ApiService**: proveer un mock de `ApiService` (getCompany, getServices, getLocations, getAvailability) para no hacer HTTP real. Y mock de ActivatedRoute (slug 'demo').

## 5. Nota importante sobre el setup de tests

- El proyecto usa **Vitest + Angular unit-test builder**. Verificar cómo se declara el test runner en `angular.json` y usar el patrón correcto (puede requerir `@angular/build:unit-test` + setup de TestBed).
- Si TestBed con `provideHttpClient` + mock de `ApiService` es más fácil que mock de ActivatedRoute, usarlo. El objetivo es testear `canProceed` y la reactividad de señales, no la integración HTTP.
- El componente usa `FormsModule` y `CommonModule`. Proveerlos en el TestBed.

## 6. Comandos

```bash
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend test -- --run  # o el comando correcto de vitest
# y asegurar build:
cd /Users/rogelio/Documents/Bookly && pnpm --filter frontend build
```

> Si `pnpm --filter frontend test` no existe o falla, documentar el comando real de test del proyecto y usarlo.

## 7. Archivos PERMITIDOS

- `frontend/src/app/features/booking/booking.component.spec.ts` (nuevo)
- (solo si es imprescindible para el setup) `frontend/angular.json` o `frontend/src/test-setup.ts` o similar — solo si no hay setup de vitest.

**NO tocar**: workers/, packages/contracts/, backend, otros components, booking.component.ts (a menos que el test revele un bug real, entonces marcar el hallazgo sin fixearlo).

## 8. NO hacer

- NO modificar la lógica de `booking.component.ts` (solo testear).
- NO tocar backend.
- NO deployar. NO commitear (dejar en working tree, branch develop).
- Be efficient; do NOT stall.

## 9. Resultado esperado

Reportar: archivo de test creado, qué casos cubre, cómo correrlo, resultado (PASS/FAIL count), y si el test reveló algún bug adicional. Guardar descubrimientos en Engram project 'bookly'.
