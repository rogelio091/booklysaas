# Decisión de Arquitectura: Modelo de Ubicaciones (Lugares de Atención) — V2

> **Contexto:** decisión de producto para Bookly (SaaS de agendamiento). El dueño quiere sentar una buena base desde desarrollo, ya que no hay usuarios reales aún.
> **Idea del dueño:** negocios como "una chica que hace uñas" que atiende **a domicilio** o **en sitio** (recibir clientes en su lugar).
> **Investigación previa (Booksy/Fresha/Setmore/Calendly):** las plataformas de belleza modelan esto con "servicios móviles" separados de los "en sitio", con reglas de disponibilidad distintas (Booksy exige confirmación manual para móviles).
> A someter a **Judgment Day** para afinar y validar.

---

## 1. El problema real (visión del dueño)

No es "sucursales corporativas" (BarberApp). Es **dónde se presta el servicio físicamente**, con matices:

- Una manicurista puede atender **en su local** (recibir) o **a domicilio** (viajar al cliente).
- Un servicio "a domicilio" tiene implicaciones: viaje, radio de cobertura, y la necesidad de que el negocio **confirme** antes de comprometerse (no es un slot fijo en un local).
- El cliente debe poder elegir: "quiero que vengas" vs "voy a tu lugar".

## 2. Modelo propuesto: `locations` como LUGARES DE ATENCIÓN (no sucursales)

### 2.1 Dos tipos de "ubicación"

| Tipo | Semántica | Ejemplo | Booking |
|---|---|---|---|
| **Fija** (`type: 'fixed'`) | Un lugar físico propio donde el negocio recibe | "Consultorio Zona 10" | Slots normales en ese lugar |
| **Móvil** (`type: 'mobile'`) | El negocio viaja al cliente | "A domicilio" (radio 15 km) | **Confirmación manual obligatoria** (Booksy lo valida) |

### 2.2 Relaciones

- `locations`: id, companyId, name, slug, address (opcional para móvil), `type` ('fixed'|'mobile'), `serviceRadiusKm` (para móvil), isActive.
- `serviceLocations` (ya existe): un servicio se presta en 1+ ubicaciones.
- `staffLocations` (falta): staff que atienden en cada ubicación. **Obligatorio para que el Slot Engine sepa qué staff cubre cada lugar.**
- `workingHours` / `blockedSlots`: por `locationId` (ya tienen la columna en schema, pero el pipeline la ignora).

### 2.3 Impacto en el flujo de reserva

```
1. Cliente abre /book/:slug
2. (si el negocio tiene más de un lugar) Elige: "En tu local" / "A domicilio"
3. Elige servicio (cada servicio disponible en el lugar elegido)
4. Elige fecha/hora:
   - Lugar fijo → slots automáticos (Slot Engine)
   - A domicilio → pide dirección + el negocio CONFIRMA manualmente
5. Reserva → pending → confirmada por el negocio
```

## 3. Lo que el código actual NO soporta (confirmado por jueces en V1)

- Slot Engine es **location-unaware** (interfaces sin locationId) → reescritura.
- Falta pivot `staffLocations`.
- Contratos públicos sin locationId.
- Cero CRUD de locations en admin.
- `saasPlans` sin `maxLocations`.

## 4. Preguntas para el juicio (afinar la idea del dueño)

1. ¿Es correcto el modelo de dos tipos (fijo + móvil) para el caso "uñas a domicilio"?
2. ¿La confirmación manual para móvil (como Booksy) es la decisión correcta, o hay mejor alternativa?
3. ¿El radio de cobertura / fee de viaje debería ser parte del v1 o diferido?
4. ¿Debe el "Cualquiera disponible" considerar también la ubicación (primer staff libre en ese lugar)?
5. ¿Qué debe ser v1 vs roadmap para que la base sea sólida sin sobre-construir?
