# People Hub — Modelo de datos (Sheets)

## 1. Hoja: Tickets

| Columna (A→) | Campo           | Tipo   | Descripción |
|--------------|-----------------|--------|-------------|
| A            | ticketId        | string | ID único (ej. PH-2025-0001) |
| B            | createdAt       | string | ISO timestamp |
| C            | createdByEmail  | string | Email del creador |
| D            | requesterName   | string | Nombre mostrado |
| E            | category        | string | Categoría (ej. Parking) |
| F            | subcategory     | string | Opcional |
| G            | subject         | string | Asunto |
| H            | description     | string | Descripción |
| I            | priority        | string | Low / Medium / High |
| J            | status          | string | New / In Progress / Waiting on Employee / Resolved / Closed |
| K            | ownerEmail      | string | People owner (vacío al crear) |
| L            | slaTarget       | string | Fecha objetivo (opcional) |
| M            | lastUpdatedAt   | string | ISO timestamp |
| N            | tags            | string | Separado por comas (opcional) |
| O            | attachmentIds   | string | IDs Drive separados por coma (v2) |

Headers en fila 1; datos desde fila 2.

## 2. Hoja: TicketEvents (audit log)

| Columna | Campo     | Tipo   | Descripción |
|---------|-----------|--------|-------------|
| A       | eventId   | string | UUID o único |
| B       | ticketId  | string | Referencia al ticket |
| C       | timestamp | string | ISO |
| D       | actorEmail| string | Quién hizo el cambio |
| E       | action    | string | created / status_changed / assigned / comment_internal / comment_employee |
| F       | fromValue | string | Valor anterior (ej. status) |
| G       | toValue   | string | Valor nuevo |
| H       | comment   | string | Comentario si aplica |
| I       | metadata  | string | JSON opcional |

## 3. Hoja: Users (roles)

| Columna | Campo      | Tipo   | Descripción |
|---------|------------|--------|-------------|
| A       | email      | string | Email del usuario |
| B       | role       | string | employee / people_admin |
| C       | displayName| string | Nombre para mostrar |

Solo se listan usuarios que requieran rol explícito (ej. admins). El resto del dominio = employee.

## 4. Config (opcional)

Una hoja "Config" o Script Properties para:

- `ALLOWED_DOMAIN`: dominio de la empresa (ej. `empresa.com`)
- `SPREADSHEET_ID`: ID del libro de tickets (si es distinto al vinculado por defecto)
- `SLACK_WEBHOOK_URL`: URL del Incoming Webhook
- `PEOPLE_TEAM_EMAIL`: email o lista para notificaciones internas
