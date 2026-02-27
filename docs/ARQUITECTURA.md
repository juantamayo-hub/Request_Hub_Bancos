# People Hub — Arquitectura MVP

## 1. Confirmación del alcance MVP

| Objetivo | Alcance MVP |
|----------|-------------|
| **Automatización** | Formulario dinámico por categoría, guardado en Sheet, notificaciones (Slack + Email) con placeholders |
| **Calidad** | Validaciones en front y back, UX simple |
| **Tracking** | Ticket con ID único, estados, audit log (modelo definido; implementación completa en iteración 2) |
| **Cobertura** | Múltiples categorías (Parking, IT, General, Facilities, HR); ver Config.CATEGORIES |

## 2. Stack

- **Frontend:** Apps Script **HTML Service** (páginas servidas por `doGet`/`doPost`).
- **Backend:** Apps Script (.gs) → **Google Sheets** (datos), **Drive** (adjuntos en v2).
- **Notificaciones:** `GmailApp`, Slack Incoming Webhook (URL en `Config.gs`).
- **Auth:** Sesión activa de Google; validación de **dominio** y **rol** (Employee / People Admin) vía `Session.getActiveUser().getEmail()` y hoja/sheet de configuración.

## 3. Capas (estructura lógica)

```
┌─────────────────────────────────────────────────────────┐
│  Web App (doGet / doPost)                                │
│  ui.gs → rutas, serve HTML, parámetros                  │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│  Services                                                │
│  auth.gs (dominio, roles)                                │
│  tickets.gs (CRUD, búsquedas)                            │
│  notifications.gs (Slack, Email)                         │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│  Repositories / Persistencia                             │
│  Sheets API (SpreadsheetApp) → Tickets, TicketEvents,    │
│  Users/Roles (o Config sheet)                            │
└─────────────────────────────────────────────────────────┘
```

- **UI:** Solo enrutado y plantillas; no lógica de negocio.
- **Services:** Reglas de negocio, validaciones, orquestación.
- **Sheets:** Acceso a datos; nombres de hojas y columnas centralizados en `Config.gs`.

## 4. Flujo de datos (alto nivel)

1. Usuario abre la Web App → `doGet()` → `auth` verifica dominio (y opcionalmente rol).
2. **Home** → enlaces a "Crear ticket" y "Mis tickets".
3. **Crear ticket** → formulario (1 categoría MVP) → `doPost` o `google.script.run` → `tickets.create()` → Sheet → notificación (stub) → redirección/feedback.
4. **Mis tickets** → `tickets.getByRequester(email)` → lista en tabla (con enlace a detalle).
5. **Admin** (solo People Admin): lista de todos los tickets con filtros (estado, categoría), enlace a detalle.
6. **Detalle ticket** (admin o creador): ver ticket, historial; admin puede cambiar estado, asignar owner, añadir comentarios internos o al empleado. Cambios se registran en TicketEvents.

## 5. Estructura de archivos del proyecto

```
people-hub/
├── appsscript.json          # Manifest (Apps Script)
├── Code.gs                  # Punto de entrada: doGet, doPost
├── Config.gs                # Constantes, IDs, placeholders
├── Setup.gs                 # Crear sheets, headers, triggers
├── Auth.gs                  # Dominio, roles
├── Tickets.gs               # CRUD tickets
├── Notifications.gs         # Slack + Email
├── Ui.gs                    # Rutas y serve de HTML
├── index.html               # Home
├── CrearTicket.html         # Formulario crear ticket
├── MisTickets.html          # Lista "Mis tickets"
├── AdminTickets.html        # Lista backoffice + filtros
├── TicketDetail.html       # Detalle + estado/owner/comentarios/historial
├── docs/
│   ├── ARQUITECTURA.md      # Este documento
│   ├── MODELO-DATOS.md      # Tickets, Events, Users
│   ├── OPERACION.md         # Cómo operar y desplegar
│   └── ROADMAP.md           # MVP → v2
└── DEPLOY.md                # Pasos de despliegue
```

## 6. Decisiones

- **Sheets como BD (MVP):** Sin AppSheet; máximo control y trazabilidad con código propio. Migración a otra BD posible más adelante.
- **Login:** Solo verificación de dominio + rol en backend; no OAuth adicional (usa la sesión de Google del usuario).
- **Idempotencia notificaciones:** Clave por `(ticketId, eventType, timestamp)`; en MVP se puede limitar a “un email por creación” y luego extender.
- **Placeholders:** Dominio, Slack Webhook, ID de Spreadsheet se configuran en `Config.gs` (o Script Properties en producción).

## 7. Seguridad

- Ejecutar la Web App como **“Yo”** (desarrollador) para poder leer/escribir Sheets y enviar correos.
- Comprobar en cada request que `getActiveUser().getEmail()` pertenece al dominio permitido.
- Rutas `/admin/*` solo accesibles si el usuario tiene rol People Admin (lista en Sheet o Config).
