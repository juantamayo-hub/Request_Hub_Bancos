/**
 * People Hub — Punto de entrada Web App.
 * doGet está en Ui.gs; aquí se exponen funciones para google.script.run desde el frontend.
 */

// Exponer para el cliente: crear ticket (con auth en servidor)
function createTicketFromForm(input) {
  var auth = requireDomain();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  var result = createTicket(input, auth.email);
  if (result.success) {
    var cat = (input.category && CONFIG.CATEGORIES.indexOf(input.category) !== -1) ? input.category : CONFIG.CATEGORIES[0];
    notifyTicketCreated(auth.email, result.ticketId, input.subject, cat);
  }
  return result;
}

// Exponer para el cliente: listar mis tickets
function getMyTickets() {
  var auth = requireDomain();
  if (!auth.ok) return [];
  return getTicketsByRequester(auth.email);
}

// ——— Backoffice (solo People Admin o creador para detalle) ———

function getAllTickets(filters) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return [];
  
  // Ensure structure and sync data
  try {
    setup(); 
    processFormResponses();
  } catch(e) {
    Logger.log('Sync/Setup error: ' + e.message);
  }
  
  return getTicketsAll(filters || {});
}

function getTicketDetail(ticketId) {
  var auth = requireDomain();
  if (!auth.ok) return null;
  var ticket = getTicketById(ticketId);
  if (!ticket) return null;
  if (auth.role === 'people_admin') return ticket;
  if (ticket.createdByEmail && ticket.createdByEmail.toLowerCase() === auth.email.toLowerCase()) return ticket;
  return null;
}

function getTicketEventsForDetail(ticketId) {
  var auth = requireDomain();
  if (!auth.ok) return [];
  var ticket = getTicketById(ticketId);
  if (!ticket) return [];
  if (auth.role === 'people_admin') return getTicketEvents(ticketId);
  if (ticket.createdByEmail && ticket.createdByEmail.toLowerCase() === auth.email.toLowerCase()) {
    return getTicketEvents(ticketId).filter(function (ev) {
      return ev.action !== 'comment_internal';
    });
  }
  return [];
}

function updateTicketStatusFromUi(ticketId, newStatus) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return updateTicketStatus(ticketId, newStatus, auth.email);
}

function assignTicketOwnerFromUi(ticketId, ownerEmail) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return setTicketOwner(ticketId, ownerEmail, auth.email);
}

function updateTicketPriorityFromUi(ticketId, newPriority) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return updateTicketPriority(ticketId, newPriority, auth.email);
}

function addTicketCommentFromUi(ticketId, comment, visibility) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return addTicketComment(ticketId, comment, visibility, auth.email);
}

function getPeopleAdminsForUi() {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return [];
  return getPeopleAdmins();
}

function getCategoriesForUi() {
  var auth = requireDomain();
  if (!auth.ok) return [];
  return CONFIG.CATEGORIES;
}

// ——— Dashboard & Search ———

function getDashboardMetrics() {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return null;
  
  // Ensure structure and sync data
  try {
    setup();
    processFormResponses();
  } catch(e) {
    Logger.log('Sync/Setup error: ' + e.message);
  }
  
  return computeDashboardMetrics();
}

function searchTicketsFromUi(query) {
  var auth = requireDomain();
  if (!auth.ok) return [];
  return searchTickets(query, auth.role, auth.email);
}

// ——— User Management (Admin only) ———

function getAllUsersFromUi() {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return [];
  return getAllUsers();
}

function saveUserFromUi(email, role, firstName, lastName) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return saveUser(email, role, firstName, lastName);
}

function deleteUserFromUi(email) {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return { success: false, error: auth.error || 'No autorizado.' };
  return deleteUser(email);
}

function getUserInfoFromUi(email) {
  var auth = requireDomain();
  if (!auth.ok) return null;
  // Anyone can get their own info; admins can get any user's info
  if (auth.role === 'people_admin' || auth.email.toLowerCase() === email.toLowerCase()) {
    return getUserInfo(email);
  }
  return null;
}
