# People Hub — Manual de operación

## Configuración inicial

1. **Dominio:** En `Config.gs` define `ALLOWED_DOMAIN` con el dominio de tu empresa (ej. `empresa.com`).
2. **Spreadsheet:** Si la Web App y el libro de datos son el mismo, deja `SPREADSHEET_ID` vacío. Si usas un libro aparte, pega su ID.
3. **Setup:** En el editor de Apps Script, ejecuta la función `setup()` una vez (Run → seleccionar `setup`). Esto crea las hojas Tickets, TicketEvents y Users con sus cabeceras.
4. **Admins:** En la hoja **Users** añade filas con `email`, `role` = `people_admin`, `displayName`. El resto del dominio serán `employee`.

## Notificaciones

- **Email:** Se envía con `GmailApp` (cuenta que despliega la app). Asegura que esa cuenta pueda enviar correo.
- **Slack:** Opcional. Pon en `Config.gs` la URL del Incoming Webhook en `SLACK_WEBHOOK_URL`. Si está vacía, no se envía nada.

## Mantenimiento

- **Logs:** Ver Ejecuciones en el proyecto (Apps Script → Ejecuciones) y registros en Stackdriver si está habilitado.
- **Backup:** El libro de Sheets se puede copiar o exportar periódicamente.
- **Cambios de estado / audit log:** Se implementarán en iteración 2 (TicketEvents).

## Sincronización desde Google Form

Los tickets también se pueden crear desde un Google Form cuyas respuestas van a un Sheet. Ver **docs/FORM-SYNC.md** para configuración (`FORM_RESPONSES_SPREADSHEET_ID`, mapeo de columnas, trigger). Desde el Sheet de People Hub: menú **People Hub → Sincronizar respuestas del Form**.

## Troubleshooting

- "Solo usuarios del dominio X pueden acceder": el usuario no tiene email del dominio configurado en `ALLOWED_DOMAIN`.
- "No se pudo obtener el Spreadsheet": configurar `SPREADSHEET_ID` en Config.gs (obligatorio cuando la app se abre como Web App).
- "No existe la hoja Tickets": ejecutar `setup()` de nuevo.
- Form sync no importa: revisar `FORM_RESPONSES_SPREADSHEET_ID`, nombre de la pestaña y que los nombres de cabecera en `FORM_HEADER_TO_TICKET_FIELD` coincidan con la fila 1 del Sheet de respuestas.
- Emails no llegan: revisar que la cuenta del script tenga permisos de envío y que no esté en spam.
