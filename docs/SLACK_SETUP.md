# Slack Integration Setup Guide

## Overview
People Hub uses Slack Web API to send real-time notifications to channel **C0AG3U25RK2** when:
- 🎫 New tickets are created
- 📝 Ticket status changes
- 👤 Tickets are assigned to owners

---

## Prerequisites
- Admin access to Huspy Slack workspace
- Permission to create Slack Apps
- Access to Google Apps Script project

---

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Select **"From scratch"**
4. App Name: `People Hub`
5. Workspace: Select your Huspy workspace
6. Click **"Create App"**

---

## Step 2: Add Bot Token Scopes

1. In the app settings, go to **"OAuth & Permissions"** (left sidebar)
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add:
   - `chat:write` - *Required* to post messages to channels
   - `chat:write.public` - *Optional* to post to public channels without joining

---

## Step 3: Install App to Workspace

1. Still in **"OAuth & Permissions"**, scroll to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review permissions and click **"Allow"**
4. **Copy the Bot User OAuth Token**
   - Starts with `xoxb-`
   - Looks like: `xoxb-XXXX-XXXX-XXXX`
   - ⚠️ **Keep this secure! Never commit to code.**

---

## Step 4: Invite Bot to Channel (Optional)

If you didn't add `chat:write.public` scope:

1. Go to Slack channel with ID **C0AG3U25RK2**
2. Type: `/invite @People Hub`
3. The bot will join the channel

---

## Step 5: Configure Google Apps Script

### Option A: Via Apps Script Editor (Recommended)

1. Open your People Hub Apps Script project
2. In the top menu, click **"Extensions"** → **"Apps Script"**
3. In the Script Editor, open the **"Execution log"** or create a new function
4. Run this one-time setup function:

```javascript
function setupSlackToken() {
  var token = 'xoxb-YOUR-ACTUAL-TOKEN-HERE'; // Replace with your token
  PropertiesService.getScriptProperties().setProperty('SLACK_BOT_TOKEN', token);
  Logger.log('Slack Bot Token configured successfully!');
}
```

5. Click **Run** (▶️ button)
6. Authorize if prompted
7. Check the **execution log** for "Slack Bot Token configured successfully!"
8. **Delete the function** after running (to avoid accidentally exposing the token)

### Option B: Via Script Properties UI

1. In Apps Script Editor, click **"Project Settings"** (⚙️ gear icon on left)
2. Scroll to **"Script Properties"**
3. Click **"Add script property"**
   - Property: `SLACK_BOT_TOKEN`
   - Value: `xoxb-your-actual-token-here`
4. Click **"Save script properties"**

---

## Step 6: Test Integration

### Test Function in Apps Script

Run this test function to verify the integration works:

```javascript
function testSlackIntegration() {
  var result = postSlackMessage(CONFIG.SLACK_CHANNEL_ID, {
    text: '🚀 People Hub Test Message',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Slack integration is working!* :white_check_mark:\n\nThis is a test message from People Hub setup.'
        }
      }
    ]
  });
  
  if (result) {
    Logger.log('✅ Slack message sent successfully!');
  } else {
    Logger.log('❌ Slack message failed. Check execution log.');
  }
}
```

1. Paste the function above into your Script Editor
2. Click **Run** (▶️ button)
3. Check your Slack channel **C0AG3U25RK2** for the test message
4. Check **execution log** for success/error messages

---

## Troubleshooting

### Error: "Slack: Bot Token no configurado"
- The `SLACK_BOT_TOKEN` property is not set
- Re-run Step 5 to configure the token

### Error: "not_in_channel" or "channel_not_found"
- The bot needs to be invited to channel C0AG3U25RK2
- Run `/invite @People Hub` in the channel
- OR add `chat:write.public` scope and reinstall the app

### Error: "invalid_auth"
- The Bot Token is incorrect or expired
- Copy a fresh token from https://api.slack.com/apps → Your App → OAuth & Permissions
- Re-run Step 5 with the new token

### Error: "missing_scope"
- The app is missing required scopes
- Go to https://api.slack.com/apps → Your App → OAuth & Permissions
- Add the missing scopes (see Step 2)
- Click **"Reinstall to Workspace"** after adding scopes

### Messages not appearing
1. Verify channel ID is correct (`C0AG3U25RK2`)
2. Check Apps Script execution logs for errors
3. Verify bot is in the channel (visible in channel members)
4. Try the test function above

---

## Security Best Practices

### ✅ DO:
- Store the Bot Token in Script Properties (secure and encrypted by Google)
- Restrict Apps Script project access to People Team admins only
- Rotate the token periodically (monthly/quarterly)
- Monitor Slack App activity logs

### ❌ DO NOT:
- Commit the Bot Token to version control
- Share the token in Slack, email, or documentation
- Hardcode the token in `Config.gs` or any `.gs` file
- Give the token to external services

---

## Notification Types

### 🎫 New Ticket Created
Triggered when: A new ticket is created via form or in-app form

Example message:
```
🎫 New Ticket: HSPY-2026-0042
Subject: Parking spot request
Category: Parking
Requester: juan.tamayo@huspy.io
Status: 🆕 New
[View Ticket Button]
```

### 📝 Status Changed
Triggered when: An admin changes ticket status

Example message:
```
Ticket HSPY-2026-0042 status updated
_Parking spot request_

🆕 New  →  🔄 In Progress

Updated by: maria.lopez@huspy.io
[View Ticket Button]
```

### 👤 Ticket Assigned
Triggered when: An admin assigns a ticket owner

Example message:
```
Ticket HSPY-2026-0042 assigned
_Parking spot request_

👤 Assigned to: carlos.garcia@huspy.io
By: maria.lopez@huspy.io
[View Ticket Button]
```

---

## Maintenance

### Rotating the Bot Token
1. Go to https://api.slack.com/apps → Your App → OAuth & Permissions
2. Click **"Revoke"** next to the current token (optional, for security)
3. Click **"Reinstall to Workspace"**
4. Copy the new Bot Token
5. Update Script Properties with the new token (Step 5)
6. Run the test function to verify

### Monitoring
- Check Slack App Dashboard for usage stats
- Review Google Apps Script execution logs for notification errors
- Monitor channel for missing/duplicate notifications

---

## Support

### For Slack Issues:
- Slack API Documentation: https://api.slack.com/docs
- Slack Community: https://api.slack.com/community

### For Apps Script Issues:
- Check execution logs in Apps Script Editor
- Contact People Hub maintainer: juan.tamayo@huspy.io
- Review notification error logs in `Logger.log()` output

---

## Quick Reference

| Item | Value |
|------|-------|
| **App Name** | People Hub |
| **Channel ID** | C0AG3U25RK2 |
| **Bot Token Scope** | `chat:write`, `chat:write.public` |
| **Script Property Key** | `SLACK_BOT_TOKEN` |
| **Token Format** | `xoxb-...` |
| **API Endpoint** | https://slack.com/api/chat.postMessage |

---

**Last Updated:** 2026-02-16  
**Version:** 1.0  
**Maintainer:** People Team (juan.tamayo@huspy.io)
