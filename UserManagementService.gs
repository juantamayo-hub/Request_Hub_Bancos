/**
 * People Hub — User Management (admin-only).
 * User and role management.
 */

/**
 * Gets all users from the Users sheet.
 * @returns {Array<Object>}
 */
function getAllUsers() {
  var auth = requirePeopleAdmin();
  if (!auth.ok) return [];
  
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) return [];
    
    var data = sheet.getDataRange().getValues();
    var list = [];
    
    for (var i = 1; i < data.length; i++) {
      list.push({
        email: String(data[i][0]).trim(),
        role: String(data[i][1]).trim(),
        firstName: String(data[i][2] || '').trim(),
        lastName: String(data[i][3] || '').trim(),
        rowIndex: i + 1
      });
    }
    
    return list;
  } catch (e) {
    Logger.log('getAllUsers error: ' + e.message);
    return [];
  }
}

/**
 * Adds a new user (or updates if already exists).
 * @param {string} email
 * @param {string} role - 'employee' | 'people_admin'
 * @param {string} firstName
 * @param {string} lastName
 * @returns {{ success: boolean, error?: string }}
 */
function saveUser(email, role, firstName, lastName) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }
  
  if (role !== 'employee' && role !== 'people_admin') {
    return { success: false, error: 'Invalid role. Use "employee" or "people_admin".' };
  }
  
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet) {
      return { success: false, error: 'Users sheet not found. Run setup().' };
    }
    
    var data = sheet.getDataRange().getValues();
    var emailLower = email.trim().toLowerCase();
    var rowIndex = -1;
    
    // Check if user already exists
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === emailLower) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex > 0) {
      // Update existing user
      sheet.getRange(rowIndex, 2).setValue(role);
      sheet.getRange(rowIndex, 3).setValue(firstName || '');
      sheet.getRange(rowIndex, 4).setValue(lastName || '');
    } else {
      // Add new user
      sheet.appendRow([email.trim(), role, firstName || '', lastName || '']);
    }
    
    return { success: true };
  } catch (e) {
    Logger.log('saveUser error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Deletes a user from the Users sheet.
 * @param {string} email
 * @returns {{ success: boolean, error?: string }}
 */
function deleteUser(email) {
  if (!email || !email.trim()) {
    return { success: false, error: 'Email is required.' };
  }
  
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet) {
      return { success: false, error: 'Users sheet not found.' };
    }
    
    var data = sheet.getDataRange().getValues();
    var emailLower = email.trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === emailLower) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    
    return { success: false, error: 'User not found.' };
  } catch (e) {
    Logger.log('deleteUser error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Gets user information by email.
 * @param {string} email
 * @returns {Object|null}
 */
function getUserInfo(email) {
  if (!email) return null;
  
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_USERS);
    if (!sheet || sheet.getLastRow() < 2) return null;
    
    var data = sheet.getDataRange().getValues();
    var emailLower = email.trim().toLowerCase();
    
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === emailLower) {
        return {
          email: String(data[i][0]).trim(),
          role: String(data[i][1]).trim(),
          firstName: String(data[i][2] || '').trim(),
          lastName: String(data[i][3] || '').trim()
        };
      }
    }
    
    return null;
  } catch (e) {
    Logger.log('getUserInfo error: ' + e.message);
    return null;
  }
}
