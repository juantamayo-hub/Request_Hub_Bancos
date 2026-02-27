/**
 * People Hub — Dashboard and metrics for People Admin.
 */

/**
 * Calculates dashboard metrics (KPIs).
 * @returns {Object}
 */
function computeDashboardMetrics() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      openCases: 0,
      newCount: 0,
      inProgressCount: 0,
      waitingOnEmployeeCount: 0,
      agingCount: 0,
      avgResolutionTime: 0
    };
  }
  
  var data = sheet.getDataRange().getValues();
  var openCases = 0;
  var newCount = 0;
  var inProgressCount = 0;
  var waitingOnEmployeeCount = 0;
  var agingCount = 0;
  var resolutionTimes = [];
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  for (var i = 1; i < data.length; i++) {
    var status = String(data[i][9]);
    var createdAt = new Date(data[i][1]);
    var resolvedAt = data[i][12] ? new Date(data[i][12]) : null;
    
    // Count open cases (not Resolved or Closed)
    if (status !== 'Resolved' && status !== 'Closed') {
      openCases++;
      
      // Aging: open cases older than 7 days
      if (createdAt < sevenDaysAgo) {
        agingCount++;
      }
      
      // Status breakdown
      if (status === 'New') newCount++;
      else if (status === 'In Progress') inProgressCount++;
      else if (status === 'Waiting on Employee') waitingOnEmployeeCount++;
    }
    
    // Average resolution time (for Resolved or Closed tickets)
    if ((status === 'Resolved' || status === 'Closed') && resolvedAt) {
      var resolutionDays = (resolvedAt - createdAt) / (1000 * 60 * 60 * 24);
      resolutionTimes.push(resolutionDays);
    }
  }
  
  var avgResolutionTime = 0;
  if (resolutionTimes.length > 0) {
    var sum = resolutionTimes.reduce(function(a, b) { return a + b; }, 0);
    avgResolutionTime = sum / resolutionTimes.length;
  }
  
  return {
    openCases: openCases,
    newCount: newCount,
    inProgressCount: inProgressCount,
    waitingOnEmployeeCount: waitingOnEmployeeCount,
    agingCount: agingCount,
    avgResolutionTime: Math.round(avgResolutionTime * 10) / 10
  };
}

/**
 * Global ticket search (by ID, requester, subject).
 * @param {string} query
 * @param {string} role
 * @param {string} userEmail
 * @returns {Array<Object>}
 */
function searchTickets(query, role, userEmail) {
  if (!query || query.trim() === '') return [];
  
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_TICKETS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var list = [];
  var q = query.toLowerCase().trim();
  
  for (var i = 1; i < data.length; i++) {
    var ticketId = String(data[i][0]).toLowerCase();
    var createdByEmail = String(data[i][2]).toLowerCase();
    var requesterName = String(data[i][3]).toLowerCase();
    var subject = String(data[i][6]).toLowerCase();
    
    // Admin: search all tickets
    // Employee: search only own tickets
    if (role !== 'people_admin' && createdByEmail !== userEmail.toLowerCase()) {
      continue;
    }
    
    if (ticketId.indexOf(q) !== -1 || 
        createdByEmail.indexOf(q) !== -1 || 
        requesterName.indexOf(q) !== -1 || 
        subject.indexOf(q) !== -1) {
      list.push(rowToTicketObject(headers, data[i]));
    }
  }
  
  list.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return list;
}
