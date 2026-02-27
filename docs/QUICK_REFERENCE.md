# People Hub - Quick Reference Guide

## 🎯 At a Glance

- **Project**: People Hub - Internal ticket management system for Huspy
- **Platform**: Google Apps Script Web App + Google Sheets
- **Domain**: huspy.io only
- **Slack Channel**: C0AG3U25RK2
- **Ticket ID Format**: HSPY-2026-0001
- **Design**: Huspy orange (#FF6B35) + modern minimal aesthetic

---

## 🔑 Key Files & Purpose

| File | Purpose |
|------|---------|
| **Config.gs** | Central configuration (domain, Sheet ID, Slack channel, URLs) |
| **Auth.gs** | Domain restriction + role detection (employee / people_admin) |
| **Code.gs** | API endpoints for client calls |
| **Tickets.gs** | Ticket CRUD operations |
| **Dashboard.gs** | Metrics computation + search |
| **UserManagement.gs** | User CRUD operations (admin only) |
| **Notifications.gs** | Email + Slack Web API integration |
| **Ui.gs** | Routing and HTML rendering |
| **styles.css** | Complete Huspy design system |

---

## 📡 API Endpoints (Client → Server)

### Tickets
```javascript
createTicketFromForm(input)           // Create new ticket
getMyTickets()                        // Employee: get own tickets
getAllTickets(filters)                // Admin: get all tickets
getTicketDetail(ticketId)             // Get single ticket (permissions-based)
getTicketEventsForDetail(ticketId)    // Get event history
updateTicketStatusFromUi(ticketId, newStatus)   // Admin: change status
assignTicketOwnerFromUi(ticketId, ownerEmail)   // Admin: assign owner
addTicketCommentFromUi(ticketId, comment, visibility) // Add comment
```

### Dashboard & Search
```javascript
getDashboardMetrics()                 // Admin: get KPI metrics
searchTicketsFromUi(query)            // Search tickets (role-scoped)
```

### User Management
```javascript
getAllUsersFromUi()                   // Admin: list all users
saveUserFromUi(email, role, firstName, lastName) // Admin: create/update user
deleteUserFromUi(email)               // Admin: delete user
getUserInfoFromUi(email)              // Get user info (own or admin)
```

### Utilities
```javascript
getPeopleAdminsForUi()                // Get list of admins
getCategoriesForUi()                  // Get available categories
```

---

## 🗂️ Data Model

### Tickets Sheet
| Column | Type | Description |
|--------|------|-------------|
| ticketId | Text | HSPY-2026-0001 |
| createdAt | Date | ISO timestamp |
| createdByEmail | Email | Requester email |
| requesterName | Text | Display name |
| category | Text | Parking, IT, General, Facilities, HR |
| subcategory | Text | Optional subcategory |
| subject | Text | Title |
| description | Long text | Details |
| priority | Text | Low, Medium, High |
| status | Text | New, In Progress, Waiting on Employee, Resolved, Closed |
| ownerEmail | Email | Assigned admin (nullable) |
| slaTarget | Date | Reserved for v2 |
| lastUpdatedAt | Date | ISO timestamp |
| tags | Text | Comma-separated (optional) |
| attachmentIds | Text | Reserved |

### TicketEvents Sheet (Audit Log)
| Column | Description |
|--------|-------------|
| eventId | Unique event ID |
| ticketId | Reference to ticket |
| timestamp | ISO timestamp |
| actorEmail | Who performed action |
| action | created, status_changed, assigned, comment_internal, comment_employee |
| fromValue | Previous value |
| toValue | New value |
| comment | Comment text or description |
| metadata | JSON (optional) |

### Users Sheet
| Column | Description |
|--------|-------------|
| Email | user@huspy.io |
| Role | employee OR people_admin |
| First Name | Display name |
| Last Name | (Optional) |

---

## 🎨 Design Tokens

### Colors
```css
--huspy-orange: #FF6B35
--huspy-orange-hover: #E55A2B
--huspy-orange-light: #FFE5DC
--gray-50 to --gray-900 (neutral palette)
```

### Component Classes
```css
.btn-primary              Orange CTA button
.btn-secondary            White outlined button
.metric-card              Dashboard KPI card
.status-badge             Colored pill (new, in-progress, etc.)
.role-badge               Admin/Employee badge
.card                     White card container
.table                    Data table
.form-input               Form input field
.search-box               Search input with icon
.loading / .spinner       Loading state
.empty-state              No data state
```

---

## 🔐 Roles & Permissions

### Employee
- ✅ Create tickets
- ✅ View own tickets only
- ✅ View detail of own tickets
- ✅ Search own tickets
- ❌ Cannot see others' tickets
- ❌ Cannot change status/owner
- ❌ Cannot access admin dashboard
- ❌ Cannot manage users

### People Admin
- ✅ All employee permissions +
- ✅ View all tickets
- ✅ Dashboard with metrics
- ✅ Change ticket status
- ✅ Assign owners
- ✅ Add internal comments
- ✅ Manage users (add/edit/delete)
- ✅ Access raw data Sheet
- ✅ Global search

---

## 📬 Slack Notifications

### When Triggered
1. **New Ticket**: When ticket is created via form/app
2. **Status Change**: When admin updates ticket status
3. **Owner Assignment**: When admin assigns ticket to someone

### Message Format
- Rich Block Kit messages
- Includes ticket ID, subject, category
- "View Ticket" button linking to detail page
- Color-coded by action type

### Setup Required
1. Create Slack App with `chat:write` scope
2. Install to workspace → Get Bot Token (`xoxb-...`)
3. Store in Script Properties: `SLACK_BOT_TOKEN`
4. Invite bot to channel `C0AG3U25RK2`
5. Test with `testSlackIntegration()` function

📖 Full guide: `docs/SLACK_SETUP.md`

---

## 🚀 Deployment Checklist

### One-Time Setup
- [ ] Configure `SPREADSHEET_ID` in Config.gs
- [ ] Create Users sheet with initial admins
- [ ] Create Slack App and configure Bot Token
- [ ] Invite Slack bot to channel C0AG3U25RK2
- [ ] Install Form Submit trigger (if using Google Form sync)

### Deploy Web App
```bash
cd "/Users/juanjosetamayo/Documents/people hub"
clasp push
clasp deploy --description "People Hub MVP v1.0"
```

Or via Apps Script UI:
1. Open Script Editor
2. Click **Deploy** → **New deployment**
3. Type: **Web app**
4. Execute as: **Me** (your admin account)
5. Who has access: **Anyone with Google account**
6. Deploy
7. Copy Web App URL

### Post-Deployment
- [ ] Test with admin account
- [ ] Test with employee account  
- [ ] Verify domain restriction blocks non-@huspy.io
- [ ] Test ticket creation → Slack notification
- [ ] Test status change → Slack notification
- [ ] Test user management (add/edit/delete)
- [ ] Verify raw data link works (admin only)

---

## 🐛 Common Issues & Fixes

### "No se pudo obtener el Spreadsheet"
**Problem**: SPREADSHEET_ID not configured or incorrect  
**Fix**: Update `Config.gs` with correct Sheet ID from URL

### Slack notifications not working
**Problem**: Bot Token not configured  
**Fix**: Set Script Properties: `SLACK_BOT_TOKEN = xoxb-...`

### "Acceso denegado" for valid user
**Problem**: User not in Users sheet or wrong role  
**Fix**: Add user to Users sheet with correct role

### Employee can see all tickets
**Problem**: Logic error in filtering  
**Fix**: Check `getMyTickets()` filters by `createdByEmail`

### Modal not opening
**Problem**: JavaScript error  
**Fix**: Check browser console for errors

---

## 📊 Dashboard Metrics

| Metric | Formula |
|--------|---------|
| **Open Cases** | COUNT(status NOT IN [Resolved, Closed]) |
| **New** | COUNT(status = New) |
| **In Progress** | COUNT(status = In Progress) |
| **Waiting on Employee** | COUNT(status = Waiting on Employee) |
| **Aging > 7 days** | COUNT(open tickets WHERE createdAt < now - 7 days) |
| **Avg Resolution Time** | AVG(resolvedAt - createdAt) for Resolved/Closed tickets |

---

## 🔗 Important URLs

| Resource | URL |
|----------|-----|
| **Google Form** | https://docs.google.com/forms/d/1m2fsyrKjpipm_BYFkSNOANpOIamaXp0SPmeU2e5GitQ/edit |
| **Form Responses Sheet** | https://docs.google.com/spreadsheets/d/1xaAsNieNw2mNPFmWPouwHEEs9R_H3KSEAj9zH_vEOwY/edit |
| **People Hub Sheet** | (set in Config.gs SPREADSHEET_ID) |
| **Slack API** | https://api.slack.com/apps |
| **Huspy Website** | https://huspy.com/ae/mortgages (design reference) |

---

## 📞 Support

**Maintainer**: juan.tamayo@huspy.io  
**Documentation**: `docs/` folder  
**Slack Setup**: `docs/SLACK_SETUP.md`  
**Implementation Status**: `docs/IMPLEMENTATION_STATUS.md`

---

**Last Updated**: 2026-02-16  
**Version**: MVP 1.0  
**Status**: 🟡 In Progress (60% complete)
