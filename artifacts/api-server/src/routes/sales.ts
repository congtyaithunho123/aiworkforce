import { Router } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, companiesTable, contactsTable, campaignsTable, leadListsTable } from "@workspace/db";
import {
  runCompanyResearchAgent,
  runLeadGenerationAgent,
  runOutreachAgent,
  runFollowUpAgent,
} from "../lib/sdr-agents";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router = Router();

const ResearchBodySchema = z.object({
  website: z.string().min(1),
  productDescription: z.string().min(1),
  companyName: z.string().optional(),
});

router.post("/sales/research", async (req, res) => {
  const parsed = ResearchBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { website, productDescription, companyName } = parsed.data;

  const [company] = await db.insert(companiesTable).values({
    organizationId: orgId,
    website,
    productDescription,
    name: companyName ?? website,
    researchStatus: "running",
  }).returning();

  try {
    const { output, tokens, cost } = await runCompanyResearchAgent(website, productDescription);

    const [updated] = await db.update(companiesTable).set({
      industry: output.industry,
      icp: output.icp,
      painPoints: output.painPoints,
      competitors: output.competitors,
      researchStatus: "completed",
      rawResearch: JSON.stringify(output),
    }).where(eq(companiesTable.id, company.id)).returning();

    return res.json({ company: updated, tokens, cost });
  } catch (err) {
    await db.update(companiesTable).set({ researchStatus: "failed" }).where(eq(companiesTable.id, company.id));
    logger.error({ err }, "Research agent failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Research failed" });
  }
});

const LeadsBodySchema = z.object({
  companyId: z.number().int().positive(),
  count: z.number().int().min(1).max(50).optional().default(10),
});

router.post("/sales/leads", async (req, res) => {
  const parsed = LeadsBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { companyId, count } = parsed.data;

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(404).json({ error: "Company not found" });
  if (!company.icp) return res.status(400).json({ error: "Company research not completed yet" });

  try {
    const { output, tokens, cost } = await runLeadGenerationAgent(
      company.icp!,
      company.industry ?? "",
      (company.painPoints as string[]) ?? [],
      company.name ?? company.website,
      count,
    );

    const inserted = await db.insert(contactsTable).values(
      output.leads.map((l) => ({
        companyId,
        name: l.name,
        title: l.title,
        company: l.company,
        reason: l.reason,
      })),
    ).returning();

    return res.json({ contacts: inserted, tokens, cost });
  } catch (err) {
    logger.error({ err }, "Lead generation failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Lead generation failed" });
  }
});

const EmailsBodySchema = z.object({
  campaignId: z.number().int().positive(),
  contactIds: z.array(z.number().int().positive()).min(1),
});

router.post("/sales/emails", async (req, res) => {
  const parsed = EmailsBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { campaignId, contactIds } = parsed.data;

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, campaign.companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(404).json({ error: "Company not found" });

  const contacts = await db.select().from(contactsTable).where(
    sql`${contactsTable.id} = ANY(${contactIds})`,
  );

  let totalTokens = 0;
  let totalCost = 0;
  const results: { contactId: number; leadListId: number }[] = [];

  for (const contact of contacts) {
    try {
      const companyProfile = {
        website: company.website,
        icp: company.icp ?? "",
        painPoints: (company.painPoints as string[]) ?? [],
        industry: company.industry ?? "",
      };
      const leadProfile = { name: contact.name, company: contact.company, title: contact.title, reason: contact.reason ?? "" };

      const outreach = await runOutreachAgent(companyProfile, leadProfile);
      totalTokens += outreach.tokens;
      totalCost += outreach.cost;

      const followUp = await runFollowUpAgent(outreach.output.email, leadProfile);
      totalTokens += followUp.tokens;
      totalCost += followUp.cost;

      const [leadEntry] = await db.insert(leadListsTable).values({
        campaignId,
        contactId: contact.id,
        emailSubject: outreach.output.subject,
        emailBody: outreach.output.email,
        followup2: followUp.output.followup2,
        followup3: followUp.output.followup3,
        followup4: followUp.output.followup4,
        emailStatus: "ready",
      }).returning();

      results.push({ contactId: contact.id, leadListId: leadEntry.id });
    } catch (err) {
      logger.error({ err, contactId: contact.id }, "Email generation failed for contact");
    }
  }

  await db.update(campaignsTable).set({
    totalEmails: sql`${campaignsTable.totalEmails} + ${results.length}`,
    totalTokens: sql`${campaignsTable.totalTokens} + ${totalTokens}`,
    estimatedCost: sql`${campaignsTable.estimatedCost} + ${totalCost}`,
    workflowStep: "review",
  }).where(eq(campaignsTable.id, campaignId));

  return res.json({ results, totalTokens, totalCost });
});

const CampaignBodySchema = z.object({
  companyId: z.number().int().positive(),
  name: z.string().min(1),
});

router.post("/sales/campaign", async (req, res) => {
  const parsed = CampaignBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const orgId = req.user!.organizationId;
  const { companyId, name } = parsed.data;

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(404).json({ error: "Company not found" });

  const [campaign] = await db.insert(campaignsTable).values({
    companyId,
    name,
    workflowStep: "research",
  }).returning();

  return res.status(201).json({ campaign });
});

router.get("/sales/campaign/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, campaign.companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(403).json({ error: "Access denied" });

  const leadLists = await db
    .select({ leadList: leadListsTable, contact: contactsTable })
    .from(leadListsTable)
    .innerJoin(contactsTable, eq(leadListsTable.contactId, contactsTable.id))
    .where(eq(leadListsTable.campaignId, id));

  return res.json({ campaign, company, leadLists });
});

router.get("/sales/campaigns", async (req, res) => {
  const orgId = req.user!.organizationId;
  const campaigns = await db
    .select({ campaign: campaignsTable, company: companiesTable })
    .from(campaignsTable)
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ))
    .orderBy(desc(campaignsTable.createdAt));

  return res.json({ campaigns });
});

router.get("/sales/companies", async (req, res) => {
  const orgId = req.user!.organizationId;
  const companies = await db.select().from(companiesTable)
    .where(eq(companiesTable.organizationId, orgId))
    .orderBy(desc(companiesTable.createdAt));
  return res.json({ companies });
});

router.get("/sales/companies/:id/contacts", async (req, res) => {
  const id = parseInt(req.params.id);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(403).json({ error: "Access denied" });

  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.companyId, id));
  return res.json({ contacts });
});

router.get("/sales/dashboard", async (req, res) => {
  const orgId = req.user!.organizationId;

  const [companiesCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(companiesTable).where(eq(companiesTable.organizationId, orgId));

  const [contactsCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(contactsTable)
    .innerJoin(companiesTable, and(
      eq(contactsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ));

  const [campaignsCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(campaignsTable)
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ));

  const [emailsCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(leadListsTable)
    .innerJoin(campaignsTable, eq(leadListsTable.campaignId, campaignsTable.id))
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ));

  const [costAgg] = await db.select({ total: sql<number>`coalesce(sum(${campaignsTable.estimatedCost}), 0)` })
    .from(campaignsTable)
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ));

  const [tokensAgg] = await db.select({ total: sql<number>`coalesce(sum(${campaignsTable.totalTokens}), 0)` })
    .from(campaignsTable)
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ));

  const recentCampaigns = await db
    .select({ campaign: campaignsTable, company: companiesTable })
    .from(campaignsTable)
    .innerJoin(companiesTable, and(
      eq(campaignsTable.companyId, companiesTable.id),
      eq(companiesTable.organizationId, orgId),
    ))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(5);

  return res.json({
    stats: {
      companies: companiesCount.count,
      contacts: contactsCount.count,
      campaigns: campaignsCount.count,
      emails: emailsCount.count,
      totalCost: costAgg.total,
      totalTokens: tokensAgg.total,
    },
    recentCampaigns,
  });
});

router.get("/sales/campaign/:id/export/csv", async (req, res) => {
  const id = parseInt(req.params.id);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, campaign.companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(403).json({ error: "Access denied" });

  const leadLists = await db
    .select({ leadList: leadListsTable, contact: contactsTable })
    .from(leadListsTable)
    .innerJoin(contactsTable, eq(leadListsTable.contactId, contactsTable.id))
    .where(eq(leadListsTable.campaignId, id));

  const headers = ["Name", "Title", "Company", "Reason", "Subject", "Email Body", "Followup 2", "Followup 3", "Followup 4"];
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = leadLists.map(({ contact, leadList }: { contact: typeof contactsTable.$inferSelect; leadList: typeof leadListsTable.$inferSelect }) => [
    escape(contact.name), escape(contact.title), escape(contact.company), escape(contact.reason),
    escape(leadList.emailSubject), escape(leadList.emailBody),
    escape(leadList.followup2), escape(leadList.followup3), escape(leadList.followup4),
  ].join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}.csv"`);
  return res.send(csv);
});

router.post("/sales/campaign/:id/ready", async (req, res) => {
  const id = parseInt(req.params.id);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, campaign.companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(403).json({ error: "Access denied" });

  const [updated] = await db.update(campaignsTable)
    .set({ status: "ready", workflowStep: "ready" })
    .where(eq(campaignsTable.id, id))
    .returning();

  return res.json({ campaign: updated });
});

router.get("/sales/campaign/:id/export/excel", async (req, res) => {
  const id = parseInt(req.params.id);
  const orgId = req.user!.organizationId;
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  const [company] = await db.select().from(companiesTable)
    .where(and(eq(companiesTable.id, campaign.companyId), eq(companiesTable.organizationId, orgId)));
  if (!company) return res.status(403).json({ error: "Access denied" });

  const leadLists = await db
    .select({ leadList: leadListsTable, contact: contactsTable })
    .from(leadListsTable)
    .innerJoin(contactsTable, eq(leadListsTable.contactId, contactsTable.id))
    .where(eq(leadListsTable.campaignId, id));

  const headers = ["Name", "Title", "Company", "Reason", "Subject", "Email Body", "Followup 2", "Followup 3", "Followup 4"];
  const tsv = [
    headers.join("\t"),
    ...leadLists.map(({ contact, leadList }: { contact: typeof contactsTable.$inferSelect; leadList: typeof leadListsTable.$inferSelect }) => [
      contact.name, contact.title, contact.company, contact.reason ?? "",
      leadList.emailSubject ?? "", leadList.emailBody ?? "",
      leadList.followup2 ?? "", leadList.followup3 ?? "", leadList.followup4 ?? "",
    ].join("\t")),
  ].join("\n");

  res.setHeader("Content-Type", "application/vnd.ms-excel");
  res.setHeader("Content-Disposition", `attachment; filename="campaign-${id}.xls"`);
  return res.send(tsv);
});

export default router;
