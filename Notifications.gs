/**
 * People Hub — Notifications: Email and Slack Web API.
 */

/**
 * Sends confirmation email when a ticket is created.
 * @param {string} toEmail
 * @param {string} ticketId
 * @param {string} subject
 * @param {string} category
 * @returns {boolean} true if sent (or no error)
 */
function sendTicketCreatedEmail(toEmail, ticketId, subject, category) {
  if (!CONFIG.ENABLE_NOTIFICATIONS) return false;
  try {
    if (!toEmail) return false;
    var appUrl = ScriptApp.getService().getUrl();
    var body = 'Your ticket has been created successfully.\n\n' +
      'ID: ' + ticketId + '\n' +
      'Subject: ' + (subject || '') + '\n' +
      'Category: ' + (category || '') + '\n\n' +
      'You can check the status at: ' + appUrl + '?page=detail&id=' + ticketId;
    GmailApp.sendEmail(toEmail, 'People Hub - Ticket created: ' + ticketId, body);
    return true;
  } catch (e) {
    Logger.log('sendTicketCreatedEmail error: ' + e.message);
    return false;
  }
}

/**
 * Gets the Slack Bot Token from Script Properties.
 * @returns {string}
 */
function getSlackBotToken() {
  try {
    return PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || '';
  } catch (e) {
    Logger.log('getSlackBotToken error: ' + e.message);
    return '';
  }
}

/**
 * Sends message to Slack using Web API (chat.postMessage).
 * @param {string} channel - Channel ID (e.g.: C0AG3U25RK2)
 * @param {Object} message - Object with text and/or blocks
 * @returns {boolean}
 */
function postSlackMessage(channel, message) {
  if (!CONFIG.ENABLE_NOTIFICATIONS) return false;
  var token = getSlackBotToken();
  if (!token || token.trim() === '') {
    Logger.log('Slack: Bot Token not configured. Run: PropertiesService.getScriptProperties().setProperty("SLACK_BOT_TOKEN", "xoxb-...")');
    return false;
  }
  
  try {
    var url = 'https://slack.com/api/chat.postMessage';
    var payload = {
      channel: channel,
      text: message.text || 'People Hub notification',
      blocks: message.blocks || []
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json; charset=utf-8',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var resp = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(resp.getContentText());
    
    if (!result.ok) {
      Logger.log('Slack API error: ' + (result.error || 'Unknown error'));
      return false;
    }
    return true;
  } catch (e) {
    Logger.log('postSlackMessage error: ' + e.message);
    return false;
  }
}

/**
 * Notification of ticket created to Slack.
 * @param {string} creatorEmail
 * @param {string} ticketId
 * @param {string} subject
 * @param {string} category
 */
function notifySlackTicketCreated(creatorEmail, ticketId, subject, category) {
  var appUrl = ScriptApp.getService().getUrl();
  var ticketUrl = appUrl + '?page=detail&id=' + encodeURIComponent(ticketId);
  
  var message = {
    text: '🎫 New ticket created: ' + ticketId,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎫 New Ticket: ' + ticketId
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Subject:*\n' + (subject || 'N/A')
          },
          {
            type: 'mrkdwn',
            text: '*Category:*\n' + (category || 'N/A')
          },
          {
            type: 'mrkdwn',
            text: '*Requester:*\n' + creatorEmail
          },
          {
            type: 'mrkdwn',
            text: '*Status:*\n:new: New'
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Ticket'
            },
            url: ticketUrl,
            style: 'primary'
          }
        ]
      }
    ]
  };
  
  return postSlackMessage(CONFIG.SLACK_CHANNEL_ID, message);
}

/**
 * Notification of status change to Slack.
 * @param {string} ticketId
 * @param {string} subject
 * @param {string} oldStatus
 * @param {string} newStatus
 * @param {string} updatedBy
 */
function notifySlackStatusChange(ticketId, subject, oldStatus, newStatus, updatedBy) {
  var appUrl = ScriptApp.getService().getUrl();
  var ticketUrl = appUrl + '?page=detail&id=' + encodeURIComponent(ticketId);
  
  var statusEmoji = {
    'New': ':new:',
    'In Progress': ':arrows_counterclockwise:',
    'Waiting on Employee': ':hourglass_flowing_sand:',
    'Resolved': ':white_check_mark:',
    'Closed': ':lock:'
  };
  
  var message = {
    text: '📝 Ticket ' + ticketId + ' status changed: ' + oldStatus + ' → ' + newStatus,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Ticket ' + ticketId + ' status updated*\n' +
                (subject ? '_' + subject + '_\n\n' : '\n') +
                statusEmoji[oldStatus] + ' ' + oldStatus + '  →  ' + statusEmoji[newStatus] + ' *' + newStatus + '*\n\n' +
                'Updated by: ' + updatedBy
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Ticket'
          },
          url: ticketUrl
        }
      }
    ]
  };
  
  return postSlackMessage(CONFIG.SLACK_CHANNEL_ID, message);
}

/**
 * Notification of owner assignment to Slack.
 * @param {string} ticketId
 * @param {string} subject
 * @param {string} ownerEmail
 * @param {string} assignedBy
 */
function notifySlackAssignment(ticketId, subject, ownerEmail, assignedBy) {
  var appUrl = ScriptApp.getService().getUrl();
  var ticketUrl = appUrl + '?page=detail&id=' + encodeURIComponent(ticketId);
  
  var message = {
    text: '👤 Ticket ' + ticketId + ' assigned to ' + ownerEmail,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Ticket ' + ticketId + ' assigned*\n' +
                (subject ? '_' + subject + '_\n\n' : '\n') +
                '👤 Assigned to: *' + ownerEmail + '*\n' +
                'By: ' + assignedBy
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Ticket'
          },
          url: ticketUrl
        }
      }
    ]
  };
  
  return postSlackMessage(CONFIG.SLACK_CHANNEL_ID, message);
}

/**
 * Notifies ticket creation (email + Slack).
 * Call after createTicket to avoid duplicate logic.
 */
function notifyTicketCreated(toEmail, ticketId, subject, category) {
  // Temporarily disabled to avoid spamming historical ticket owners during sync
  // sendTicketCreatedEmail(toEmail, ticketId, subject, category);
  notifySlackTicketCreated(toEmail, ticketId, subject, category);
}
