import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone, Search, KeySquare, PenLine, ShieldCheck, Rocket,
  Plus, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronRight,
  Download, FileText, Code2, BarChart3, DollarSign, Hash,
  RefreshCw, ArrowRight, Star, TrendingUp, Target, Lightbulb,
  BookOpen, Gauge,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: number; topic: string; targetAudience: string; niche: string;
  workflowStep: string; status: string;
  totalTokens: number; estimatedCost: number; createdAt: string;
};

type Research = {
  marketTrends: string[]; targetPersonas: string[];
  competitorAngles: string[]; contentAngles: string[]; summary: string;
};

type Keywords = {
  primaryKeyword: string; secondaryKeywords: string[]; lsiKeywords: string[];
  suggestedTitle: string; metaDescription: string;
  keywordData: Array<{ keyword: string; intent: string; difficulty: string; volume: string }>;
};

type Content = {
  title: string; slug: string; metaDescription: string;
  outline: string[]; body: string; wordCount: number;
  seoScore: number; seoSuggestions: string[];
  reviewScore: number; reviewFeedback: string; reviewStatus: string;
};

type ProjectDetail = { project: Project; research?: Research; keywords?: Keywords; content?: Content };

const api = {
  get: <T>(p: string) => apiFetch<T>(`/api${p}`),
  post: <T>(p: string, b: unknown) => apiFetch<T>(`/api${p}`, {
    method: "POST", body: JSON.stringify(b),
  }),
};

// ── Workflow config ───────────────────────────────────────────────────────────

const STEPS = [
  { key: "research",   label: "Research",   icon: Search,     agent: "Market Research Agent" },
  { key: "keywords",   label: "Keywords",   icon: KeySquare,  agent: "SEO Agent" },
  { key: "content",    label: "Content",    icon: PenLine,    agent: "Content + SEO Agent" },
  { key: "review",     label: "Review",     icon: ShieldCheck,agent: "Reviewer Agent" },
  { key: "published",  label: "Published",  icon: Rocket,     agent: "" },
];

const STEP_IDX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

// ── Utility components ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = "violet" }: {
  icon: React.ElementType; label: string; value: string | number; color?: string;
}) {
  const c: Record<string, string> = {
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
    amber:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
    pink:    "text-pink-400 bg-pink-500/10 border-pink-500/20",
  };
  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg border shrink-0 ${c[color]}`}><Icon className="w-4 h-4" /></div>
      <div><div className="text-lg font-bold text-white">{value}</div><div className="text-xs text-slate-500">{label}</div></div>
    </div>
  );
}

function WorkflowProgress({ step, status }: { step: string; status: string }) {
  const cur = STEP_IDX[step] ?? 0;
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < cur;
        const active = i === cur && status !== "published";
        const pub = step === "published";
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              pub || done ? "bg-emerald-400" : active ? "bg-violet-400 animate-pulse" : "bg-white/10"
            }`} />
            {i < STEPS.length - 1 && <div className="w-2 h-px bg-white/10" />}
          </div>
        );
      })}
      <span className="ml-1 text-xs text-slate-500">
        {step === "published" ? "Published" : STEPS[cur]?.label ?? step}
      </span>
    </div>
  );
}

function DifficultyPill({ val }: { val: string }) {
  const c = val === "low" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : val === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  return <span className={`text-xs px-1.5 py-0.5 rounded border ${c}`}>{val}</span>;
}

function SeoScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`text-2xl font-bold ${color}`}>{Math.round(score)}</div>
      <div className="text-xs text-slate-500">SEO Score</div>
    </div>
  );
}

// ── New Project Form ──────────────────────────────────────────────────────────

function NewProjectForm({ onDone }: { onDone: (p: Project) => void }) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [niche, setNiche] = useState("");
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => api.post("/marketing/project", { topic, targetAudience: audience, niche }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["mkt-dashboard"] }); if (d.project) onDone(d.project); },
  });

  return (
    <div className="space-y-3">
      {[
        { label: "Content Topic *", val: topic, set: setTopic, ph: "e.g. How to improve SaaS onboarding in 2025" },
        { label: "Target Audience *", val: audience, set: setAudience, ph: "e.g. SaaS product managers, B2B growth teams" },
        { label: "Niche / Industry *", val: niche, set: setNiche, ph: "e.g. Product-led growth, B2B SaaS" },
      ].map(({ label, val, set, ph }) => (
        <div key={label}>
          <label className="text-xs text-slate-400 block mb-1">{label}</label>
          <input
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
            placeholder={ph} value={val} onChange={e => set(e.target.value)}
          />
        </div>
      ))}
      <button
        disabled={!topic || !audience || !niche || create.isPending}
        onClick={() => create.mutate()}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
      >
        {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {create.isPending ? "Creating…" : "Create Project"}
      </button>
    </div>
  );
}

// ── Workflow Runner (step-by-step) ────────────────────────────────────────────

function WorkflowRunner({ project: initProject, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const [logs, setLogs] = useState<{ msg: string; type: "ok" | "info" | "err" }[]>([]);
  const addLog = (msg: string, type: "ok" | "info" | "err" = "info") => setLogs(p => [...p, { msg, type }]);

  const { data: detail, refetch } = useQuery<ProjectDetail>({
    queryKey: ["mkt-project", initProject.id],
    queryFn: () => api.get(`/marketing/project/${initProject.id}`),
    refetchInterval: 3000,
  });

  const project = detail?.project ?? initProject;
  const curIdx = STEP_IDX[project.workflowStep] ?? 0;
  const isRunning = project.status === "running";
  const isPublished = project.status === "published";

  const runStep = useMutation({
    mutationFn: async (step: string) => {
      const endpoints: Record<string, string> = {
        research: "/marketing/research",
        keywords: "/marketing/keywords",
        content: "/marketing/content",
        review: "/marketing/review",
      };
      const ep = endpoints[step];
      if (!ep) throw new Error(`Unknown step: ${step}`);
      addLog(`Running ${STEPS.find(s => s.key === step)?.agent ?? step}…`, "info");
      return api.post(ep, { projectId: project.id });
    },
    onSuccess: (data, step) => {
      const agent = STEPS.find(s => s.key === step)?.agent ?? step;
      const tok = data.tokens ?? 0;
      const cost = (data.cost ?? 0).toFixed(4);
      addLog(`✅ ${agent} complete — ${tok} tokens, $${cost}`, "ok");
      qc.invalidateQueries({ queryKey: ["mkt-project", project.id] });
      qc.invalidateQueries({ queryKey: ["mkt-dashboard"] });
      qc.invalidateQueries({ queryKey: ["mkt-projects"] });
      refetch();
    },
    onError: (err: Error, step) => {
      addLog(`❌ ${step} failed: ${err.message}`, "err");
    },
  });

  const publish = useMutation({
    mutationFn: () => api.post("/marketing/publish", { projectId: project.id }),
    onSuccess: () => {
      addLog("🚀 Published!", "ok");
      qc.invalidateQueries({ queryKey: ["mkt-project", project.id] });
      qc.invalidateQueries({ queryKey: ["mkt-projects"] });
      qc.invalidateQueries({ queryKey: ["mkt-dashboard"] });
    },
  });

  const nextStep = STEPS[curIdx]?.key;
  const canRunNext = !isRunning && !isPublished && nextStep && nextStep !== "published";

  return (
    <div className="space-y-4">
      {/* Pipeline */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEPS.map((s, i) => {
          const done = i < curIdx || isPublished;
          const active = i === curIdx && !isPublished;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-all ${
                done ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : active ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                  : "bg-white/3 border-white/8 text-slate-600"
              }`}>
                {isRunning && active ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-white/15" />}
            </div>
          );
        })}
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div className="bg-black/50 border border-white/5 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className={`text-xs ${l.type === "ok" ? "text-emerald-400" : l.type === "err" ? "text-red-400" : "text-slate-400"}`}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {/* Content preview */}
      {detail?.content && (
        <div className="bg-black/30 border border-white/5 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white line-clamp-1">{detail.content.title}</div>
            <div className="flex items-center gap-2">
              {detail.content.seoScore != null && <SeoScoreRing score={detail.content.seoScore} />}
              {detail.content.reviewScore != null && (
                <div className="flex flex-col items-center gap-0.5">
                  <div className={`text-2xl font-bold ${detail.content.reviewScore >= 7 ? "text-emerald-400" : "text-amber-400"}`}>
                    {detail.content.reviewScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-slate-500">Review</div>
                </div>
              )}
            </div>
          </div>
          {detail.content.reviewStatus === "approved" && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approved by Reviewer Agent
            </div>
          )}
          {detail.content.reviewStatus === "needs_revision" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" /> Needs revision — will re-run content generation
            </div>
          )}
          {detail.content.reviewFeedback && (
            <p className="text-xs text-slate-400 line-clamp-2">{detail.content.reviewFeedback}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {!isPublished && (
          <button
            disabled={!canRunNext || runStep.isPending}
            onClick={() => nextStep && runStep.mutate(nextStep)}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {runStep.isPending || isRunning
              ? <><Loader2 className="w-4 h-4 animate-spin" />Running agent…</>
              : <><ArrowRight className="w-4 h-4" />Run: {STEPS[curIdx]?.label ?? "Next Step"}</>}
          </button>
        )}

        {(project.workflowStep === "published" || detail?.content?.reviewStatus === "approved") && !isPublished && (
          <button
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {publish.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Publish Draft
          </button>
        )}

        {detail?.content && (
          <div className="flex gap-2">
            <a href={`/api/marketing/project/${project.id}/export/md`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-3 py-2 transition-colors">
              <Download className="w-3 h-3" /> Markdown
            </a>
            <a href={`/api/marketing/project/${project.id}/export/html`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-3 py-2 transition-colors">
              <Code2 className="w-3 h-3" /> HTML
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Project Detail Panel ──────────────────────────────────────────────────────

function ProjectDetail({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [tab, setTab] = useState<"workflow" | "research" | "keywords" | "content">("workflow");

  const { data, isLoading } = useQuery<ProjectDetail>({
    queryKey: ["mkt-project", projectId],
    queryFn: () => api.get(`/marketing/project/${projectId}`),
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-violet-400 animate-spin" /></div>;

  const { project, research, keywords, content } = data ?? {};
  if (!project) return null;

  const tabs = [
    { key: "workflow", label: "Workflow", show: true },
    { key: "research", label: "Research", show: !!research },
    { key: "keywords", label: "Keywords", show: !!keywords },
    { key: "content",  label: "Article",  show: !!content },
  ] as const;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-white text-sm line-clamp-2">{project.topic}</h3>
        <p className="text-xs text-slate-500">{project.targetAudience} · {project.niche}</p>
      </div>

      <div className="flex gap-1 border-b border-white/8">
        {tabs.filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-violet-500 text-violet-400" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "workflow" && <WorkflowRunner project={project} onClose={onClose} />}

      {tab === "research" && research && (
        <div className="space-y-3 text-sm">
          <Section title="Market Summary" icon={BarChart3}>
            <p className="text-slate-300 text-xs leading-relaxed">{research.summary}</p>
          </Section>
          <Section title="Market Trends" icon={TrendingUp}>
            <ul className="space-y-1">{research.marketTrends?.map((t, i) => <Li key={i}>{t}</Li>)}</ul>
          </Section>
          <Section title="Target Personas" icon={Target}>
            <ul className="space-y-1">{research.targetPersonas?.map((t, i) => <Li key={i}>{t}</Li>)}</ul>
          </Section>
          <Section title="Content Angles" icon={Lightbulb}>
            <ul className="space-y-1">{research.contentAngles?.map((t, i) => <Li key={i}>{t}</Li>)}</ul>
          </Section>
        </div>
      )}

      {tab === "keywords" && keywords && (
        <div className="space-y-3">
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
            <div className="text-xs text-violet-400 mb-1">Primary Keyword</div>
            <div className="text-base font-bold text-white">{keywords.primaryKeyword}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Suggested Title</div>
            <div className="text-sm font-semibold text-white">{keywords.suggestedTitle}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5">Meta Description</div>
            <p className="text-xs text-slate-300">{keywords.metaDescription}</p>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-2">Keyword Analysis</div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {keywords.keywordData?.map((kw, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-2.5 py-1.5">
                  <span className="text-white flex-1 min-w-0 truncate">{kw.keyword}</span>
                  <span className="text-slate-500 shrink-0">{kw.intent}</span>
                  <DifficultyPill val={kw.difficulty} />
                  <span className={`shrink-0 ${kw.volume === "high" ? "text-emerald-400" : kw.volume === "medium" ? "text-amber-400" : "text-slate-500"}`}>
                    {kw.volume} vol
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5">LSI Keywords</div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.lsiKeywords?.map((k, i) => (
                <span key={i} className="text-xs bg-white/5 border border-white/10 text-slate-400 rounded-full px-2 py-0.5">{k}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "content" && content && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {content.seoScore != null && <SeoScoreRing score={content.seoScore} />}
            {content.reviewScore != null && (
              <div className="flex flex-col items-center gap-0.5">
                <div className={`text-2xl font-bold flex items-center gap-1 ${content.reviewScore >= 7 ? "text-emerald-400" : "text-amber-400"}`}>
                  <Star className="w-4 h-4" />{content.reviewScore.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500">Review Score</div>
              </div>
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div className="text-2xl font-bold text-blue-400">{(content.wordCount ?? 0).toLocaleString()}</div>
              <div className="text-xs text-slate-500">Words</div>
            </div>
          </div>

          {content.reviewFeedback && (
            <div className={`text-xs rounded-lg p-2.5 border ${
              content.reviewStatus === "approved" ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
                : "bg-amber-500/8 border-amber-500/20 text-amber-300"
            }`}>
              {content.reviewFeedback}
            </div>
          )}

          {content.seoSuggestions?.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1.5">SEO Improvements</div>
              <ul className="space-y-1">{content.seoSuggestions.map((s, i) => <Li key={i}>{s}</Li>)}</ul>
            </div>
          )}

          <div>
            <div className="text-xs text-slate-500 mb-1.5">Article</div>
            <div className="bg-black/40 border border-white/5 rounded-lg p-3 max-h-64 overflow-y-auto">
              <h2 className="text-sm font-bold text-white mb-2">{content.title}</h2>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{content.body}</pre>
            </div>
          </div>

          <div className="flex gap-2">
            <a href={`/api/marketing/project/${projectId}/export/md`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-3 py-2 transition-colors">
              <Download className="w-3 h-3" /> Markdown
            </a>
            <a href={`/api/marketing/project/${projectId}/export/html`}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-black/40 border border-white/10 hover:border-white/20 text-slate-300 rounded-lg px-3 py-2 transition-colors">
              <Code2 className="w-3 h-3" /> HTML
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-slate-300">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return <li className="flex items-start gap-1.5 text-xs text-slate-400"><span className="text-violet-500 mt-0.5 shrink-0">▸</span>{children}</li>;
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const isPublished = project.status === "published";
  const isFailed = project.status === "failed";
  const isRunning = project.status === "running";
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-black/40 border border-white/10 hover:border-violet-500/30 rounded-xl p-4 cursor-pointer transition-all group"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-2">{project.topic}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{project.targetAudience}</div>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${
          isPublished ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : isFailed ? "bg-red-500/10 border-red-500/30 text-red-400"
            : isRunning ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
            : "bg-white/5 border-white/10 text-slate-400"
        }`}>
          {isRunning && <Loader2 className="w-2.5 h-2.5 inline mr-1 animate-spin" />}
          {project.status}
        </span>
      </div>
      <WorkflowProgress step={project.workflowStep} status={project.status} />
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5 text-xs text-slate-600">
        <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{(project.totalTokens ?? 0).toLocaleString()}</span>
        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${(project.estimatedCost ?? 0).toFixed(4)}</span>
        <span className="ml-auto flex items-center gap-1 text-violet-600 group-hover:text-violet-400 transition-colors">
          Open <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Modal =
  | { type: "new" }
  | { type: "detail"; projectId: number };

export default function MarketingPage() {
  const [modal, setModal] = useState<Modal | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects">("dashboard");

  const { data: dashData, refetch } = useQuery({
    queryKey: ["mkt-dashboard"],
    queryFn: () => api.get("/marketing/dashboard"),
    refetchInterval: 8000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["mkt-projects"],
    queryFn: () => api.get("/marketing/projects"),
    refetchInterval: 5000,
  });

  const stats = dashData?.stats ?? { projects: 0, published: 0, articles: 0, totalCost: 0, totalTokens: 0 };
  const projects: Project[] = projectsData?.projects ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-5 h-5 text-violet-400" />
              <h1 className="text-xl font-bold text-white">AI Marketing Team</h1>
            </div>
            <p className="text-sm text-slate-400">Research · Keywords · Content · SEO · Review · Publish</p>
          </div>
          <button
            onClick={() => setModal({ type: "new" })}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New Content
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard icon={BookOpen}    label="Projects"    value={stats.projects}                            color="violet" />
          <StatCard icon={Rocket}      label="Published"   value={stats.published}                           color="emerald" />
          <StatCard icon={FileText}    label="Articles"    value={stats.articles}                            color="blue" />
          <StatCard icon={DollarSign}  label="AI Cost"     value={`$${(stats.totalCost ?? 0).toFixed(4)}`}  color="amber" />
          <StatCard icon={Hash}        label="Tokens"      value={(stats.totalTokens ?? 0).toLocaleString()} color="pink" />
        </div>

        {/* Agents legend */}
        <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-black/30 border border-white/5 rounded-xl">
          <span className="text-xs text-slate-500 mr-1">Agents:</span>
          {STEPS.filter(s => s.agent).map(s => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-xs bg-violet-500/8 border border-violet-500/15 text-violet-300 rounded-full px-2.5 py-1">
                <Icon className="w-3 h-3" /> {s.agent}
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-white/10">
          {(["dashboard", "projects"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === t ? "border-violet-500 text-violet-400" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}>{t}</button>
          ))}
          <button onClick={() => refetch()} className="ml-auto p-2 text-slate-600 hover:text-slate-300 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-400">Recent Projects</h2>
            {projects.length === 0 ? (
              <div className="text-center py-16 text-slate-600">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No projects yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {projects.slice(0, 6).map(p => (
                  <ProjectCard key={p.id} project={p} onClick={() => setModal({ type: "detail", projectId: p.id })} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects */}
        {activeTab === "projects" && (
          <div className="grid md:grid-cols-2 gap-3">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => setModal({ type: "detail", projectId: p.id })} />
            ))}
            {projects.length === 0 && (
              <div className="col-span-2 text-center py-16 text-slate-600">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No projects yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={() => setModal(null)} />
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
                {modal.type === "new" && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <PenLine className="w-4 h-4 text-violet-400" />
                      <h2 className="font-bold text-white">New Content Project</h2>
                    </div>
                    <NewProjectForm onDone={p => setModal({ type: "detail", projectId: p.id })} />
                  </>
                )}
                {modal.type === "detail" && (
                  <ProjectDetail projectId={modal.projectId} onClose={() => setModal(null)} />
                )}
                <button onClick={() => setModal(null)}
                  className="mt-4 w-full text-xs text-slate-600 hover:text-slate-400 transition-colors">
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
