import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Users, Mail, TrendingUp, Plus, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, Download, ExternalLink,
  Search, Target, Zap, FileSpreadsheet, Sparkles, ArrowRight,
  DollarSign, Hash, BarChart3, RefreshCw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Company = {
  id: number; website: string; name: string | null; productDescription: string | null;
  industry: string | null; icp: string | null; painPoints: string[] | null;
  competitors: string[] | null; researchStatus: string; createdAt: string;
};

type Contact = {
  id: number; companyId: number; name: string; title: string;
  company: string; reason: string | null; status: string;
};

type Campaign = {
  id: number; companyId: number; name: string; status: string;
  workflowStep: string; totalLeads: number; totalEmails: number;
  totalTokens: number; estimatedCost: number; createdAt: string;
};

type DashboardStats = {
  companies: number; contacts: number; campaigns: number;
  emails: number; totalCost: number; totalTokens: number;
};

type LeadList = {
  leadList: { id: number; emailSubject: string | null; emailBody: string | null; followup2: string | null; followup3: string | null; followup4: string | null; emailStatus: string };
  contact: Contact;
};

// ── API helpers ────────────────────────────────────────────────────────────

const api = {
  get: (path: string) => fetch(`/api${path}`).then(r => r.json()),
  post: (path: string, body: unknown) => fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json()),
};

// ── Utility Components ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "amber" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  };
  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

const STEP_ORDER = ["research", "leads", "emails", "review", "ready"];
const STEP_LABELS: Record<string, string> = {
  research: "Research", leads: "Leads", emails: "Emails", review: "Review", ready: "Ready",
};

function WorkflowBadge({ step }: { step: string }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-1">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${i < idx ? "bg-emerald-400" : i === idx ? "bg-amber-400 animate-pulse" : "bg-white/10"}`} />
          {i < STEP_ORDER.length - 1 && <div className="w-3 h-px bg-white/10" />}
        </div>
      ))}
      <span className="ml-1 text-xs text-slate-400">{STEP_LABELS[step] ?? step}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "running") return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
  if (status === "completed" || status === "ready") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "failed") return <AlertCircle className="w-4 h-4 text-red-400" />;
  return <div className="w-4 h-4 rounded-full border border-white/20" />;
}

// ── Research Form ──────────────────────────────────────────────────────────

function ResearchForm({ onDone }: { onDone: (company: Company) => void }) {
  const [website, setWebsite] = useState("");
  const [product, setProduct] = useState("");
  const [name, setName] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post("/sales/research", { website, productDescription: product, companyName: name || undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sales-dashboard"] });
      qc.invalidateQueries({ queryKey: ["sales-companies"] });
      if (data.company) onDone(data.company);
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Company Name (optional)</label>
        <input
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
          placeholder="Acme Corp"
          value={name} onChange={e => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Website *</label>
        <input
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
          placeholder="https://company.com"
          value={website} onChange={e => setWebsite(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Product / Service Description *</label>
        <textarea
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
          rows={3}
          placeholder="We help SaaS companies automate their customer onboarding..."
          value={product} onChange={e => setProduct(e.target.value)}
        />
      </div>
      <button
        disabled={!website || !product || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        {mutation.isPending ? "Researching company..." : "Research Company"}
      </button>
      {mutation.isError && <p className="text-xs text-red-400">Failed. Please try again.</p>}
    </div>
  );
}

// ── Campaign Wizard ────────────────────────────────────────────────────────

function CampaignWizard({ company, onClose }: { company: Company; onClose: () => void }) {
  const [step, setStep] = useState<"campaign" | "leads" | "emails" | "done">("campaign");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [leadCount, setLeadCount] = useState(10);
  const [campaignName, setCampaignName] = useState(`${company.name ?? company.website} Outreach`);
  const [log, setLog] = useState<string[]>([]);
  const qc = useQueryClient();

  const addLog = (msg: string) => setLog(p => [...p, msg]);

  const createCampaign = useMutation({
    mutationFn: () => api.post("/sales/campaign", { companyId: company.id, name: campaignName }),
    onSuccess: (data) => {
      setCampaign(data.campaign);
      setStep("leads");
      addLog(`✅ Campaign "${data.campaign.name}" created`);
    },
  });

  const generateLeads = useMutation({
    mutationFn: () => api.post("/sales/leads", { companyId: company.id, count: leadCount }),
    onSuccess: (data) => {
      setContacts(data.contacts ?? []);
      setSelectedContacts(new Set((data.contacts ?? []).map((c: Contact) => c.id)));
      addLog(`✅ Generated ${data.contacts?.length ?? 0} leads (${data.tokens} tokens, $${(data.cost ?? 0).toFixed(4)})`);
      qc.invalidateQueries({ queryKey: ["sales-dashboard"] });
    },
  });

  const generateEmails = useMutation({
    mutationFn: () => api.post("/sales/emails", {
      campaignId: campaign!.id,
      contactIds: Array.from(selectedContacts),
    }),
    onSuccess: (data) => {
      addLog(`✅ Generated ${data.results?.length ?? 0} email sequences (${data.totalTokens} tokens, $${(data.totalCost ?? 0).toFixed(4)})`);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["sales-dashboard"] });
      qc.invalidateQueries({ queryKey: ["sales-campaigns"] });
    },
  });

  const markReady = useMutation({
    mutationFn: () => api.post(`/sales/campaign/${campaign!.id}/ready`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-campaigns"] });
      onClose();
    },
  });

  return (
    <div className="space-y-4">
      {/* Workflow progress */}
      <div className="flex items-center gap-2 text-xs">
        {(["campaign", "leads", "emails", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border
              ${step === s ? "bg-amber-500/20 border-amber-500 text-amber-400" :
                ["campaign", "leads", "emails", "done"].indexOf(step) > i ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                "border-white/10 text-slate-600"}`}>
              {["campaign", "leads", "emails", "done"].indexOf(step) > i ? "✓" : i + 1}
            </div>
            <span className="text-slate-500 capitalize hidden sm:block">{s}</span>
            {i < 3 && <ArrowRight className="w-3 h-3 text-white/10" />}
          </div>
        ))}
      </div>

      {/* Company summary */}
      <div className="bg-black/30 border border-white/5 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">{company.name ?? company.website}</div>
            {company.industry && <div className="text-xs text-slate-400">{company.industry}</div>}
            {company.icp && <div className="text-xs text-slate-500 mt-1 line-clamp-2">ICP: {company.icp}</div>}
          </div>
        </div>
      </div>

      {/* Step: Create Campaign */}
      {step === "campaign" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Campaign Name</label>
            <input
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              value={campaignName} onChange={e => setCampaignName(e.target.value)}
            />
          </div>
          <button
            disabled={!campaignName || createCampaign.isPending}
            onClick={() => createCampaign.mutate()}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {createCampaign.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Campaign
          </button>
        </div>
      )}

      {/* Step: Generate Leads */}
      {step === "leads" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Number of leads to generate</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min={5} max={50} step={5}
                value={leadCount} onChange={e => setLeadCount(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-sm font-bold text-amber-400 w-6">{leadCount}</span>
            </div>
          </div>
          <button
            disabled={generateLeads.isPending}
            onClick={() => generateLeads.mutate()}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {generateLeads.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {generateLeads.isPending ? "Generating leads..." : "Generate Leads"}
          </button>
          {contacts.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-slate-400 sticky top-0 bg-black/80 py-1">
                <span>{selectedContacts.size} selected</span>
                <button onClick={() => setSelectedContacts(contacts.length === selectedContacts.size ? new Set() : new Set(contacts.map(c => c.id)))}
                  className="text-amber-400 hover:text-amber-300">Toggle all</button>
              </div>
              {contacts.map(c => (
                <label key={c.id} className="flex items-start gap-2 cursor-pointer group">
                  <input type="checkbox" checked={selectedContacts.has(c.id)}
                    onChange={e => {
                      const s = new Set(selectedContacts);
                      e.target.checked ? s.add(c.id) : s.delete(c.id);
                      setSelectedContacts(s);
                    }}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-white group-hover:text-amber-300 transition-colors">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.title} @ {c.company}</div>
                    {c.reason && <div className="text-xs text-slate-500 line-clamp-1">{c.reason}</div>}
                  </div>
                </label>
              ))}
              <button
                disabled={selectedContacts.size === 0 || generateEmails.isPending}
                onClick={() => { setStep("emails"); generateEmails.mutate(); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors mt-2"
              >
                {generateEmails.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Generate Emails for {selectedContacts.size} leads →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step: Generating Emails */}
      {step === "emails" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm text-slate-300">Writing personalized emails + follow-ups...</p>
          <p className="text-xs text-slate-500">This may take a minute</p>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2 py-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-sm font-semibold text-white">Campaign Ready!</p>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-1 text-xs text-slate-400">
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/sales/campaign/${campaign!.id}/export/csv`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-black/40 border border-white/10 hover:border-white/20 text-white rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </a>
            <a
              href={`/api/sales/campaign/${campaign!.id}/export/excel`}
              className="flex-1 flex items-center justify-center gap-1.5 bg-black/40 border border-white/10 hover:border-white/20 text-white rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </a>
            <button
              onClick={() => markReady.mutate()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Campaign Card ──────────────────────────────────────────────────────────

function CampaignCard({ campaign, company, onClick }: {
  campaign: Campaign; company: Company; onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 border border-white/10 hover:border-white/20 rounded-xl p-4 cursor-pointer transition-all group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{campaign.name}</div>
          <div className="text-xs text-slate-500">{company.name ?? company.website}</div>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
          campaign.status === "ready" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
          "bg-amber-500/10 border-amber-500/30 text-amber-400"
        }`}>{campaign.status}</span>
      </div>
      <WorkflowBadge step={campaign.workflowStep} />
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-slate-500">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{campaign.totalLeads} leads</span>
        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{campaign.totalEmails} emails</span>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${(campaign.estimatedCost ?? 0).toFixed(4)}</span>
      </div>
    </motion.div>
  );
}

// ── Campaign Detail Modal ──────────────────────────────────────────────────

function CampaignDetailModal({ campaignId, onClose }: { campaignId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-detail", campaignId],
    queryFn: () => api.get(`/sales/campaign/${campaignId}`),
  });
  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
    </div>
  );

  const { campaign, company, leadLists } = data ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-bold text-white">{campaign?.name}</h3>
          <p className="text-xs text-slate-400">{company?.name ?? company?.website} · {company?.industry}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/sales/campaign/${campaignId}/export/csv`}
            className="flex items-center gap-1 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-2.5 py-1.5 transition-colors">
            <Download className="w-3 h-3" /> CSV
          </a>
          <a href={`/api/sales/campaign/${campaignId}/export/excel`}
            className="flex items-center gap-1 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-2.5 py-1.5 transition-colors">
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{campaign?.totalLeads}</div>
          <div className="text-xs text-slate-500">Leads</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{campaign?.totalEmails}</div>
          <div className="text-xs text-slate-500">Emails</div>
        </div>
        <div className="bg-black/30 border border-white/5 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-amber-400">${(campaign?.estimatedCost ?? 0).toFixed(4)}</div>
          <div className="text-xs text-slate-500">Cost</div>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {(leadLists as LeadList[] ?? []).map(({ leadList, contact }) => (
          <div key={leadList.id} className="bg-black/30 border border-white/5 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
              onClick={() => setExpandedLead(expandedLead === leadList.id ? null : leadList.id)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">{contact.name}</div>
                <div className="text-xs text-slate-400">{contact.title} @ {contact.company}</div>
                {leadList.emailSubject && (
                  <div className="text-xs text-slate-500 mt-0.5 truncate">📧 {leadList.emailSubject}</div>
                )}
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${expandedLead === leadList.id ? "rotate-90" : ""}`} />
            </button>
            <AnimatePresence>
              {expandedLead === leadList.id && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-3 border-t border-white/5">
                    {[
                      { label: "Initial Email", body: leadList.emailBody, tag: "Day 1" },
                      { label: "Follow-up 2", body: leadList.followup2, tag: "Day 3" },
                      { label: "Follow-up 3", body: leadList.followup3, tag: "Day 7" },
                      { label: "Follow-up 4", body: leadList.followup4, tag: "Day 14" },
                    ].map(({ label, body, tag }) => body && (
                      <div key={label} className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-amber-400">{label}</span>
                          <span className="text-xs text-slate-600">{tag}</span>
                        </div>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans bg-black/20 rounded p-2">{body}</pre>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Modal =
  | { type: "new-research" }
  | { type: "wizard"; company: Company }
  | { type: "campaign-detail"; campaignId: number };

export default function SalesPage() {
  const [modal, setModal] = useState<Modal | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "campaigns" | "companies">("dashboard");

  const { data: dashData, refetch: refetchDash } = useQuery({
    queryKey: ["sales-dashboard"],
    queryFn: () => api.get("/sales/dashboard"),
    refetchInterval: 10000,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["sales-campaigns"],
    queryFn: () => api.get("/sales/campaigns"),
    refetchInterval: 5000,
  });

  const { data: companiesData } = useQuery({
    queryKey: ["sales-companies"],
    queryFn: () => api.get("/sales/companies"),
  });

  const stats: DashboardStats = dashData?.stats ?? { companies: 0, contacts: 0, campaigns: 0, emails: 0, totalCost: 0, totalTokens: 0 };
  const campaigns: { campaign: Campaign; company: Company }[] = campaignsData?.campaigns ?? [];
  const companies: Company[] = companiesData?.companies ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold text-white">AI SDR Team</h1>
            </div>
            <p className="text-sm text-slate-400">Research companies · Generate leads · Write outreach · Launch campaigns</p>
          </div>
          <button
            onClick={() => setModal({ type: "new-research" })}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard icon={Building2} label="Companies" value={stats.companies} color="amber" />
          <StatCard icon={Users} label="Leads" value={stats.contacts} color="blue" />
          <StatCard icon={TrendingUp} label="Campaigns" value={stats.campaigns} color="purple" />
          <StatCard icon={Mail} label="Emails" value={stats.emails} color="pink" />
          <StatCard icon={DollarSign} label="AI Cost" value={`$${(stats.totalCost ?? 0).toFixed(4)}`} color="emerald" />
          <StatCard icon={Hash} label="Tokens" value={(stats.totalTokens ?? 0).toLocaleString()} color="amber" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-white/10">
          {(["dashboard", "campaigns", "companies"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => refetchDash()}
            className="ml-auto p-2 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400">Recent Campaigns</h2>
            {campaigns.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No campaigns yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {campaigns.slice(0, 6).map(({ campaign, company }) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    company={company}
                    onClick={() => setModal({ type: "campaign-detail", campaignId: campaign.id })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <div className="grid md:grid-cols-2 gap-3">
            {campaigns.map(({ campaign, company }) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                company={company}
                onClick={() => setModal({ type: "campaign-detail", campaignId: campaign.id })}
              />
            ))}
            {campaigns.length === 0 && (
              <div className="col-span-2 text-center py-16 text-slate-600">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No campaigns yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === "companies" && (
          <div className="space-y-3">
            {companies.map(company => (
              <motion.div
                key={company.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-black/40 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{company.name ?? company.website}</div>
                    <a href={company.website} target="_blank" rel="noreferrer"
                      className="text-xs text-slate-500 hover:text-amber-400 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />{company.website}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={company.researchStatus} />
                    <button
                      onClick={() => setModal({ type: "wizard", company })}
                      disabled={company.researchStatus !== "completed"}
                      className="text-xs bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      Create Campaign
                    </button>
                  </div>
                </div>
                {company.industry && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full px-2 py-0.5">{company.industry}</span>
                    {(company.painPoints ?? []).slice(0, 2).map((p, i) => (
                      <span key={i} className="text-xs bg-white/5 border border-white/10 text-slate-400 rounded-full px-2 py-0.5 truncate max-w-xs">{p}</span>
                    ))}
                  </div>
                )}
                {company.icp && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">ICP: {company.icp}</p>
                )}
              </motion.div>
            ))}
            {companies.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No companies researched yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                {modal.type === "new-research" && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Search className="w-4 h-4 text-amber-400" />
                      <h2 className="font-bold text-white">Research a Company</h2>
                    </div>
                    <ResearchForm onDone={company => setModal({ type: "wizard", company })} />
                  </>
                )}
                {modal.type === "wizard" && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h2 className="font-bold text-white">Create Campaign</h2>
                    </div>
                    <CampaignWizard company={modal.company} onClose={() => setModal(null)} />
                  </>
                )}
                {modal.type === "campaign-detail" && (
                  <CampaignDetailModal campaignId={modal.campaignId} onClose={() => setModal(null)} />
                )}
                <button
                  onClick={() => setModal(null)}
                  className="mt-4 w-full text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
