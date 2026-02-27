/**
 * People Hub — Centralized Configuration
 * Replace placeholders with actual values (or use Script Properties in production).
 */

var CONFIG = {
  // Allowed domain (only @this-domain users can use the app)
  ALLOWED_DOMAIN: 'huspy.io',

  // Spreadsheet ID acting as DB. MANDATORY when app is deployed as Web App
  // (no "active spreadsheet" in that context). Copy the ID from the Sheet URL: .../d/THIS_ID/edit
  SPREADSHEET_ID: '1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY',

  // Slack: Incoming Webhook URL (placeholder)
  SLACK_WEBHOOK_URL: '',

  // Email for internal notification copies (People Team)
  PEOPLE_TEAM_EMAIL: 'juan.tamayo@huspy.io',

  // Default admins (statically defined; merged with Users sheet)
  ADMIN_EMAILS: ['juan.tamayo@huspy.io'],

  // Sheet names
  SHEET_TICKETS: 'Tickets',
  SHEET_TICKET_EVENTS: 'TicketEvents',
  SHEET_USERS: 'Users',
  SHEET_CONFIG_OWNERS: 'ConfigOwners',

  // Ticket ID prefix
  TICKET_ID_PREFIX: 'HSPY',

  // Available categories
  CATEGORIES: ['Parking', 'IT', 'General', 'Facilities', 'HR'],

  // Ticket statuses
  STATUSES: ['New', 'In Progress', 'Waiting on Employee', 'Resolved', 'Closed'],

  // Priorities
  PRIORITIES: ['Low', 'Medium', 'High'],

  // ——— Slack Integration (Web API with Bot Token) ———
  // Channel ID for notifications
  SLACK_CHANNEL_ID: 'C0AG3U25RK2',
  // Bot Token is stored in Script Properties: SLACK_BOT_TOKEN

  // ——— External Links ———
  // Google Form to create tickets (Phase 1)
  GOOGLE_FORM_URL: 'https://docs.google.com/forms/d/1m2fsyrKjpipm_BYFkSNOANpOIamaXp0SPmeU2e5GitQ/edit',
  // Raw data Sheet URL (admin only)
  RAW_DATA_SHEET_URL: 'https://docs.google.com/spreadsheets/d/1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY/edit',

  // ——— Google Form Synchronization ———
  // Sheet where the Form saves responses (might be different from People Hub SPREADSHEET_ID)
  FORM_RESPONSES_SPREADSHEET_ID: '1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY',
  // Response sheet tab name (confirmed: "Form Responses 1")
  FORM_RESPONSES_SHEET_NAME: 'Form Responses 1',
  
  // ——— Notifications Configuration ———
  ENABLE_NOTIFICATIONS: false, // Set to true to enable Slack and Email notifications
  
  // Header of the column where we write the created ticket ID (to avoid re-importing)
  FORM_SYNCED_COLUMN_HEADER: 'People Hub Ticket ID',
  // Email to use as createdByEmail when Form doesn't ask for email
  FORM_DEFAULT_CREATOR_EMAIL: 'people-team@huspy.io',
  // Mapping: exact header name in Form (row 1) → ticket field
  FORM_HEADER_TO_TICKET_FIELD: {
    'Timestamp': 'timestamp',
    'Email Address': 'email',
    'Huspy Email': 'email',
    'Your huspy email': 'email',
    'What kind of support do you need?': 'category',
    'How can we help you?': 'description',
    'What\'s the urgency?': 'priority',
    // Subject: derived from category in FormSync when missing
    'Subject': 'subject',
    'Asunto': 'subject'
  }
};

/**
 * Gets the Spreadsheet (by ID or active sheet).
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.toString().trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID.toString().trim());
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss === null) {
    throw new Error(
      'People Hub: Could not get Spreadsheet. When running as Web App, you must set SPREADSHEET_ID in Config.gs.'
    );
  }
  return ss;
}
