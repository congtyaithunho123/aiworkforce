---
name: Production-Ready Upgrade
description: pg-boss job queue, SSE real-time dashboard, observability, agent eval, prompt versioning, marketplace, cost control — all built in one session
---

## What was built

### Job Queue — pg-boss
- Import: `import { PgBoss } from "pg-boss"` (named export, NOT default)
- pg-boss must be added to `external` in build.mjs (ESM format can't bundle it)
- `startQueue()` must call `boss.createQueue(name)` for EACH queue after `boss.start()` — pg-boss v10+ requires explicit queue creation or workers throw "Queue X does not exist"
- 4 queues: task-execution, workflow-execution, email-generation, lead-generation

### SSE Real-time
- `lib/events.ts` — singleton EventEmitter
- `routes/stream.ts` — GET /api/stream, auth accepts Bearer header OR `?token=` query param
- `components/LiveActivity.tsx` — EventSource reads `localStorage.getItem("access_token")`
- Integrated into dashboard.tsx Overview tab above the success rate bar

### New DB tables (all pushed)
- `execution_metrics` — daily aggregation per org/agent
- `agent_templates` — marketplace templates
- `workflow_templates` — pre-built workflow templates
- `prompt_versions` — versioned system prompts per agent
- `executions` extended: durationMs, qualityScore, accuracyScore, completenessScore, errorMessage
- `organizations` extended: monthlyBudget, budgetWarningThreshold, stopOnBudgetExceed

### New API routes
- GET /api/stream — SSE endpoint
- GET /api/analytics/metrics — observability
- GET/POST /api/agent-templates — marketplace + seed (6 templates)
- GET/POST /api/workflow-templates — templates + seed (4 templates)
- GET/POST /api/prompt-versions/:agentId — versioning + rollback
- GET/PUT /api/cost-control — budget settings + check

### Frontend pages
- `/marketplace` — agent + workflow templates, clone 1-click

**Why:** pg-boss over BullMQ because Redis is unavailable on Replit free tier; pg-boss provides identical queue semantics over PostgreSQL.

**How to apply:** When adding new queues, always add `boss.createQueue(name)` in `startQueue()`. When importing pg-boss, always use named import `{ PgBoss }`.
