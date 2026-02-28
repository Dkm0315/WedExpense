# WedExpense — Implementation Guide

## Overview

**WedExpense** is a full-stack wedding expense tracking application built entirely on **Zoho Catalyst**. It supports two modes — **Family/Couple** (personal wedding planning) and **Wedding Planner** (managing multiple client weddings with income tracking). The app features AI-powered expense categorization, receipt scanning via OCR, budget analytics, real-time collaboration, and an AI chat assistant.

**Live URL:** `https://project-rainfall-60066369864.development.catalystserverless.in/app/index.html`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Tailwind CSS, Framer Motion |
| Backend | Node.js (Zoho Catalyst Advanced I/O Function) |
| Database | Zoho Catalyst Data Store (ZCQL) |
| Authentication | Zoho Catalyst Authentication (built-in SSO) |
| AI/ML | Zoho Catalyst Zia — OCR, Text Analytics, Keyword Extraction |
| Caching | Zoho Catalyst Cache |
| Hosting | Zoho Catalyst Web Client Hosting |
| CI/CD | Catalyst CLI (`catalyst deploy`) |

---

## Zoho Catalyst Services Used

### 1. Catalyst Authentication
**Where:** Login, session management, API authorization
**How:** The Catalyst Web SDK (`catalystWebSDK.js`) is loaded in `index.html`. It provides:
- `catalyst.auth.signIn(containerId, options)` — renders Zoho's sign-in widget in the login page iframe
- `catalyst.auth.signOut(redirectUrl)` — handles logout across all pages
- `catalyst.auth.isUserAuthenticated()` — checks session validity on app load (App.tsx)
- `catalyst.auth.generateAuthToken()` / `catalyst.auth.getHeaders()` — attaches auth tokens to every API request (client.ts)

**Backend:** Every API request is authenticated server-side via `catalyst.initialize(req)` which extracts the user context from the request headers. The user's `org_id` is used for multi-tenancy scoping.

### 2. Catalyst Data Store (ZCQL)
**Where:** All CRUD operations
**How:** Six tables in Catalyst Data Store, queried via ZCQL (Zoho Catalyst Query Language):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| **Weddings** | Core wedding records | `ROWID`, `org_id`, `wedding_name`, `total_budget`, `start_date`, `end_date`, `bride_name`, `groom_name`, `venue_city`, `is_planner_mode`, `share_token` |
| **Events** | Sub-events (Sangeet, Mehendi, etc.) | `ROWID`, `wedding_id`, `org_id`, `event_name`, `event_budget`, `event_date`, `venue`, `status` |
| **Expenses** | Individual expense items | `ROWID`, `wedding_id`, `event_id`, `org_id`, `vendor_name`, `category`, `amount`, `amount_paid`, `payment_status`, `paid_by`, `receipt_url`, `added_by` |
| **Incomes** | Revenue tracking (planner mode) | `ROWID`, `wedding_id`, `org_id`, `source`, `amount`, `amount_received`, `payment_status`, `income_date` |
| **OrgSettings** | Tenant configuration | `ROWID`, `org_id`, `account_type` (family/planner), `org_name`, `onboarded` |
| **AuditLogs** | Activity trail | `ROWID`, `org_id`, `wedding_id`, `action`, `entity_type`, `entity_name`, `user_email`, `details` |

**ZCQL Examples:**
```sql
-- Multi-tenant wedding fetch (always scoped by org_id)
SELECT ROWID, wedding_name, total_budget FROM Weddings WHERE org_id = 'abc123' ORDER BY CREATEDTIME DESC

-- Aggregate expense summary
SELECT SUM(amount) as total_spent, SUM(amount_paid) as total_paid FROM Expenses WHERE wedding_id = 12345

-- Per-category breakdown
SELECT category, SUM(amount) as total FROM Expenses WHERE wedding_id = 12345 GROUP BY category
```

### 3. Catalyst Zia (AI/ML)
**Where:** Receipt scanning, expense categorization, budget insights
**How:** Three Zia capabilities are used:

- **OCR (Optical Character Recognition):**
  `app.zia().extractOpticalCharacters(fileStream, { model_type: 'OCR' })`
  Used in receipt scanning — user uploads a photo of a bill, Zia extracts text, then the system parses vendor name, amount, and date from the OCR output.

- **Keyword Extraction:**
  `app.zia().getKeywords(text)`
  Used for auto-categorization of expenses — extracts keywords from vendor descriptions and matches them against 15+ category patterns (Catering, Photography, Decor, etc.).

- **Text Analytics for AI Insights:**
  Used in the Budget Insights feature to analyze spending patterns and generate recommendations.

### 4. Catalyst Cache
**Where:** Summary endpoint optimization
**How:** `app.cache().segment()` provides key-value caching:
- Summary data was cached per wedding (`summary_{weddingId}`)
- Cache is invalidated when expenses, events, or incomes are created/updated/deleted
- Currently disabled for the summary endpoint to ensure fresh planned budget calculations

### 5. Catalyst Web Client Hosting
**Where:** Frontend deployment
**How:** The React app is built with `PUBLIC_URL=/app` and deployed via `catalyst deploy --only client`. Catalyst serves the static files at `/app/index.html` and provides:
- Automatic SSL/HTTPS
- CDN distribution
- The `/__catalyst/sdk/init.js` script for SDK initialization
- Proxy routing: `/server/*` requests are forwarded to Advanced I/O Functions

### 6. Catalyst Advanced I/O Functions
**Where:** Backend API
**How:** A single Node.js function (`wedexpense_function`) handles all API routes via manual URL pattern matching. It's deployed at `/server/wedexpense_function/` and serves 25+ REST endpoints. Uses `catalyst.initialize(req, { scope: 'admin' })` for admin-level Data Store access.

### 7. Catalyst API Gateway
**Where:** Route configuration
**How:** Maps incoming HTTP requests to the backend function. Configured once via `catalyst resources:api-gateway:configure` — routes persist across deployments.

---

## Multi-Tenancy Architecture

WedExpense implements **organization-level multi-tenancy** using Catalyst's built-in user management:

### How It Works

1. **User → Organization Mapping:**
   Every Catalyst user belongs to an organization (`org_id`). When a user signs up and logs in, their `org_id` is extracted server-side via:
   ```js
   const userApp = catalyst.initialize(req);
   const user = await userApp.userManagement().getCurrentProjectUser();
   const orgId = String(user.org_id);
   ```

2. **Data Isolation:**
   Every database table includes an `org_id` column. **All queries are scoped by `org_id`**, ensuring complete data isolation between tenants:
   ```sql
   -- A user can ONLY see their organization's weddings
   SELECT * FROM Weddings WHERE org_id = 'org_abc'

   -- Ownership check before update/delete
   SELECT ROWID FROM Weddings WHERE ROWID = 123 AND org_id = 'org_abc'
   ```

3. **Write Isolation:**
   Every INSERT operation stamps the `org_id` on the record:
   ```js
   const rowData = {
     org_id: orgId,
     wedding_name: body.wedding_name,
     total_budget: body.total_budget
   };
   ```

4. **Tenant Settings:**
   The `OrgSettings` table stores per-tenant configuration:
   - `account_type`: `"family"` or `"planner"` — controls which features are visible
   - `org_name`: Organization name displayed in planner mode
   - `onboarded`: Whether the user has completed onboarding

5. **Collaboration Within a Tenant:**
   Multiple users in the same Catalyst organization share the same `org_id`, so they see the same weddings. The **Invite Members** feature uses `catalyst.userManagement().addProjectUser()` to add collaborators to the project, automatically placing them in the same org.

6. **Cross-Tenant Sharing:**
   Public share links use a `share_token` on the wedding record. The `/shared/:token` route bypasses org_id checks and returns a read-only view, allowing external stakeholders to view budget summaries without authentication.

### Tenant Isolation Flow

```
User Request → Catalyst Auth (validate session)
            → Extract org_id from user profile
            → All DB queries include WHERE org_id = ?
            → Response contains ONLY that tenant's data
```

---

## Features Implemented

### Core Features (Phase 0)

| Feature | Description |
|---------|-------------|
| **User Authentication** | Zoho SSO with sign-in widget, session management, sign-out |
| **Onboarding Flow** | Account type selection (Family/Couple or Wedding Planner), org name setup |
| **Wedding CRUD** | Create, read, update, delete weddings with budget, dates, names, venue city |
| **Event Management** | Create sub-events (Sangeet, Mehendi, Reception, etc.) with individual budgets |
| **Expense Tracking** | Add expenses with vendor, amount, category, payment status (Paid/Pending/Partial) |
| **Receipt Scanning** | Upload receipt photo → Zia OCR extracts text → auto-parse vendor, amount, date |
| **AI Categorization** | Zia keyword extraction auto-assigns expenses to 15+ categories |
| **Budget Analytics** | Per-event and per-category breakdowns, bride vs groom side split |
| **Income Tracking** | Planner mode: track client payments, revenue, profit calculation |
| **Share Links** | Generate public read-only links for family/stakeholders |
| **Invite Members** | Add collaborators to the Catalyst project for shared access |
| **Audit Logs** | Activity trail for all create/update/delete operations |
| **AI Budget Insights** | Data-driven spending analysis with recommendations |
| **Expense Search** | Full-text search across vendor names, categories, descriptions |
| **Planner Dashboard** | Revenue, expenses, profit KPI cards for wedding planners |

### Feature Pack (Phase 1–6)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Planned Budget KPI** | 4th KPI card showing sum of all event budgets as "planned allocation" with % of total budget |
| 2 | **Dual Progress Bars** | Separate "Planned" (blue) and "Spent" (gradient) bars for clear budget utilization visualization |
| 3 | **Inline Budget Tab** | Budget charts/insights render inline within WeddingDetail instead of navigating to a separate page |
| 4 | **Inline Search Tab** | Search expenses inline within WeddingDetail |
| 5 | **Edit Expense Status** | Edit payment_status and amount_paid on existing expenses (Paid/Pending/Partial toggle) |
| 6 | **Edit Income Status** | Edit payment_status and amount_received on existing incomes |
| 7 | **Wedding Date Range** | From/To date fields for multi-day Indian weddings (replaces single date) |
| 8 | **Date Range Display** | Smart formatting: "15 – 18 Dec, 2025" or "28 Nov – 2 Dec, 2025" |
| 9 | **AI Chat Persistence** | Chat messages saved to localStorage, restored on reload, "Clear" button, 50-message cap |
| 10 | **Chat History Context** | Last 6 messages sent as history to AI endpoint for contextual follow-ups |
| 11 | **Event Date Validation** | Event dates constrained to wedding date range (min/max on date input) |
| 12 | **Budget Overspend %** | Uncapped percentage display — shows actual 162% instead of capping at 100% |
| 13 | **Edit Wedding** | Pencil icon → modal to edit wedding name, budget, dates, bride/groom names, venue city |
| 14 | **Edit Event** | Pencil icon → inline modal to edit event name, budget, date |
| 15 | **Mode Switching** | Gear icon on Dashboard to switch between Family/Couple and Planner mode |
| 16 | **Navigation Buttons** | Back arrow (←) on every inner page + clickable logo in navbar |

---

## Project Structure

```
WedExpense/
├── catalyst.json                      # Catalyst project config
├── functions/
│   └── wedexpense_function/
│       ├── index.js                   # All backend routes (~1800 lines)
│       └── package.json
├── wedexpense-client/                 # React frontend (Catalyst Web Client)
│   ├── src/
│   │   ├── App.tsx                    # Router + auth check
│   │   ├── api/
│   │   │   └── client.ts             # API client with auth token injection
│   │   ├── components/
│   │   │   ├── Layout.tsx             # Navbar + AI chat wrapper
│   │   │   ├── AIFloatingChat.tsx     # AI chat with localStorage persistence
│   │   │   ├── BudgetBar.tsx          # Progress bar (uncapped %)
│   │   │   ├── BudgetSummaryContent.tsx  # Budget charts (extracted component)
│   │   │   ├── SearchExpensesContent.tsx # Search UI (extracted component)
│   │   │   ├── EditExpenseModal.tsx    # Edit payment status modal
│   │   │   ├── EditIncomeModal.tsx     # Edit income status modal
│   │   │   ├── EditWeddingModal.tsx    # Edit wedding details modal
│   │   │   ├── ExpenseCard.tsx         # Expense display card
│   │   │   ├── ReceiptScanner.tsx      # Receipt upload + OCR
│   │   │   ├── EmptyState.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx              # Zoho sign-in widget
│   │   │   ├── Dashboard.tsx          # Wedding list + planner KPIs
│   │   │   ├── WeddingDetail.tsx      # Wedding hub (events, income, budget, search, activity)
│   │   │   ├── EventDetail.tsx        # Event expenses + edit
│   │   │   ├── AddExpense.tsx         # Expense creation form
│   │   │   ├── BudgetSummary.tsx      # Standalone budget route (thin wrapper)
│   │   │   ├── SearchExpenses.tsx     # Standalone search route (thin wrapper)
│   │   │   ├── InviteMembers.tsx      # Collaborator invitations
│   │   │   ├── AIAssistant.tsx        # Full-page AI chat
│   │   │   └── SharedWeddingView.tsx  # Public read-only view
│   │   ├── utils/
│   │   │   └── format.ts             # formatINR, formatDate, formatDateRange
│   │   └── types.d.ts
│   ├── build/                         # CRA build output
│   ├── index.html                     # Deployed root (copied from build/)
│   └── static/                        # Deployed assets (copied from build/)
└── appsail-nodejs/                    # AppSail service (minimal)
```

---

## API Endpoints (25+)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/weddings` | List all weddings (org-scoped) |
| POST | `/api/weddings` | Create wedding |
| GET | `/api/weddings/:id` | Get single wedding |
| PUT | `/api/weddings/:id` | Update wedding |
| DELETE | `/api/weddings/:id` | Delete wedding + cascade |
| GET | `/api/weddings/:wid/events` | List events for a wedding |
| POST | `/api/weddings/:wid/events` | Create event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event + expenses |
| GET | `/api/weddings/:wid/expenses` | List expenses (filterable) |
| POST | `/api/weddings/:wid/expenses` | Create expense (with AI categorization) |
| GET | `/api/weddings/:wid/expenses/search` | Search expenses |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/weddings/:wid/summary` | Budget summary (KPIs, breakdowns) |
| GET | `/api/weddings/:wid/summary/events` | Per-event budget breakdown |
| GET | `/api/weddings/:wid/summary/categories` | Per-category breakdown |
| GET | `/api/weddings/:wid/incomes` | List incomes |
| POST | `/api/weddings/:wid/incomes` | Create income |
| PUT | `/api/incomes/:id` | Update income |
| DELETE | `/api/incomes/:id` | Delete income |
| POST | `/api/weddings/:wid/ai-insights` | Generate AI budget insights |
| POST | `/api/weddings/:wid/ai-chat` | AI chat with context |
| POST | `/api/weddings/:wid/ai-parse-doc` | Parse document via OCR |
| POST | `/api/weddings/:wid/share` | Generate share link |
| GET | `/api/shared/:token` | Public shared view |
| GET | `/api/weddings/:wid/audit-logs` | Activity audit trail |
| GET | `/api/user/current` | Get current user info |
| GET | `/api/onboarding` | Get org settings |
| POST | `/api/onboarding` | Create/update org settings |
| GET | `/api/dashboard/planner-summary` | Planner revenue/expense/profit |
| GET | `/api/categories` | List expense categories |
| POST | `/api/cron/daily-summary` | Daily summary cron job |

---

## Deployment

```bash
# Build frontend
cd wedexpense-client
PUBLIC_URL=/app npm run build
cp build/index.html . && cp build/asset-manifest.json . && cp build/manifest.json .
rm -rf static && cp -r build/static .

# Deploy
cd ..
catalyst deploy --only functions    # Backend
catalyst deploy --only client       # Frontend

# Push to GitHub
git add . && git commit -m "Deploy" && git push origin main
```

---

## Key Design Decisions

1. **Single backend function** — All 25+ routes in one `index.js` file. Catalyst Advanced I/O Functions support long-running requests; a single function avoids cold-start overhead from multiple function deployments.

2. **ZCQL over Data Store SDK** — ZCQL provides SQL-like queries with JOINs, GROUP BY, and aggregates. Much more flexible than the basic CRUD SDK for analytics queries.

3. **Web Client Hosting over Slate** — Slate requires SSR and is opinionated about routing. Web Client Hosting serves static files directly, giving full control over the React SPA routing with `BrowserRouter`.

4. **Admin scope initialization** — `catalyst.initialize(req, { scope: 'admin' })` bypasses per-user row-level restrictions in Data Store, allowing the backend to manage multi-tenancy at the application level via `org_id` filtering.

5. **Component extraction pattern** — BudgetSummary and SearchExpenses content was extracted into reusable components (`BudgetSummaryContent`, `SearchExpensesContent`) so they can render both inline (as tabs in WeddingDetail) and as standalone pages.

6. **localStorage for chat** — AI chat messages are persisted in `localStorage` (keyed per wedding, capped at 50 messages) rather than the database, keeping it lightweight and instant.
