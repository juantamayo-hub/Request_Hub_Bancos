/**
 * People Hub — Setup: creates sheets, headers, and (optional) triggers.
 * Run once from the editor or a menu.
 */

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    if (!ui) return;
    ui.createMenu('People Hub')
      .addItem('Sync Form Responses', 'menuProcessFormResponses')
      .addItem('Set Up Sync Trigger (Every 5 min)', 'setupFormSyncTrigger')
      .addToUi();
  } catch (e) {
    Logger.log('onOpen: ' + (e.message || e));
  }
}

function menuProcessFormResponses() {
  var result = processFormResponses();
  var msg = 'Processed: ' + result.processed + ' rows.';
  if (result.errors && result.errors.length > 0) {
    msg += '\nErrors: ' + result.errors.join('; ');
  }
  try {
    SpreadsheetApp.getUi().alert('Form Sync Result', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(msg);
  }
}

function setup() {
  var ss = getSpreadsheet();
  ensureSheetWithHeaders(ss, CONFIG.SHEET_TICKETS, [
    'ticketId', 'createdAt', 'createdByEmail', 'requesterName', 'category', 'subcategory',
    'subject', 'description', 'priority', 'status', 'ownerEmail', 'slaTarget', 'lastUpdatedAt', 'tags', 'attachmentIds'
  ]);
  ensureSheetWithHeaders(ss, CONFIG.SHEET_TICKET_EVENTS, [
    'eventId', 'ticketId', 'timestamp', 'actorEmail', 'action', 'fromValue', 'toValue', 'comment', 'metadata'
  ]);
  ensureSheetWithHeaders(ss, CONFIG.SHEET_USERS, ['email', 'role', 'displayName']);
  ensureSheetWithHeaders(ss, CONFIG.SHEET_CONFIG_OWNERS, ['Category', 'OwnerEmail']);
  Logger.log('Setup completed. Sheets created/verified: Tickets, TicketEvents, Users, ConfigOwners.');
}

/**
 * Creates the sheet if it doesn't exist and defines the header row.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} sheetName
 * @param {string[]} headers
 */
function ensureSheetWithHeaders(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
}
