---
name: AI SDR Team Architecture
description: Sales module added on top of AI Workforce — tables, agents, routes, and frontend page.
---

# AI SDR Team Architecture

## DB Tables (lib/db/src/schema/)
- `sales_companies` — researched companies with ICP, pain points, competitors
- `sales_contacts` — generated leads linked to a company
- `sales_campaigns` — campaign with workflow step tracking and cost aggregation
- `sales_lead_lists` — junction of campaign + contact with full 4-email sequence

## AI Agents (artifacts/api-server/src/lib/sdr-agents.ts)
All agents use `gpt-4o-mini`, strict Zod validation, `response_format: json_object`.
- `runCompanyResearchAgent(website, productDescription)` → CompanyResearchOutputSchema
- `runLeadGenerationAgent(icp, industry, painPoints, targetCompany, count)` → LeadGenerationOutputSchema
- `runOutreachAgent(companyProfile, leadProfile)` → OutreachEmailSchema
- `runFollowUpAgent(originalEmail, leadProfile)` → FollowUpEmailsSchema

## API Routes (artifacts/api-server/src/routes/sales.ts)
- POST /api/sales/research
- POST /api/sales/leads
- POST /api/sales/emails
- POST /api/sales/campaign
- GET  /api/sales/campaign/:id
- GET  /api/sales/campaigns
- GET  /api/sales/companies
- GET  /api/sales/companies/:id/contacts
- GET  /api/sales/dashboard
- POST /api/sales/campaign/:id/ready
- GET  /api/sales/campaign/:id/export/csv
- GET  /api/sales/campaign/:id/export/excel (returns TSV with xls mime type — no external xlsx dep needed)

## Frontend (artifacts/ai-workforce-roadmap/src/pages/sales.tsx)
- Route: /sales, added to App.tsx nav as "AI SDR" with Zap icon
- Tabs: Dashboard | Campaigns | Companies
- Modal flows: ResearchForm → CampaignWizard (4-step) → CampaignDetailModal
- CampaignWizard steps: campaign → leads (with checkbox selection) → emails → done

**Why:** Excel export uses TSV + xls mime — avoids adding a zip/xlsx build dependency while still opening natively in Excel.
