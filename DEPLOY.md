# People Hub — Pasos de despliegue (Google Apps Script)

## Requisitos

- Cuenta Google Workspace (dominio de la empresa).
- Un Google Sheet que hará de “contenedor” del proyecto (o un Sheet dedicado solo a datos; ver Config.gs).

## Opción A: Copiar/pegar en el editor de Apps Script

1. **Crear el libro**
   - Crea un Google Sheet nuevo (ej. "People Hub - Datos").
   - Opcional: en ese mismo Sheet, menú **Extensiones → Apps Script**. Así el script queda vinculado al libro y `SpreadsheetApp.getActiveSpreadsheet()` usará ese libro por defecto.

2. **Abrir el proyecto**
   - Si abriste Apps Script desde el Sheet: ya estás en el proyecto vinculado.
   - Si no: en el editor de Apps Script, **Archivo → Nuevo → Proyecto**; luego **Archivo → Propiedades del proyecto** y en "Ubicación" asocia el Sheet (o deja el script standalone y en `Config.gs` pon el ID del Sheet en `SPREADSHEET_ID`).

3. **Crear los archivos .gs**
   - En el editor, crea un archivo por cada uno de los siguientes y pega el contenido del repo:
     - `Config.gs`
     - `Setup.gs`
     - `Auth.gs`
     - `Tickets.gs`
     - `Notifications.gs`
     - `Ui.gs`
     - `Code.gs`
   - El orden no importa; todos se cargan.

4. **Crear los archivos .html**
   - **Archivo → Nuevo → Archivo HTML**; nombre: `index`, pega el contenido de `index.html`.
   - Repite para `CrearTicket.html` (nombre: `CrearTicket`) y `MisTickets.html` (nombre: `MisTickets`).

5. **Configurar `Config.gs`**
   - Abre `Config.gs` y sustituye:
     - `ALLOWED_DOMAIN`: tu dominio (ej. `miempresa.com`).
     - Opcional: `SPREADSHEET_ID` si usas un Sheet distinto al vinculado.
     - Opcional: `SLACK_WEBHOOK_URL` y `PEOPLE_TEAM_EMAIL`.

6. **Ejecutar setup**
   - En el editor, selecciona la función `setup` en el desplegable y pulsa **Ejecutar**.
   - Autoriza si te lo pide (permisos del Sheet y, si usas envío de email, Gmail).
   - Comprueba que en el Sheet aparecen las hojas **Tickets**, **TicketEvents** y **Users**.

7. **Añadir People Admins**
   - En la hoja **Users** del Sheet, añade al menos una fila:
     - Columna A: email del admin (ej. `tu@miempresa.com`).
     - Columna B: `people_admin`.
     - Columna C: nombre para mostrar.

8. **Desplegar como Web App**
   - **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Descripción: p. ej. "People Hub MVP".
   - **Ejecutar como:** "Yo" (tu cuenta).
   - **Quién tiene acceso:** "Usuarios de [tu dominio]".
   - **Implementar** y copia la URL de la aplicación.

9. **Probar**
   - Abre la URL en el navegador con una cuenta del dominio.
   - Deberías ver la Home con "Crear ticket" y "Mis tickets".
   - Crea un ticket y comprueba que aparece en la hoja Tickets y en "Mis tickets".
   - Comprueba que recibes el email de confirmación (si Gmail está configurado).
   - Con un usuario en la hoja Users como `people_admin`, verifica que aparece el enlace "Admin".

## Opción B: Usar Clasp (línea de comandos)

1. Instala Node y luego: `npm install -g @google/clasp`
2. Inicia sesión: `clasp login`
3. En la carpeta del repo (donde está `appsscript.json`): `clasp create --type sheets` (o `clasp clone <scriptId>` si ya creaste el proyecto).
4. Configura `Config.gs` con tu dominio y opciones.
5. `clasp push`
6. En el editor (abierto con `clasp open`), ejecuta `setup()` y crea la implementación de Web App como en los pasos 6–8 anteriores.

## Checklist de pruebas manuales (MVP)

- [ ] Usuario del dominio puede abrir la Web App y ve la Home.
- [ ] Usuario de otro dominio ve mensaje de error de dominio.
- [ ] "Crear ticket": rellenar asunto y descripción → Enviar → mensaje de éxito y redirección a "Mis tickets".
- [ ] En la hoja Tickets aparece una nueva fila con ticketId, estado New, etc.
- [ ] "Mis tickets" muestra solo los tickets del usuario logueado.
- [ ] Llega email de confirmación al creador (si Gmail está activo).
- [ ] Usuario con rol people_admin ve enlace "Admin" y puede entrar a la página Admin.
- [ ] Usuario sin rol admin no ve "Admin".

## Notas

- La primera vez que un usuario abre la app, Google puede pedir autorización (permiso para ejecutar "como tú").
- Si cambias `Config.gs` (p. ej. dominio o webhook), guarda y crea una **nueva versión** de la implementación (Implementar → Gestionar implementaciones → Editar → Nueva versión) para que los cambios se apliquen.
