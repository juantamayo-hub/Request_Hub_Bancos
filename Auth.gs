/**
 * People Hub — Authentication and Authorization by domain and roles.
 */

/**
 * Checks that the active user belongs to the allowed domain.
 * @returns {{ ok: boolean, email: string, error?: string }}
 */
function checkDomain() {
  var user = Session.getActiveUser();
  var email = user.getEmail();
  if (!email) {
    return { ok: false, email: '', error: 'Could not obtain user email.' };
  }
  var domain = (email.indexOf('@') !== -1) ? email.split('@')[1] : '';
  if (domain.toLowerCase() !== CONFIG.ALLOWED_DOMAIN.toLowerCase()) {
    return { ok: false, email: email, error: 'Only users from domain ' + CONFIG.ALLOWED_DOMAIN + ' can access.' };
  }
  return { ok: true, email: email };
}

/**
 * Gets the user role (employee or people_admin).
 * Defaults to "employee" if not in the Users sheet.
 * @param {string} email
 * @returns {string} 'employee' | 'people_admin'
 */
function getUserRole(email) {
  var adminList = CONFIG.ADMIN_EMAILS || [];
  for (var a = 0; a < adminList.length; a++) {
    if (String(adminList[a]).toLowerCase() === email.toLowerCase()) return 'people_admin';
  }
  try {
    var ss = getSpreadsheet();
    if (!ss) return 'employee';
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) return 'employee';
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === email.toLowerCase()) {
        return (String(data[i][1]).toLowerCase() === 'people_admin') ? 'people_admin' : 'employee';
      }
    }
  } catch (e) {
    Logger.log('getUserRole error: ' + (e.message || e));
  }
  return 'employee';
}

/**
 * Verifies domain and people_admin role.
 * @returns {{ ok: boolean, email: string, role: string, error?: string }}
 */
function requirePeopleAdmin() {
  var domainCheck = checkDomain();
  if (!domainCheck.ok) return domainCheck;
  var role = getUserRole(domainCheck.email);
  if (role !== 'people_admin') {
    return { ok: false, email: domainCheck.email, role: role, error: 'Access restricted to People Admin.' };
  }
  return { ok: true, email: domainCheck.email, role: role };
}

/**
 * Verifies domain only.
 * @returns {{ ok: boolean, email: string, role?: string, error?: string }}
 */
function requireDomain() {
  var domainCheck = checkDomain();
  if (!domainCheck.ok) return domainCheck;
  var role = getUserRole(domainCheck.email);
  return { ok: true, email: domainCheck.email, role: role };
}

/**
 * List of emails with people_admin role for backoffice assignment.
 * @returns {string[]}
 */
function getPeopleAdmins() {
  var list = [];
  var seen = {};
  var adminList = CONFIG.ADMIN_EMAILS || [];
  for (var a = 0; a < adminList.length; a++) {
    var em = String(adminList[a]).trim().toLowerCase();
    if (em && !seen[em]) { list.push(String(adminList[a]).trim()); seen[em] = true; }
  }
  try {
    var ss = getSpreadsheet();
    if (!ss) return list;
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) return list;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).toLowerCase() === 'people_admin') {
        var e = String(data[i][0]).trim().toLowerCase();
        if (e && !seen[e]) { list.push(String(data[i][0]).trim()); seen[e] = true; }
      }
    }
  } catch (e) {
    Logger.log('getPeopleAdmins error: ' + (e.message || e));
  }
  return list;
}
