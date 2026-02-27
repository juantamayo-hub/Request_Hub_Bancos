# People Hub — Roadmap

## MVP (Iteración 1) — Actual

- [x] Login por dominio
- [x] Crear ticket (1 categoría hardcoded)
- [x] Guardar en Sheet
- [x] Listar "Mis tickets"
- [x] Estructura de código (config, setup, auth, tickets, ui, notifications stub)
- [ ] Notificaciones: email confirmación + Slack (con placeholders)

## Iteración 2 — Hecho

- [x] Varias categorías en crear ticket (Parking, IT, General, Facilities, HR)
- [x] Backoffice: vista lista tickets + filtros (estado, categoría)
- [x] Detalle ticket: cambiar estado, asignar owner, comentarios internos y al empleado
- [x] Audit log (TicketEvents) al cambiar estado/asignación/comentarios
- [ ] Adjuntos opcionales (Drive) — pendiente

## Iteración 3+

- SLA objetivo y alertas
- Encuesta post-cierre
- Idempotencia notificaciones (evitar duplicados)
- Mejoras UX y reportes
