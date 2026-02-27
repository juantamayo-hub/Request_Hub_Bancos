/**
 * People Hub — Synchronization from Google Form.
 * Reads responses from the Form-linked Sheet, creates tickets in People Hub, and marks synchronized rows.
 */

/**
 * Opens the Form responses Spreadsheet.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function getFormResponsesSpreadsheet() {
  var id = CONFIG.FORM_RESPONSES_SPREADSHEET_ID;
  if (!id || id.toString().trim() === '') return null;
  try {
    return SpreadsheetApp.openById(id.toString().trim());
  } catch (e) {
    Logger.log('FormSync getFormResponsesSpreadsheet error: ' + (e.message || e));
    return null;
  }
}

/**
 * Gets Category -> Owner Email mapping from ConfigOwners sheet.
 * @returns {Object}
 */
function getCategoryOwnersMap() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_CONFIG_OWNERS);
  var mapping = {};
  if (!sheet || sheet.getLastRow() < 2) return mapping;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    var cat = String(data[i][0]).trim();
    var email = String(data[i][1]).trim();
    if (cat && email) {
      mapping[cat] = email;
    }
  }
  return mapping;
}

/**
 * Gets the Form response sheet and headers.
 * @returns {{ sheet: GoogleAppsScript.Spreadsheet.Sheet, headers: string[], headerToCol: Object }|null}
 */
function getFormResponseSheetAndHeaders() {
  var ss = getFormResponsesSpreadsheet();
  if (!ss) return null;
  var sheetName = (CONFIG.FORM_RESPONSES_SHEET_NAME || 'Form Responses 1').toString().trim();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  if (!sheet || sheet.getLastRow() < 1) return null;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var headerToCol = {};
  for (var c = 0; c < headers.length; c++) {
    headerToCol[headers[c]] = c + 1;
  }
  return { sheet: sheet, headers: headers, headerToCol: headerToCol };
}

/**
 * Builds the input object for createTicket and creator email from a Form row.
 * @param {string[]} row - Row values (index 0 = col A)
 * @param {Object} headerToCol - Header -> Column mapping (1-based)
 * @param {string[]} headers - Header names
 * @returns {{ input: Object, createdByEmail: string }}
 */
function formRowToTicketInput(row, headerToCol, headers) {
  var mapping = CONFIG.FORM_HEADER_TO_TICKET_FIELD || {};
  var fieldToValue = {};
  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var field = mapping[header];
    if (field && row[i] !== undefined && row[i] !== null) {
      fieldToValue[field] = String(row[i]).trim();
    }
  }
  var createdByEmail = (fieldToValue.email && fieldToValue.email.indexOf('@') !== -1)
    ? fieldToValue.email
    : (CONFIG.FORM_DEFAULT_CREATOR_EMAIL || CONFIG.PEOPLE_TEAM_EMAIL || '');
  var category = fieldToValue.category || '';
  var subject = fieldToValue.subject || category || '(No subject)';
  var input = {
    requesterName: fieldToValue.requesterName || fieldToValue.email || createdByEmail || 'Form',
    category: category,
    subcategory: fieldToValue.subcategory || '',
    subject: subject,
    description: fieldToValue.description || '',
    priority: fieldToValue.priority || 'Medium',
    tags: 'form'
  };
  return { input: input, createdByEmail: createdByEmail };
}

/**
 * Gets the column index (1-based) for ticket ID, or -1 if column needs to be added.
 */
function getSyncedColumnIndex(sheet, headerToCol, headers) {
  var header = (CONFIG.FORM_SYNCED_COLUMN_HEADER || 'People Hub Ticket ID').toString().trim();
  if (headerToCol[header] !== undefined) return headerToCol[header];
  return -1;
}

/**
 * Processes Form responses: creates a ticket for each unsynced row.
 * @returns {{ processed: number, errors: string[] }}
 */
function processFormResponses() {
  var result = { processed: 0, errors: [] };
  var data = getFormResponseSheetAndHeaders();
  if (!data) {
    result.errors.push('Could not open Form responses sheet. Check FORM_RESPONSES_SPREADSHEET_ID and FORM_RESPONSES_SHEET_NAME in Config.gs');
    return result;
  }
  var sheet = data.sheet;
  var headers = data.headers;
  var headerToCol = data.headerToCol;
  var syncedCol = getSyncedColumnIndex(sheet, headerToCol, headers);
  if (syncedCol === -1) {
    syncedCol = headers.length + 1;
    sheet.getRange(1, syncedCol).setValue(CONFIG.FORM_SYNCED_COLUMN_HEADER || 'People Hub Ticket ID');
    sheet.getRange(1, syncedCol).setFontWeight('bold');
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;
  
  var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var ownersMap = getCategoryOwnersMap();
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var rowNumber = r + 2;
    var existingId = (row[syncedCol - 1] !== undefined && row[syncedCol - 1] !== null)
      ? String(row[syncedCol - 1]).trim() : '';
    if (existingId !== '') continue;
    var parsed = formRowToTicketInput(row, headerToCol, headers);
    if (!parsed.createdByEmail) {
      result.errors.push('Row ' + rowNumber + ': No email found in Form and no FORM_DEFAULT_CREATOR_EMAIL configured.');
      continue;
    }
    // Automatic owner assignment
    if (parsed.input.category && ownersMap[parsed.input.category]) {
      parsed.input.ownerEmail = ownersMap[parsed.input.category];
    }
    var createResult = createTicket(parsed.input, parsed.createdByEmail);
    if (createResult.success) {
      sheet.getRange(rowNumber, syncedCol).setValue(createResult.ticketId);
      result.processed++;
      try {
        notifyTicketCreated(parsed.createdByEmail, createResult.ticketId, parsed.input.subject, parsed.input.category || '');
      } catch (e) {
        Logger.log('FormSync notify error: ' + (e.message || e));
      }
    } else {
      result.errors.push('Row ' + rowNumber + ': ' + (createResult.error || 'Error creating ticket'));
    }
  }
  return result;
}

/**
 * Creates a trigger to run processFormResponses every 5 minutes.
 */
function setupFormSyncTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'processFormResponses') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    ScriptApp.newTrigger('processFormResponses')
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log('Form synchronization trigger created: every 5 minutes.');
  } catch (e) {
    Logger.log('setupFormSyncTrigger error: ' + (e.message || e));
  }
}
