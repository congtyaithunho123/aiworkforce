---
name: Agent Marketplace Architecture
description: Full marketplace ecosystem — 4 DB tables, routes at /api/marketplace/*, frontend at /marketplace
---

## DB Tables (lib/db/src/schema/)
- `marketplace_agents` — agent listings with status, version, install/execution counts, successRate, revenueSharePct
- `marketplace_workflows` — workflow listings with steps[], estimatedMinutes, same analytics fields
- `reviews` — targetType ("agent"|"workflow") + targetId polymorphic; rating 1-5, comment, createdBy
- `creator_payouts` — tracks grossRevenueCents, revenueSharePct (70%), payoutCents per creator per period

## Backend (artifacts/api-server/src/routes/marketplace-store.ts)
Registered in routes/index.ts as `marketplaceStoreRouter` (authenticated).

Key endpoints:
- GET  /marketplace/agents — search/filter/sort, auto-seeds 6 agents on first call
- GET  /marketplace/workflows — search/filter/sort, auto-seeds 6 workflows on first call
- POST /marketplace/agents/:id/install — clones into agentsTable, increments installCount
- POST /marketplace/workflows/:id/install — clones into workflowsTable + workflowStepsTable, increments installCount
- POST /marketplace/reviews — polymorphic review submission
- GET  /marketplace/creator-profile — stats + my agents/workflows + payouts
- GET  /marketplace/analytics — totals, top-5 agents/workflows
- PATCH /marketplace/agents/:id/status — verification status change

## Seed Data
6 agents: AI SDR Team Lead, Content Marketing AI, Customer Support AI, HR Recruiter AI, Market Research AI, Data Analyst AI
6 workflows: AI SDR Team, Marketing Team, Customer Support Team, Recruitment Team, Cold Email Campaign, Market Research Report
Seeds run once on first GET if table is empty and an org+user exist.

## Status Flow
draft → published → verified → featured (isFeatured boolean separate from status)

**Why:** Marketplace uses same DB org for seeded content; require first org+user to exist before seeding. If seeding fails silently, check that at least 1 org and 1 user exist in the DB.
