/**
 * People Hub — Routes and HTML service for the Web App.
 */

/**
 * Serves the page based on the path (query parameter "page" or pathInfo).
 * doGet receives: e.parameter.page, e.pathInfo
 */
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var pathInfo = (e && e.pathInfo) ? e.pathInfo : '';
  var page = params.page || pathInfo.replace(/^\//, '') || 'index';

  var auth = requireDomain();
  if (!auth.ok) {
    return serveHtml('Error', '<div class="error">' + (auth.error || 'Access denied') + '</div>');
  }

  if (page === 'index' || page === '') {
    return serveHome(auth);
  }
  if (page === 'crear-ticket') {
    return serveCrearTicket(auth);
  }
  if (page === 'mis-tickets') {
    return serveMisTickets(auth);
  }
  if (page === 'admin' || page === 'admin/tickets') {
    var adminAuth = requirePeopleAdmin();
    if (!adminAuth.ok) {
      return serveHtml('Access denied', '<div class="error">' + (adminAuth.error || '') + '</div>');
    }
    return serveAdminTickets(adminAuth);
  }
  if (page === 'detail') {
    var id = params.id || '';
    if (!id) return serveHome(auth);
    return serveTicketDetail(auth, id);
  }
  if (page === 'users') {
    var adminAuth = requirePeopleAdmin();
    if (!adminAuth.ok) {
      return serveHtml('Access denied', '<div class="error">' + (adminAuth.error || '') + '</div>');
    }
    return serveUserManagement(adminAuth);
  }

  return serveHome(auth);
}

/**
 * Complete HTML response with title and body.
 */
function serveHtml(title, body) {
  var t = HtmlService.createTemplateFromFile('index');
  t.title = title;
  t.body = body;
  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle(title);
}

/**
 * Centralized rendering using the Layout pattern.
 */
function serveLayout(pageName, title, pageData) {
  const auth = requireDomain(); // Assuming checkAuth() is defined elsewhere and returns { access: boolean, role: string, email: string }
  if (!auth.ok) return serveLoginBypass(auth); // Assuming serveLoginBypass is defined elsewhere

  // 1. Get the requested page fragment
  const fragment = HtmlService.createTemplateFromFile(pageName);
  
  // Pass page-specific data to the fragment
  if (pageData) {
    Object.keys(pageData).forEach(key => fragment[key] = pageData[key]);
  }
  
  // Common variables for the fragment
  fragment.appUrl = getAppUrl();
  fragment.userRole = auth.role;

  // 2. Get the main Layout
  const layout = HtmlService.createTemplateFromFile('Layout');
  layout.title = title;
  
  // Render the body
  try {
    layout.body = fragment.evaluate().getContent();
  } catch (e) {
    layout.body = '<div class="card" style="padding: 40px; text-align: center;">' +
                  '<h2 style="color: var(--error-red);">Rendering Error</h2>' +
                  '<p>' + e.message + '</p>' +
                  '</div>';
  }
  
  layout.appUrl = getAppUrl();
  layout.userRole = auth.role;
  
  // Enriched user name
  const userInfo = getUserInfo(auth.email);
  layout.userName = userInfo && userInfo.firstName ? userInfo.firstName : auth.email.split('@')[0];
  layout.currentPage = pageName === 'Home' ? 'home' : (pageName === 'AdminTickets' ? 'admin' : (pageName === 'MisTickets' ? 'mis-tickets' : (pageName === 'UserManagement' ? 'users' : '')));

  return layout.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle(title + " | People Hub");
}

function serveHome(auth) {
  return serveLayout('Home', 'Home', {
    rawDataUrl: CONFIG.RAW_DATA_SHEET_URL || ''
  });
}

function serveCrearTicket(auth) {
  return serveLayout('CrearTicket', 'Create Ticket', {
    categories: CONFIG.CATEGORIES
  });
}

function serveMisTickets(auth) {
  return serveLayout('MisTickets', 'My Tickets');
}

function serveAdminTickets(auth) {
  return serveLayout('AdminTickets', 'Admin Dashboard', {
    statuses: CONFIG.STATUSES,
    categories: CONFIG.CATEGORIES,
    rawDataUrl: CONFIG.RAW_DATA_SHEET_URL || ''
  });
}

function serveTicketDetail(auth, ticketId) {
  var ticket = getTicketById(ticketId);
  if (!ticket) {
    return serveHtml('Ticket not found', '<div class="error">Ticket not found.</div><p><a href="' + getAppUrl() + '">Home</a></p>');
  }
  const canEdit = (auth.role === 'people_admin');
  var isRequester = ticket.createdByEmail && ticket.createdByEmail.toLowerCase() === auth.email.toLowerCase();
  if (!canEdit && !isRequester) {
    return serveHtml('Access denied', '<div class="error">You do not have permission to view this ticket.</div><p><a href="' + getAppUrl() + '">Home</a></p>');
  }

  return serveLayout('TicketDetail', 'Ticket ' + ticketId, {
    ticketId: ticketId,
    canEdit: canEdit,
    statusesJson: JSON.stringify(CONFIG.STATUSES),
    prioritiesJson: JSON.stringify(CONFIG.PRIORITIES)
  });
}

function getAppUrl() {
  return ScriptApp.getService().getUrl();
}

function escapeHtml(text) {
  if (!text) return '';
  var div = { text: text };
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function serveUserManagement(auth) {
  var t = HtmlService.createTemplateFromFile('UserManagement');
  t.appUrl = getAppUrl();
  return t.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle('User Management - People Hub');
}

/**
 * Include HTML fragments (CSS/JS) in templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
