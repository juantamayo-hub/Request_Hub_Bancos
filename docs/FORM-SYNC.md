# People Hub — Sincronización desde Google Form

Los tickets se pueden crear desde la **Web App** (People Hub) o desde un **Google Form** cuyas respuestas se vuelcan en un Sheet. Este documento describe cómo configurar la importación desde el Form.

## Flujo

1. El usuario rellena el Google Form.
2. Las respuestas se guardan en un Google Sheet (el que configuras en `FORM_RESPONSES_SPREADSHEET_ID`).
3. People Hub lee ese Sheet, crea un ticket por cada fila **aún no sincronizada** y escribe el ID del ticket en una columna (p. ej. "People Hub Ticket ID") para no volver a importar la misma fila.
4. La sincronización se puede ejecutar **manualmente** (menú del Sheet o función `processFormResponses`) o **cada 5 minutos** con un trigger.

## Configuración (Config.gs)

| Variable | Descripción |
|----------|-------------|
| `FORM_RESPONSES_SPREADSHEET_ID` | ID del Spreadsheet donde el Form guarda las respuestas (URL: `.../d/ESTE_ID/edit`). |
| `FORM_RESPONSES_SHEET_NAME` | Nombre de la pestaña de respuestas (ej. `Form Responses 1`). Si no existe, se usa la primera hoja. |
| `FORM_SYNCED_COLUMN_HEADER` | Cabecera de la columna donde se escribe el ID del ticket creado. Si no existe, se añade. |
| `FORM_DEFAULT_CREATOR_EMAIL` | Email usado como creador del ticket cuando el Form no pregunta por email. |
| `FORM_HEADER_TO_TICKET_FIELD` | Mapeo **nombre de la cabecera en el Form** → **campo del ticket**. |

## Mapeo de columnas

La **primera fila** del Sheet de respuestas debe tener las cabeceras (preguntas del Form). En `FORM_HEADER_TO_TICKET_FIELD` se indica qué cabecera corresponde a cada campo del ticket.

Campos del ticket que puedes mapear:

- `email` → usado como `createdByEmail` (si no está, se usa `FORM_DEFAULT_CREATOR_EMAIL`).
- `requesterName` → nombre del solicitante.
- `category` → debe coincidir con una de `CONFIG.CATEGORIES` (ej. Parking, IT).
- `subject` → asunto (obligatorio; si falta se usa "(Sin asunto)").
- `description` → descripción.
- `priority` → Low / Medium / High.
- `subcategory` → opcional.
- `timestamp` → no se escribe en el ticket; sirve de referencia.

Ejemplo: si en tu Form la pregunta "Correo electrónico" genera la cabecera "Correo electrónico", añade en el mapeo:

```javascript
'Correo electrónico': 'email',
```

Los nombres deben coincidir **exactamente** con la fila 1 del Sheet de respuestas (incluidas mayúsculas y acentos).

## Cómo ver los nombres de las columnas

1. Abre el Sheet de respuestas del Form:  
   https://docs.google.com/spreadsheets/d/1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY/edit
2. La **fila 1** son las cabeceras (títulos de las preguntas).
3. Copia esos nombres tal cual en `FORM_HEADER_TO_TICKET_FIELD` en Config.gs.

## Ejecutar la sincronización

- **Desde el Sheet de People Hub:** menú **People Hub → Sincronizar respuestas del Form**.
- **Desde el editor de Apps Script:** ejecutar la función `processFormResponses`.
- **Automático:** menú **People Hub → Configurar trigger Form (cada 5 min)** (crea un trigger que ejecuta `processFormResponses` cada 5 minutos).

## Permisos

La primera vez que se ejecute `processFormResponses`, Google pedirá autorización para acceder al **Spreadsheet de respuestas del Form** (puede ser otro libro distinto al de People Hub). Hay que aceptar para que la sincronización funcione.

## Resumen de IDs

- **Form:** `1m2fsyrKjpipm_BYFkSNOANpOIamaXp0SPmeU2e5GitQ`
- **Sheet de respuestas del Form:** `1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY`
- El **Sheet de People Hub** (Tickets, TicketEvents, Users) es el definido en `SPREADSHEET_ID` en Config.gs.
