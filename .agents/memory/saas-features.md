---
name: SaaS Features Layer
description: Subscription system, billing dashboard, API key management, audit log, notifications, onboarding wizard — architecture decisions and sharp edges
---

## Features built

### Subscription System (`routes/subscriptions.ts`)
- 3 DB tables: `plans`, `subscriptions`, `usage_records`
- Plans seeded on first request (Starter $0 / Growth $49 / Enterprise $199)
- `GET /subscriptions/current` auto-provisions Starter plan if org has none — never returns null
- Usage computed live via JOINs into `tasks`, `workflow_runs`, `executions` tables
- `POST /subscriptions/upgrade` cancels current sub then creates new one (no Stripe yet)

### API Key Management (`routes/provider-keys.ts`)
- Table: `provider_keys` — stores `encrypted_key` (plaintext, DB is security boundary), `key_preview` (first 7 + last 4 chars)
- Adding a new key for a provider deactivates all existing keys for that provider
- **Never return `encrypted_key` in GET responses** — always exclude via column selection

### Audit Log (`routes/audit-logs.ts`)
- `requireRole(["owner", "admin"])` — existing middleware takes array, NOT rest params
- `createAuditLog()` exported as a helper function — catches all errors so it never breaks main flows
- **Why:** audit logging must be fire-and-forget; never let it block a request

### Notifications (`routes/notifications.ts`)
- Bell icon in Nav with 30s polling (`refetchInterval: 30000`)
- `createNotification()` exported helper — also catches errors silently
- Read-all route: `PATCH /notifications/read-all`

### Onboarding Wizard (`routes/onboarding.ts`, `pages/onboarding.tsx`)
- 4 steps: industry → website → AI team → complete
- Saves progress to `organizations` table: `industry`, `website`, `ai_team`, `onboarding_step`, `onboarding_completed`
- Route `/onboarding` is outside `ProtectedRoute` wrapper in App.tsx (no Nav shown)

## Sharp edges
- `requireRole` in `middleware/require-role.ts` takes an **array** `requireRole(["owner", "admin"])` — NOT rest params
- Schema index (`lib/db/src/schema/index.ts`) must be manually updated when adding new tables — no auto-discovery
- `organizations` table now has new nullable columns: `industry`, `website`, `ai_team`, `onboarding_completed` (bool, default false), `onboarding_step` (int, default 0)
