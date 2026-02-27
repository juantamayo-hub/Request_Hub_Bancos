# People Hub — Internal Help Desk

Modern migration of the original Google Apps Script app to:

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + RLS)
- **Auth**: Google Workspace SSO via Supabase Auth — restricted to `@huspy.io`
- **Deploy**: Vercel (recommended) or any Node.js host

---

## Repository structure

```
supabase/
  migrations/
    001_initial_schema.sql   ← Tables, enums, triggers, functions
    002_rls_policies.sql     ← Row Level Security
  seed.sql                   ← Categories + routing rules

src/
  middleware.ts              ← Session refresh + domain guard
  lib/
    database.types.ts        ← TypeScript types (mirrors schema)
    constants.ts             ← Enums, colours, domain
    utils.ts                 ← Helpers (formatDate, displayName…)
    auth.ts                  ← requireUser / requireAdmin helpers
    supabase/
      client.ts              ← Browser client (anon key, RLS-guarded)
      server.ts              ← Server client (anon key, cookie-based)
      admin.ts               ← Service-role client (server-only!)
    notifications/
      slack.ts               ← Slack webhook / Bot Token sender
      email.ts               ← Email stub (Resend-ready)
      index.ts               ← notifyTicketCreated, notifyStatusChanged
  app/
    login/page.tsx
    auth/callback/route.ts   ← OAuth exchange + domain check
    tickets/
      page.tsx               ← My Tickets (employee view)
      new/page.tsx           ← Create Ticket
      [id]/page.tsx          ← Ticket detail + comments
    admin/
      layout.tsx             ← Admin guard (server-side)
      tickets/page.tsx       ← All tickets + filters
      tickets/[id]/page.tsx  ← Admin detail + actions
    dashboard/page.tsx       ← Metrics (admin only)
    api/
      tickets/route.ts                    ← POST create ticket
      tickets/[id]/comments/route.ts      ← POST add comment
      admin/tickets/[id]/route.ts         ← PATCH update ticket
  components/
    ui/                     ← button, input, textarea, select, badge, label
    layout/Navbar.tsx
    tickets/                ← TicketList, TicketCard, TicketForm, CommentThread, AddCommentForm
    admin/                  ← AdminFilters, AdminTicketActions
    shared/                 ← StatusBadge, PriorityBadge
    dashboard/MetricsCards.tsx
```

---

## Step 1 — Supabase project setup

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Choose a region close to your users and set a strong DB password.
3. After provisioning, open **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Run migrations

In the Supabase Dashboard → **SQL Editor**, paste and run:

```
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_rls_policies.sql
3. supabase/seed.sql
```

Or if you have the Supabase CLI installed:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Step 3 — Google OAuth provider

1. In your Supabase Dashboard → **Authentication → Providers → Google**.
2. Enable Google and fill in your **Client ID** and **Client Secret**.
   - Create a project at [console.cloud.google.com](https://console.cloud.google.com).
   - Go to **APIs & Services → Credentials → OAuth 2.0 Client IDs**.
   - Authorised redirect URIs: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Copy the **Supabase Redirect URL** shown in the Supabase dashboard and paste it into Google's authorised redirect URIs.
4. Under **Authentication → URL Configuration** in Supabase, add your app URL to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (development)
   - `https://your-production-domain.com/auth/callback` (production)

---

## Step 4 — Local env vars

```bash
cp .env.local.example .env.local
```

Fill in at minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NEXT_PUBLIC_ALLOWED_DOMAIN=huspy.io
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **SUPABASE_SERVICE_ROLE_KEY** must never have a `NEXT_PUBLIC_` prefix. It is only read server-side (Route Handlers).

---

## Step 5 — Install dependencies and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. You will be redirected to `/login`.

---

## Step 6 — Grant yourself admin access

After signing in with your `@huspy.io` Google account for the first time:

1. Open the Supabase SQL Editor.
2. Run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your.name@huspy.io';
```

Sign out and back in. You will now see the **Admin** badge, **All Tickets**, and **Dashboard** links in the navbar.

---

## How to add more admins

Same pattern — run the UPDATE query for any user who has signed in at least once:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'colleague@huspy.io';
```

To downgrade back to employee:

```sql
UPDATE profiles SET role = 'employee' WHERE email = 'colleague@huspy.io';
```

---

## Routing rules

Edit `supabase/seed.sql` to change:
- Which email owns each category
- Backup owner email
- Default priority
- SLA hours (e.g. `24` = 24-hour SLA)

Then re-run the seed (or UPDATE the routing_rules table directly in the SQL Editor).

---

## Notifications

### Slack (recommended for MVP)

1. Create a Slack App → **Incoming Webhooks** → activate and copy the webhook URL.
2. Set in `.env.local`:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

### Email (optional)

1. Sign up at [resend.com](https://resend.com) and get an API key.
2. Set in `.env.local`:
   ```env
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   EMAIL_FROM=noreply@huspy.io
   ```
3. Uncomment the Resend block in `src/lib/notifications/email.ts` and run `npm install resend`.

---

## Deploying to Vercel

```bash
npx vercel
```

Add all env vars from `.env.local.example` to Vercel's **Project Settings → Environment Variables**.
Update `NEXT_PUBLIC_APP_URL` to your production URL and add the production callback URL to Supabase's allowed redirect URLs.

---

## Data model summary

| Table | Description |
|---|---|
| `profiles` | Extends `auth.users`; stores role (`employee` / `admin`), department, avatar |
| `categories` | Help Desk categories (IT, HR, Facilities, Parking, General) |
| `routing_rules` | Category → owner email, SLA hours, default priority |
| `tickets` | Core ticket record with display_id (HSPY-YYYY-NNNN), SLA deadline |
| `ticket_comments` | Public or internal comments per ticket |
| `audit_log` | Immutable log of every change (server-side writes only) |
| `ticket_status_history` | Full status transition log per ticket |

### RLS summary

| Operation | Employee | Admin |
|---|---|---|
| Read own tickets | ✅ | ✅ |
| Read all tickets | ❌ | ✅ |
| Create ticket | ✅ (created_by = self) | ✅ |
| Update ticket | ❌ | ✅ |
| Add public comment to own ticket | ✅ | ✅ |
| Add internal comment | ❌ | ✅ |
| Read audit_log / status_history | Own tickets only | All |
| Write audit_log | ❌ (service-role only) | ❌ (service-role only) |

---

## Generating TypeScript types from the live DB

Once your project is set up and migrations are applied, regenerate `database.types.ts` automatically:

```bash
npx supabase gen types typescript \
  --project-id <your-project-ref> \
  > src/lib/database.types.ts
```

---

## Development notes

- **Domain enforcement**: happens in three layers:
  1. `/auth/callback` route: signs out the user if `@domain` doesn't match.
  2. `middleware.ts`: checks every request and redirects non-matching sessions.
  3. RLS `is_admin()` uses `SECURITY DEFINER` to avoid infinite recursion.
- **Admin client**: imported only in `src/app/api/**` Route Handlers. Never in client components or pages.
- **Notifications**: fire-and-forget with `Promise.allSettled`. Failures are logged but don't affect the response.
