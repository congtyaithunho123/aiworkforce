---
name: CRM + Trial + Referral Layer
description: 4 new DB tables (customers, deals, activities, referrals), trial system, referral codes, CRM Kanban UI, TrialBanner, settings referral tab
---

# CRM + Trial + Referral Layer

## What was built
- **DB tables**: `customers`, `deals`, `activities`, `referrals` in `lib/db/src/schema/`
- **organizations** table extended with `trialEndsAt` (timestamp) + `freeTasksRemaining` (int, default 100)
- **Trial system**: on register, org gets `trialEndsAt = now + 7 days`, 100 free tasks. `GET /api/trial/status` returns daysRemaining, isTrialing, isExpired, showWarning (≤3 days)
- **Referral system**: `GET /api/referral/my-code` (auto-creates unique code), `GET /api/referral/stats`, `POST /api/referral/claim`. Register endpoint reads `?ref=CODE` query param and awards +7 days to both parties
- **CRM API**: full CRUD for `/api/crm/customers`, `/api/crm/deals`, `/api/crm/activities`. `PATCH /api/crm/deals/:id/stage` moves Kanban stage and logs activity
- **CRM UI**: `/crm` Kanban 4-column board (Lead→Demo→Trial→Paid), deal cards with Framer Motion, Add Customer/Deal modals
- **TrialBanner**: fixed bottom banner, 3 states (warning ≤3 days, tasks exhausted, expired red)
- **Settings**: added "🎁 Referral" tab with copy-to-clipboard link, referred count, days earned
- **Register page**: reads `?ref=` URL param, shows amber badge "Mã giới thiệu X được áp dụng"

## Key decisions
- Referral codes stored as JSON string array in `referrals.referredUserIds` (avoids separate junction table)
- Referral code format: `userId.toString(36).toUpperCase() + 4 random chars` (collision-safe for small scale)
- `referralCode` passed via `?ref=` query param to `POST /auth/register` (not request body) so it doesn't conflict with body schema validation

**Why:** Query param approach avoids any Zod body schema changes and is consistent with the `app.url/register?ref=CODE` spec in task requirements.

## Files
- `lib/db/src/schema/customers.ts`, `deals.ts`, `activities.ts`, `referrals.ts`
- `lib/db/src/schema/organizations.ts` (trialEndsAt, freeTasksRemaining added)
- `artifacts/api-server/src/routes/trial.ts`, `referral.ts`, `crm.ts`
- `artifacts/api-server/src/routes/auth.ts` (register extended with ?ref= handling)
- `artifacts/ai-workforce-roadmap/src/pages/crm.tsx`
- `artifacts/ai-workforce-roadmap/src/components/TrialBanner.tsx`
- `artifacts/ai-workforce-roadmap/src/pages/settings.tsx` (referral tab added)
- `artifacts/ai-workforce-roadmap/src/pages/register.tsx` (referral badge + param)
