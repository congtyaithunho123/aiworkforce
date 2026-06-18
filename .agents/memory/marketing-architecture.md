---
name: AI Marketing Team Architecture
description: Marketing module — 4 DB tables, 5 Zod-validated agents, 10 API routes, /marketing frontend page with step-by-step workflow runner.
---

# AI Marketing Team Architecture

## DB Tables (lib/db/src/schema/)
- `marketing_projects` — project with topic, audience, niche, workflowStep, status, cost tracking
- `marketing_research` — market trends, personas, competitor angles, content angles, summary (1:1 per project)
- `marketing_keywords` — primary/secondary/LSI keywords, suggested title, meta, keyword data (1:1 per project)
- `marketing_content` — full article: title, slug, body, seoScore, reviewScore, reviewStatus (1:1 per project)

## AI Agents (artifacts/api-server/src/lib/marketing-agents.ts)
All use gpt-4o-mini, strict Zod validation, response_format: json_object.
1. `runMarketResearchAgent(topic, audience, niche)` → MarketResearchOutputSchema
2. `runKeywordAnalysisAgent(topic, contentAngles, audience)` → KeywordAnalysisOutputSchema
3. `runContentAgent(topic, keywords, research, audience)` → ContentOutputSchema
4. `runSeoOptimizationAgent(body, primaryKw, secondaryKws, meta)` → SeoOptimizationOutputSchema (chained immediately after content)
5. `runReviewerAgent(title, body, audience, primaryKw)` → ReviewOutputSchema (approved if score >= 7.0)

## API Routes (artifacts/api-server/src/routes/marketing.ts)
- POST /api/marketing/project
- POST /api/marketing/research
- POST /api/marketing/keywords
- POST /api/marketing/content   (chains SEO optimization automatically)
- POST /api/marketing/review    (auto-advances to published step if approved)
- POST /api/marketing/publish
- GET  /api/marketing/projects
- GET  /api/marketing/project/:id
- GET  /api/marketing/dashboard
- GET  /api/marketing/project/:id/export/md
- GET  /api/marketing/project/:id/export/html

## Frontend (artifacts/ai-workforce-roadmap/src/pages/marketing.tsx)
- Route: /marketing, added to App.tsx nav as "AI Marketing" with Megaphone icon
- Tabs: Dashboard | Projects
- Modal flows: NewProjectForm → ProjectDetail (tabs: Workflow | Research | Keywords | Article)
- WorkflowRunner: step-by-step "Run" button per agent, live polling every 3s, log panel
- Reviewer auto-decides: approved (score ≥ 7) → published step; rejected → back to content

**Why:** Content + SEO are chained server-side in a single POST /content request to avoid extra round-trips; user only clicks once for those two steps combined.
