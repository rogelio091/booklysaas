# Bookly

**Bookly** es un SaaS de agendamiento y gestión de citas de servicios, desarrollado por **GhostlyApps**. Permite a profesionales y negocios (dentistas, psicólogos, médicos, fotógrafos, consultores, salones, spas, academias) publicar un **portal de reservas en línea** y administrar su agenda, servicios, personal y pagos desde un único panel.

- **Producción**: https://bookly.ghostlyapps.dev
- **Portal público de reservas**: https://bookly.ghostlyapps.dev/book/:slug

---

## ✨ Funcionalidades principales

- **Portal público** por empresa (`/book/:slug`): catálogo de servicios con precio y duración, elección de profesional o "Cualquiera disponible", calendario de slots en tiempo real y reserva sin crear cuenta.
- **Confirmación instantánea** en pantalla y por email con archivo `.ics` (Google/Apple Calendar) y enlace directo a WhatsApp (`wa.me`).
- **Panel administrativo** multi-tenant: agenda, servicios, staff, horarios, bloqueos, clientes, facturas y pagos.
- **Motor de disponibilidad (Slot Engine)**: horario laboral − descansos − citas + buffer time − bloqueos = slots libres.
- **Monetización SaaS** por suscripción (Básico / Pro / Enterprise).

---

## 🧰 Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Angular 19 (Standalone, Signals, control flow `@if/@for`, SCSS, Mobile-First) |
| Backend API | Cloudflare Workers + Hono |
| Base de datos | Cloudflare D1 (SQLite) + Drizzle ORM |
| Pagos | Recurrente (Visa/Mastercard, suscripciones y señas) |
| Notificaciones | Resend (emails transaccionales + `.ics` + `wa.me`) |
| Hosting | Cloudflare Pages (frontend) + Cloudflare Workers (API) |

> Consulta [`BOOKLY_TECHNICAL_ARCHITECTURE.md`](./BOOKLY_TECHNICAL_ARCHITECTURE.md) para el detalle arquitectónico completo, el schema Drizzle y el algoritmo del Slot Engine.

---

## 🚀 Inicio rápido

### Prerrequisitos

- Node.js ≥ 20
- pnpm ≥ 9 (o npm)
- Angular CLI ≥ 19 (`npm i -g @angular/cli`)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)
- Cuenta Cloudflare con D1 y Workers habilitados

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/ghostlyapps/bookly.git
cd bookly

# Instalar dependencias del monorepo
pnpm install
```

### Configurar variables de entorno

```bash
# workers
cp workers/.dev.vars.example workers/.dev.vars
```

Rellena en `workers/.dev.vars`:

```env
DATABASE_ID=<d1_database_id>
RESEND_API_KEY=<tu_api_key_resend>
RECURRENTE_API_KEY=<tu_api_key_recurrente>
RECURRENTE_WEBHOOK_SECRET=<secreto_para_firmar_webhooks>
JWT_SECRET=<secreto_jwt>
```

### Base de datos (D1)

```bash
# Crear la base de datos D1 local/remota
wrangler d1 create bookly-db

# Aplicar migraciones Drizzle
cd workers
pnpm db:generate   # genera migraciones SQL desde schema.ts
pnpm db:migrate    # aplica migraciones (local o --remote)
```

### Desarrollo

```bash
# API (Workers + Hono)
cd workers
pnpm dev            # wrangler dev --local

# Frontend (Angular)
cd frontend
pnpm start          # ng serve --proxy-config proxy.conf.json
```

- Frontend: http://localhost:4200
- API: http://localhost:8787

### Build

```bash
# Frontend
cd frontend && pnpm build

# Workers (typecheck + bundle)
cd workers && pnpm build
```

### Deploy

```bash
# Staging
cd workers && wrangler deploy --env staging
cd frontend && pnpm build && wrangler pages deploy dist/frontend --project-name bookly-staging

# Production
cd workers && wrangler deploy --env production
cd frontend && pnpm build && wrangler pages deploy dist/frontend --project-name bookly
```

---

## 📁 Estructura de carpetas

```
bookly/
├── packages/
│   └── contracts/          # Tipos y schemas Zod compartidos FE/BE
├── frontend/               # Angular 19
│   └── src/app/
│       ├── core/           # guards, interceptors, servicios singulares
│       ├── shared/         # componentes/directivas/pipes reutilizables
│       └── features/
│           ├── booking/    # portal público /book/:slug
│           └── admin/      # panel de gestión del tenant
└── workers/                # Hono + Drizzle
    ├── src/
    │   ├── db/             # schema.ts, client.ts, migraciones
    │   ├── middleware/     # auth, tenant, rate-limit
    │   ├── routes/         # public, admin, webhooks
    │   ├── services/       # availability (Slot Engine), booking, billing, notifications
    │   └── utils/          # time, id
    ├── drizzle/            # migraciones SQL generadas
    └── wrangler.toml
```

---

## 💰 Planes

| | Básico | Pro | Enterprise |
|---|---|---|---|
| Precio | **Q149/mes** | **Q299/mes** | **Q599/mes** |
| Staff | 1 | Hasta 5 | Ilimitados |
| Portal público | ✅ | ✅ | ✅ |
| Multi-servicio | — | ✅ | ✅ |
| Pagos / señas | — | ✅ | ✅ |
| Multi-sucursal | — | — | ✅ |
| Soporte | Estándar | Prioritario | VIP |

---

## 🧪 Tests

```bash
# Workers (Vitest)
cd workers && pnpm test

# Frontend (Angular)
cd frontend && pnpm test

# Lint + typecheck en todo el monorepo
pnpm lint
pnpm typecheck
```

---

## 📄 Documentación

- **Arquitectura técnica**: [`BOOKLY_TECHNICAL_ARCHITECTURE.md`](./BOOKLY_TECHNICAL_ARCHITECTURE.md)
- **API**: OpenAPI generado en `https://bookly.ghostlyapps.dev/docs`

---

## 📄 Licencia

Propietario — © GhostlyApps. Todos los derechos reservados.
