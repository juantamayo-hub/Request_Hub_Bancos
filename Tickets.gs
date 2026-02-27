/**
 * People Hub — Ticket CRUD and queries.
 */

/**
 * Generates the next ticketId (format PH-YYYY-NNNN).
 * @returns {string}
 */
function generateTicketId() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) {
    var year = new Date().getFullYear();
    return CONFIG.TICKET_ID_PREFIX + '-' + year + '-0001';
  }
  var lastId = sheet.getRange(sheet.getLastRow(), 1).getValue();
  var match = String(lastId).match(/^(.+-)(\d+)$/);
  if (!match) {
    var year = new Date().getFullYear();
    return CONFIG.TICKET_ID_PREFIX + '-' + year + '-0001';
  }
  var next = parseInt(match[2], 10) + 1;
  return match[1] + ('0000' + next).slice(-4);
}

/**
 * Creates a ticket and persists it in Sheet. Registers "created" event in TicketEvents.
 * @param {Object} input - { requesterName, category, subcategory, subject, description, priority, tags, ownerEmail }
 * @param {string} createdByEmail
 * @returns {{ success: boolean, ticketId?: string, error?: string }}
 */
function createTicket(input, createdByEmail) {
  if (!input || !createdByEmail) {
    return { success: false, error: 'Missing ticket or user data.' };
  }
  var subject = (input.subject || '').toString().trim();
  var description = (input.description || '').toString().trim();
  if (!subject) return { success: false, error: 'Subject is mandatory.' };

  var category = (input.category && CONFIG.CATEGORIES.indexOf(input.category) !== -1)
    ? input.category : CONFIG.CATEGORIES[0];
  var now = new Date().toISOString();
  var ticketId = generateTicketId();
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet) return { success: false, error: 'Tickets sheet does not exist. Run setup().' };

  var priority = (input.priority && CONFIG.PRIORITIES.indexOf(input.priority) !== -1)
    ? input.priority : 'Medium';
  var row = [
    ticketId,
    now,
    createdByEmail,
    (input.requesterName || '').toString().trim() || createdByEmail,
    category,
    input.subcategory || '',
    subject,
    description,
    priority,
    'New',
    input.ownerEmail || '',
    '',
    now,
    input.tags || '',
    ''
  ];
  sheet.appendRow(row);
  logTicketEvent(ticketId, createdByEmail, 'created', '', '', 'Ticket created');
  return { success: true, ticketId: ticketId };
}

/**
 * Adds a row to the audit log (TicketEvents).
 * @param {string} ticketId
 * @param {string} actorEmail
 * @param {string} action - created | status_changed | assigned | priority_changed | comment_internal | comment_employee
 * @param {string} fromValue
 * @param {string} toValue
 * @param {string} comment
 */
function logTicketEvent(ticketId, actorEmail, action, fromValue, toValue, comment) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKET_EVENTS);
  if (!sheet) return;
  var eventId = 'evt-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 9);
  var row = [eventId, ticketId, new Date().toISOString(), actorEmail, action, fromValue || '', toValue || '', comment || '', ''];
  sheet.appendRow(row);
}

/**
 * Returns the 1-based row index of the ticket in the Tickets sheet, or 0 if not found.
 * @param {string} ticketId
 * @returns {number}
 */
function getTicketRowIndex(ticketId) {
  if (!ticketId) return 0;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var colA = sheet.getRange(2, 1, sheet.getLastRow(), 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]) === ticketId) return i + 2;
  }
  return 0;
}

/**
 * Updates ticket status and logs the event.
 * @param {string} ticketId
 * @param {string} newStatus
 * @param {string} actorEmail
 * @returns {{ success: boolean, error?: string }}
 */
function updateTicketStatus(ticketId, newStatus, actorEmail) {
  if (CONFIG.STATUSES.indexOf(newStatus) === -1) return { success: false, error: 'Invalid status.' };
  var row = getTicketRowIndex(ticketId);
  if (row === 0) return { success: false, error: 'Ticket not found.' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  var oldStatus = sheet.getRange(row, 10).getValue();
  var subject = sheet.getRange(row, 7).getValue();
  sheet.getRange(row, 10).setValue(newStatus);
  sheet.getRange(row, 13).setValue(new Date().toISOString());
  logTicketEvent(ticketId, actorEmail, 'status_changed', oldStatus, newStatus, '');
  // Slack notification
  try {
    notifySlackStatusChange(ticketId, subject, oldStatus, newStatus, actorEmail);
  } catch (e) {
    Logger.log('Slack notification error: ' + e.message);
  }
  return { success: true };
}

/**
 * Updates ticket priority and logs the event.
 * @param {string} ticketId
 * @param {string} newPriority
 * @param {string} actorEmail
 * @returns {{ success: boolean, error?: string }}
 */
function updateTicketPriority(ticketId, newPriority, actorEmail) {
  if (CONFIG.PRIORITIES.indexOf(newPriority) === -1) return { success: false, error: 'Invalid priority.' };
  var row = getTicketRowIndex(ticketId);
  if (row === 0) return { success: false, error: 'Ticket not found.' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  var oldPriority = sheet.getRange(row, 9).getValue();
  sheet.getRange(row, 9).setValue(newPriority);
  sheet.getRange(row, 13).setValue(new Date().toISOString());
  logTicketEvent(ticketId, actorEmail, 'priority_changed', oldPriority, newPriority, '');
  return { success: true };
}

/**
 * Assigns owner to a ticket and logs the event.
 * @param {string} ticketId
 * @param {string} ownerEmail
 * @param {string} actorEmail
 * @returns {{ success: boolean, error?: string }}
 */
function setTicketOwner(ticketId, ownerEmail, actorEmail) {
  var row = getTicketRowIndex(ticketId);
  if (row === 0) return { success: false, error: 'Ticket not found.' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  var oldOwner = sheet.getRange(row, 11).getValue();
  var subject = sheet.getRange(row, 7).getValue();
  sheet.getRange(row, 11).setValue(ownerEmail || '');
  sheet.getRange(row, 13).setValue(new Date().toISOString());
  logTicketEvent(ticketId, actorEmail, 'assigned', oldOwner || '', ownerEmail || '', '');
  // Slack notification
  if (ownerEmail) {
    try {
      notifySlackAssignment(ticketId, subject, ownerEmail, actorEmail);
    } catch (e) {
      Logger.log('Slack notification error: ' + e.message);
    }
  }
  return { success: true };
}

/**
 * Adds a comment (internal or public) and logs it in TicketEvents.
 * @param {string} ticketId
 * @param {string} comment
 * @param {string} visibility - 'internal' | 'employee'
 * @param {string} actorEmail
 * @returns {{ success: boolean, error?: string }}
 */
function addTicketComment(ticketId, comment, visibility, actorEmail) {
  if (!comment || !comment.trim()) return { success: false, error: 'Comment is empty.' };
  if (visibility !== 'internal' && visibility !== 'employee') return { success: false, error: 'Invalid visibility.' };
  var row = getTicketRowIndex(ticketId);
  if (row === 0) return { success: false, error: 'Ticket not found.' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  sheet.getRange(row, 13).setValue(new Date().toISOString());
  var action = visibility === 'internal' ? 'comment_internal' : 'comment_employee';
  logTicketEvent(ticketId, actorEmail, action, '', '', comment.trim());
  return { success: true };
}

/**
 * Gets historical events for a ticket, sorted descending by date.
 * @param {string} ticketId
 * @returns {Array.<Object>}
 */
function getTicketEvents(ticketId) {
  if (!ticketId) return [];
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKET_EVENTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === ticketId) {
      list.push({
        eventId: data[i][0],
        ticketId: data[i][1],
        timestamp: data[i][2],
        actorEmail: data[i][3],
        action: data[i][4],
        fromValue: data[i][5],
        toValue: data[i][6],
        comment: data[i][7],
        metadata: data[i][8]
      });
    }
  }
  list.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  return list;
}

/**
 * Lists all tickets (backoffice) with optional filters.
 * @param {{ status?: string, category?: string }} filters
 * @returns {Array.<Object>}
 */
function getTicketsAll(filters) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var list = [];
  var statusFilter = (filters && filters.status) ? String(filters.status).trim() : '';
  var categoryFilter = (filters && filters.category) ? String(filters.category).trim() : '';
  for (var i = 1; i < data.length; i++) {
    if (statusFilter && String(data[i][9]) !== statusFilter) continue;
    if (categoryFilter && String(data[i][4]) !== categoryFilter) continue;
    list.push(rowToTicketObject(headers, data[i]));
  }
  list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return list;
}

/**
 * Gets tickets created by specific email.
 * @param {string} email
 * @returns {Array.<Object>}
 */
function getTicketsByRequester(email) {
  if (!email) return [];
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === email.toLowerCase()) {
      list.push(rowToTicketObject(headers, data[i]));
    }
  }
  list.sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return list;
}

/**
 * Converts Sheet row to ticket object.
 */
function rowToTicketObject(headers, row) {
  return {
    ticketId: row[0],
    createdAt: row[1],
    createdByEmail: row[2],
    requesterName: row[3],
    category: row[4],
    subcategory: row[5],
    subject: row[6],
    description: row[7],
    priority: row[8],
    status: row[9],
    ownerEmail: row[10],
    slaTarget: row[11],
    lastUpdatedAt: row[12],
    tags: row[13],
    attachmentIds: row[14]
  };
}

/**
 * Gets ticket by ID.
 * @param {string} ticketId
 * @returns {Object|null}
 */
function getTicketById(ticketId) {
  if (!ticketId) return null;
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === ticketId) {
      return rowToTicketObject(headers, data[i]);
    }
  }
  return null;
}
