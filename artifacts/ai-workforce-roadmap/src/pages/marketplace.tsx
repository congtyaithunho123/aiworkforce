import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Store, Bot, GitMerge, Clock, Zap, Plus, ChevronRight, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface AgentTemplate {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  model: string;
  tags: string[];
  useCount: number;
}

interface WorkflowTemplate {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  steps: { name: string; agentRole: string }[];
  tags: string[];
  useCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  sales: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  marketing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  hr: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  support: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  research: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  general: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Sales",
  marketing: "Marketing",
  hr: "HR",
  support: "Support",
  research: "Research",
  general: "General",
};

function AgentCard({ t }: { t: AgentTemplate }) {
  const { toast } = useToast();
  const [agentName, setAgentName] = useState(t.displayName);
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();

  const cloneMutation = useMutation({
    mutationFn: () => apiFetch(`/api/agent-templates/${t.id}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: agentName }),
    }),
    onSuccess: () => {
      toast({ title: `Agent "${agentName}" đã được tạo!`, description: "Vào Dashboard → Agents để xem." });
      qc.invalidateQueries({ queryKey: ["agents"] });
      setShowModal(false);
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const colorClass = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.general;

  return (
    <>
      <div className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col gap-3 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-amber-400" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
                {CATEGORY_LABELS[t.category] ?? t.category}
              </span>
            </div>
            <h3 className="font-semibold text-white text-sm">{t.displayName}</h3>
          </div>
          <span className="text-xs text-slate-500">{t.model}</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed flex-1">{t.description}</p>
        <div className="flex flex-wrap gap-1">
          {(t.tags ?? []).map(tag => (
            <span key={tag} className="text-[10px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded">#{tag}</span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-600">{t.useCount} lần dùng</span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" /> Dùng template
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-white">Tạo Agent từ template</h3>
            <p className="text-sm text-slate-400">Template: <span className="text-white">{t.displayName}</span></p>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tên Agent</label>
              <input
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => cloneMutation.mutate()}
                disabled={!agentName || cloneMutation.isPending}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
              >
                {cloneMutation.isPending ? "Đang tạo..." : "Tạo Agent"}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 text-sm text-slate-400">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WorkflowTemplateCard({ t }: { t: WorkflowTemplate }) {
  const { toast } = useToast();
  const [name, setName] = useState(t.displayName);
  const [showModal, setShowModal] = useState(false);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const importMutation = useMutation({
    mutationFn: () => apiFetch(`/api/workflow-templates/${t.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
    onSuccess: () => {
      toast({ title: `Workflow "${name}" đã được tạo!`, description: "Vào Workflows để chạy." });
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setShowModal(false);
      navigate("/workflows");
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const colorClass = CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.general;

  return (
    <>
      <div className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 flex flex-col gap-3 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitMerge className="w-4 h-4 text-blue-400" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClass}`}>
                {CATEGORY_LABELS[t.category] ?? t.category}
              </span>
            </div>
            <h3 className="font-semibold text-white text-sm">{t.displayName}</h3>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-xs">
            <Clock className="w-3 h-3" /> ~{t.estimatedMinutes}m
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed flex-1">{t.description}</p>

        {/* Steps preview */}
        <div className="space-y-1">
          {(t.steps ?? []).slice(0, 3).map((step, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-4 h-4 bg-white/10 rounded-full flex items-center justify-center text-[9px] text-slate-400 flex-shrink-0">{i + 1}</span>
              {step.name}
            </div>
          ))}
          {(t.steps ?? []).length > 3 && (
            <p className="text-xs text-slate-600 pl-5">+{t.steps.length - 3} bước nữa</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-600">{t.useCount} lần dùng</span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
          >
            <ArrowRight className="w-3 h-3" /> Import
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold text-white">Import Workflow Template</h3>
            <p className="text-sm text-slate-400">Template: <span className="text-white">{t.displayName}</span></p>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tên Workflow</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => importMutation.mutate()}
                disabled={!name || importMutation.isPending}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
              >
                {importMutation.isPending ? "Đang import..." : "Import"}
              </button>
              <button onClick={() => setShowModal(false)} className="px-4 text-sm text-slate-400">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const CATEGORIES = ["all", "sales", "marketing", "research", "hr", "support"];

export default function MarketplacePage() {
  const [tab, setTab] = useState<"agents" | "workflows">("agents");
  const [category, setCategory] = useState("all");

  const { data: agentTemplates = [], isLoading: loadingAgents } = useQuery<AgentTemplate[]>({
    queryKey: ["agent-templates", category],
    queryFn: () => apiFetch(`/api/agent-templates${category !== "all" ? `?category=${category}` : ""}`),
  });

  const { data: workflowTemplates = [], isLoading: loadingWorkflows } = useQuery<WorkflowTemplate[]>({
    queryKey: ["workflow-templates", category],
    queryFn: () => apiFetch(`/api/workflow-templates${category !== "all" ? `?category=${category}` : ""}`),
  });

  const isLoading = tab === "agents" ? loadingAgents : loadingWorkflows;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Store className="w-6 h-6" /> Agent Marketplace
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Templates dựng sẵn — clone agent hoặc import workflow chỉ trong 1 click
        </p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2">
        {(["agents", "workflows"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            {t === "agents" ? <Bot className="w-4 h-4" /> : <GitMerge className="w-4 h-4" />}
            {t === "agents" ? "Agent Templates" : "Workflow Templates"}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
              category === c
                ? "bg-white/15 text-white border border-white/30"
                : "text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20"
            }`}
          >
            {c === "all" ? "Tất cả" : CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 h-48 animate-pulse" />
          ))}
        </div>
      ) : tab === "agents" ? (
        agentTemplates.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Không có agent template nào trong danh mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentTemplates.map(t => <AgentCard key={t.id} t={t} />)}
          </div>
        )
      ) : (
        workflowTemplates.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <GitMerge className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Không có workflow template nào trong danh mục này</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflowTemplates.map(t => <WorkflowTemplateCard key={t.id} t={t} />)}
          </div>
        )
      )}
    </div>
  );
}
