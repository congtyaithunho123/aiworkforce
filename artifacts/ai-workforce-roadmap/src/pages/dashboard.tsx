import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Bot, Workflow, BarChart3, DollarSign, Zap,
  CheckCircle2, XCircle, Clock, AlertCircle, TrendingUp,
  Users, Wrench, Star, ChevronDown, ChevronUp, Play,
  Plus, Loader2, Shield, Activity, Target, Award,
  ArrowUpRight, Layers, GitMerge, RefreshCw, Briefcase
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { LiveActivity } from "@/components/LiveActivity";

type Org = { id: number; name: string; description?: string };
type Agent = {
  id: number; organizationId: number; name: string; role: string;
  model: string; capabilities?: string; createdAt: string;
};
type Department = {
  id: number; organizationId: number; name: string; description?: string;
  managerAgentId?: number; agents: Agent[]; managerAgent?: Agent | null; createdAt: string;
};
type Skill = { id: number; name: string; description: string; inputSchema?: string; outputSchema?: string };
type Task = {
  id: number; agentId: number; agentName?: string; agentRole?: string;
  input: string; status: string; result?: string; errorMessage?: string;
  executionMs?: number; requiresApproval: boolean; approvalStatus?: string;
  approvalNote?: string; reviewedAt?: string; createdAt: string;
};
type KpiData = {
  tasks: { total: number; completed: number; failed: number; pending: number; successRate: number };
  approvals: { pendingApproval: number };
  executions: { total: number; totalCost: number };
  workflows: { totalRuns: number };
  agentPerformance: Array<{
    agentId: number; agentName: string; agentRole: string;
    totalExecutions: string; totalCost: string; totalTokens: string;
  }>;
};
type CostData = {
  overall: { totalCost: string; totalTokens: string; executionCount: string };
  perAgent: Array<{ agentId: number; agentName: string; totalCost: string; totalTokens: string; executionCount: string }>;
  workflowCosts: Array<{ workflowId: number; totalCost: string; runCount: string }>;
};
type DeptRunResult = {
  departmentName: string; userRequest: string; finalReport: string;
  totalTokens: number; totalCost: number; durationMs: number;
  agentResults: Array<{ agentName: string; input: string; output: string; cost: number; durationMs: number }>;
};

function fmtCost(v?: string | number | null) {
  const n = Number(v ?? 0);
  return `$${n.toFixed(4)}`;
}
function fmtMs(ms?: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
function parseCapabilities(json?: string | null): string[] {
  if (!json) return [];
  try { const p = JSON.parse(json); return Array.isArray(p) ? p : []; } catch { return []; }
}

function StatCard({ icon: Icon, label, value, sub, color = "amber" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    failed: "text-red-400 bg-red-500/10 border-red-500/20",
    running: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    pending: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rejected: "text-red-400 bg-red-500/10 border-red-500/20",
    active: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const cls = map[status] ?? map.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      {status === "running" && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
      {status}
    </span>
  );
}

type Tab = "overview" | "departments" | "agents" | "tasks" | "skills" | "tools" | "analytics";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptRunInput, setDeptRunInput] = useState("");
  const [deptRunResult, setDeptRunResult] = useState<DeptRunResult | null>(null);
  const [showDeptRun, setShowDeptRun] = useState(false);
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showCreateSkill, setShowCreateSkill] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [approvalNote, setApprovalNote] = useState("");

  const [deptForm, setDeptForm] = useState({ name: "", description: "", organizationId: "", managerAgentId: "" });
  const [skillForm, setSkillForm] = useState({ name: "", description: "", inputSchema: "", outputSchema: "" });
  const [addAgentForm, setAddAgentForm] = useState({ agentId: "" });

  const qc = useQueryClient();

  const { data: orgs = [] } = useQuery<Org[]>({ queryKey: ["orgs"], queryFn: () => apiFetch("/api/organizations") });
  const { data: agents = [] } = useQuery<Agent[]>({ queryKey: ["agents"], queryFn: () => apiFetch("/api/agents") });
  const { data: departments = [], isLoading: loadingDepts } = useQuery<Department[]>({
    queryKey: ["departments"], queryFn: () => apiFetch("/api/departments"),
  });
  const { data: skills = [], isLoading: loadingSkills } = useQuery<Skill[]>({
    queryKey: ["skills"], queryFn: () => apiFetch("/api/skills"),
  });
  const { data: tasks = [], isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ["tasks"], queryFn: () => apiFetch("/api/tasks"),
    refetchInterval: 5000,
  });
  const { data: kpi } = useQuery<KpiData>({ queryKey: ["kpi"], queryFn: () => apiFetch("/api/analytics/kpi"), refetchInterval: 10000 });
  const { data: costData } = useQuery<CostData>({ queryKey: ["cost"], queryFn: () => apiFetch("/api/analytics/cost"), refetchInterval: 10000 });
  const { data: toolsData } = useQuery<{ builtin: Array<{ name: string; description: string; type: string }> }>({
    queryKey: ["tools"], queryFn: () => apiFetch("/api/tools"),
  });

  const createDeptMut = useMutation({
    mutationFn: (b: object) => apiFetch("/api/departments", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setShowCreateDept(false); setDeptForm({ name: "", description: "", organizationId: "", managerAgentId: "" }); },
  });

  const createSkillMut = useMutation({
    mutationFn: (b: object) => apiFetch("/api/skills", { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["skills"] }); setShowCreateSkill(false); setSkillForm({ name: "", description: "", inputSchema: "", outputSchema: "" }); },
  });

  const deleteSkillMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/skills/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });

  const addAgentToDeptMut = useMutation({
    mutationFn: (b: { agentId: number }) => apiFetch(`/api/departments/${selectedDept!.id}/agents`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setShowAddAgent(false); setAddAgentForm({ agentId: "" }); },
  });

  const deptRunMut = useMutation({
    mutationFn: (b: { input: string }) => apiFetch<DeptRunResult>(`/api/departments/${selectedDept!.id}/run`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: (data) => { setDeptRunResult(data); setShowDeptRun(false); setDeptRunInput(""); },
  });

  const approveMut = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "approve" | "reject"; note?: string }) =>
      apiFetch(`/api/tasks/${id}/approve`, { method: "POST", body: JSON.stringify({ action, note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setApprovalNote(""); },
  });

  const pendingApprovals = tasks.filter(t => t.requiresApproval && t.approvalStatus === null && t.status === "completed");

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "overview", label: "Tổng quan", icon: Activity },
    { id: "departments", label: "Phòng ban", icon: Building2 },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "tasks", label: "Tasks", icon: Layers },
    { id: "skills", label: "Skills", icon: Star },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-300 font-sans">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-sm sticky top-12 z-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1 py-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tab === id
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "tasks" && pendingApprovals.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center ml-0.5">
                    {pendingApprovals.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">AI Company Runtime</h2>
              <p className="text-slate-500 text-sm">Tổng quan hệ thống — cập nhật mỗi 10 giây</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Layers} label="Tổng Tasks" value={kpi?.tasks.total ?? 0} color="blue" />
              <StatCard icon={CheckCircle2} label="Hoàn thành" value={kpi?.tasks.completed ?? 0}
                sub={`${kpi?.tasks.successRate ?? 0}% success rate`} color="emerald" />
              <StatCard icon={XCircle} label="Thất bại" value={kpi?.tasks.failed ?? 0} color="red" />
              <StatCard icon={Shield} label="Chờ duyệt" value={kpi?.approvals.pendingApproval ?? 0} color="amber" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Building2} label="Phòng ban" value={departments.length} color="purple" />
              <StatCard icon={Bot} label="Agents" value={agents.length} color="blue" />
              <StatCard icon={GitMerge} label="Workflow Runs" value={kpi?.workflows.totalRuns ?? 0} color="amber" />
              <StatCard icon={DollarSign} label="Tổng chi phí" value={fmtCost(costData?.overall.totalCost)} color="emerald" />
            </div>

            {/* Live Activity Feed */}
            <LiveActivity />

            {/* Success Rate Bar */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-white">Tỷ lệ thành công</span>
                </div>
                <span className="text-xl font-bold text-emerald-400">{kpi?.tasks.successRate ?? 0}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${kpi?.tasks.successRate ?? 0}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            </div>

            {/* Agent Performance */}
            {kpi && kpi.agentPerformance.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-white">Agent Performance Ranking</h3>
                </div>
                <div className="space-y-2">
                  {kpi.agentPerformance.slice(0, 5).map((a, i) => (
                    <div key={a.agentId} className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-slate-400 text-black" : "bg-amber-900/40 text-amber-600"}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium truncate">{a.agentName}</span>
                          <span className="text-slate-500 shrink-0 ml-2">{Number(a.totalExecutions)} runs · {fmtCost(a.totalCost)}</span>
                        </div>
                        <div className="text-xs text-slate-600">{a.agentRole}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Department Overview */}
            {departments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Cấu trúc tổ chức</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{dept.name}</div>
                          {dept.managerAgent && (
                            <div className="text-xs text-slate-500">Manager: {dept.managerAgent.name}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dept.agents.map((a) => (
                          <span key={a.id} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs text-slate-400">
                            {a.name}
                          </span>
                        ))}
                        {dept.agents.length === 0 && <span className="text-xs text-slate-600">Chưa có agents</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DEPARTMENTS TAB */}
        {tab === "departments" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Phòng ban</h2>
              <button onClick={() => setShowCreateDept(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Tạo phòng ban
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dept List */}
              <div className="space-y-3">
                {loadingDepts ? (
                  <div className="flex items-center justify-center py-12 text-slate-600"><Loader2 className="w-5 h-5 animate-spin mr-2" />Đang tải...</div>
                ) : departments.length === 0 ? (
                  <div className="text-center py-12 text-slate-600"><Building2 className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">Chưa có phòng ban</p></div>
                ) : (
                  departments.map((dept) => (
                    <button key={dept.id} onClick={() => { setSelectedDept(dept); setDeptRunResult(null); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${selectedDept?.id === dept.id ? "bg-amber-500/10 border-amber-500/40" : "bg-white/5 border-white/10 hover:border-amber-500/30"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-medium text-sm text-white">{dept.name}</span>
                      </div>
                      {dept.description && <p className="text-xs text-slate-500 mb-2">{dept.description}</p>}
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Users className="w-3 h-3" />
                        {dept.agents.length} agents
                        {dept.managerAgent && <span>· Manager: {dept.managerAgent.name}</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Dept Detail */}
              <div className="lg:col-span-2">
                {!selectedDept ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-600">
                    <Building2 className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Chọn phòng ban để xem chi tiết</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-white">{selectedDept.name}</h3>
                          {selectedDept.description && <p className="text-slate-400 text-sm mt-1">{selectedDept.description}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setShowAddAgent(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 text-xs transition-colors">
                            <Plus className="w-3.5 h-3.5" /> Agent
                          </button>
                          <button
                            onClick={() => setShowDeptRun(true)}
                            disabled={selectedDept.agents.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-colors disabled:opacity-40">
                            <Play className="w-3.5 h-3.5" /> Chạy
                          </button>
                        </div>
                      </div>

                      {/* Agents in dept */}
                      <div className="space-y-2">
                        <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Agents ({selectedDept.agents.length})</div>
                        {selectedDept.agents.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-slate-600 text-sm">Chưa có agents. Nhấn "+ Agent" để thêm.</div>
                        ) : (
                          selectedDept.agents.map((agent) => {
                            const caps = parseCapabilities(agent.capabilities);
                            const isManager = agent.id === selectedDept.managerAgentId;
                            return (
                              <div key={agent.id} className={`flex items-start gap-3 p-3 rounded-lg border ${isManager ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-white/5"}`}>
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                  <Bot className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-white">{agent.name}</span>
                                    {isManager && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">Manager</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-0.5">{agent.role} · {agent.model}</div>
                                  {caps.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {caps.map((c) => (
                                        <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400">{c}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Run result */}
                    {deptRunMut.isPending && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center gap-3 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                        <span>Department đang xử lý yêu cầu...</span>
                      </div>
                    )}
                    {deptRunResult && (
                      <div className="bg-white/5 border border-emerald-500/20 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-semibold text-white">Kết quả từ {deptRunResult.departmentName}</span>
                          <span className="ml-auto text-xs text-slate-600">{fmtMs(deptRunResult.durationMs)} · {fmtCost(deptRunResult.totalCost)}</span>
                        </div>
                        <div className="space-y-2">
                          {deptRunResult.agentResults.map((r, i) => (
                            <div key={i} className="p-3 rounded-lg bg-black/30 border border-white/5">
                              <div className="text-xs font-medium text-slate-400 mb-1">{r.agentName} · {fmtMs(r.durationMs)} · {fmtCost(r.cost)}</div>
                              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-32 overflow-y-auto">{r.output}</pre>
                            </div>
                          ))}
                        </div>
                        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                          <div className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Báo cáo tổng hợp</div>
                          <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{deptRunResult.finalReport}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AGENTS TAB */}
        {tab === "agents" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Agents ({agents.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const caps = parseCapabilities(agent.capabilities);
                const isExpanded = expandedAgent === agent.id;
                const agentTasks = tasks.filter(t => t.agentId === agent.id);
                const successCount = agentTasks.filter(t => t.status === "completed").length;
                return (
                  <div key={agent.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedAgent(isExpanded ? null : agent.id)} className="w-full text-left p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white text-sm">{agent.name}</div>
                          <div className="text-xs text-slate-500">{agent.role} · {agent.model}</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {caps.map((c) => (
                              <span key={c} className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400">{c}</span>
                            ))}
                            {caps.length === 0 && <span className="text-[10px] text-slate-600">No capabilities set</span>}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />}
                      </div>
                      <div className="flex gap-4 mt-3 text-xs text-slate-600">
                        <span>{agentTasks.length} tasks</span>
                        <span className="text-emerald-500">{successCount} completed</span>
                        <span className="text-red-500">{agentTasks.filter(t => t.status === "failed").length} failed</span>
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/5">
                          <div className="p-4 space-y-2">
                            <div className="text-xs text-slate-600 font-medium">Org #{agent.organizationId} · ID #{agent.id}</div>
                            <div className="text-xs text-slate-500">Joined {new Date(agent.createdAt).toLocaleDateString("vi-VN")}</div>
                            {agentTasks.slice(0, 3).map((t) => (
                              <div key={t.id} className="flex items-center gap-2 text-xs">
                                <StatusBadge status={t.status} />
                                <span className="text-slate-500 truncate">{t.input.slice(0, 60)}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div className="col-span-3 text-center py-12 text-slate-600">
                  <Bot className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Chưa có agents nào</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {tab === "tasks" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tasks</h2>
              <button onClick={() => qc.invalidateQueries({ queryKey: ["tasks"] })} className="text-slate-600 hover:text-slate-400 transition-colors"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {pendingApprovals.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-400">Cần duyệt ({pendingApprovals.length})</span>
                </div>
                <div className="space-y-3">
                  {pendingApprovals.map((task) => (
                    <div key={task.id} className="bg-black/30 border border-white/10 rounded-lg p-3">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 mb-1">Task #{task.id} · {task.agentName}</div>
                          <div className="text-sm text-white mb-1">{task.input}</div>
                          {task.result && (
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-sans max-h-24 overflow-y-auto bg-black/30 rounded p-2">{task.result}</pre>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <input
                          value={approvalNote}
                          onChange={(e) => setApprovalNote(e.target.value)}
                          placeholder="Ghi chú (tùy chọn)..."
                          className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => approveMut.mutate({ id: task.id, action: "approve", note: approvalNote })}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                          </button>
                          <button onClick={() => approveMut.mutate({ id: task.id, action: "reject", note: approvalNote })}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">
                            <XCircle className="w-3.5 h-3.5" /> Từ chối
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingTasks ? (
              <div className="flex items-center justify-center py-12 text-slate-600"><Loader2 className="w-5 h-5 animate-spin mr-2" />Đang tải...</div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="w-full text-left p-4">
                      <div className="flex items-center gap-3">
                        <div>
                          {task.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            : task.status === "failed" ? <XCircle className="w-4 h-4 text-red-400" />
                            : task.status === "running" ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                            : <Clock className="w-4 h-4 text-slate-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-600">#{task.id}</span>
                            <StatusBadge status={task.status} />
                            {task.requiresApproval && (
                              <span className="px-1.5 py-0.5 rounded border text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/10">
                                <Shield className="inline w-2.5 h-2.5 mr-0.5" />approval
                              </span>
                            )}
                            {task.approvalStatus && <StatusBadge status={task.approvalStatus} />}
                            <span className="ml-auto text-xs text-slate-600">{task.agentName}</span>
                          </div>
                          <div className="text-sm text-slate-300 truncate mt-0.5">{task.input}</div>
                        </div>
                        {expandedTask === task.id ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedTask === task.id && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
                            <div className="text-xs text-slate-600">Thời gian: {fmtMs(task.executionMs)} · {new Date(task.createdAt).toLocaleString("vi-VN")}</div>
                            {task.result && (
                              <div>
                                <div className="text-xs text-slate-500 font-medium mb-1">Kết quả</div>
                                <pre className="text-xs text-emerald-300 whitespace-pre-wrap font-sans bg-black/30 rounded p-2 max-h-40 overflow-y-auto">{task.result}</pre>
                              </div>
                            )}
                            {task.errorMessage && (
                              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">{task.errorMessage}</div>
                            )}
                            {task.approvalNote && (
                              <div className="text-xs text-slate-400">Ghi chú duyệt: {task.approvalNote}</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="text-center py-12 text-slate-600"><Layers className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">Chưa có tasks</p></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SKILLS TAB */}
        {tab === "skills" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Skill Registry ({skills.length})</h2>
              <button onClick={() => setShowCreateSkill(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Thêm Skill
              </button>
            </div>
            {loadingSkills ? (
              <div className="flex items-center justify-center py-12 text-slate-600"><Loader2 className="w-5 h-5 animate-spin mr-2" />Đang tải...</div>
            ) : skills.length === 0 ? (
              <div className="text-center py-12 text-slate-600"><Star className="w-8 h-8 mx-auto mb-3 opacity-30" /><p className="text-sm">Chưa có skill nào. Thêm skills để mở rộng khả năng agents.</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {skills.map((skill) => (
                  <div key={skill.id} className="bg-white/5 border border-white/10 rounded-xl p-4 group">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                          <Star className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <span className="font-mono text-sm text-white font-medium">{skill.name}</span>
                      </div>
                      <button onClick={() => deleteSkillMut.mutate(skill.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-400 transition-all text-xs px-2 py-0.5 rounded border border-red-500/20 hover:bg-red-500/10">
                        Xóa
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{skill.description}</p>
                    {skill.inputSchema && (
                      <div className="mt-2 text-xs text-slate-600 font-mono">Input: {skill.inputSchema.slice(0, 60)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOOLS TAB */}
        {tab === "tools" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Tool Registry</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(toolsData?.builtin ?? []).map((tool) => (
                <div key={tool.name} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="font-mono text-sm text-white font-medium">{tool.name}</div>
                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 inline-block">{tool.type}</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{tool.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="space-y-8">
            <h2 className="text-xl font-bold text-white">Cost & KPI Analytics</h2>

            {/* Overview numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="Tổng chi phí" value={fmtCost(costData?.overall.totalCost)} color="emerald" />
              <StatCard icon={Zap} label="Tổng tokens" value={Number(costData?.overall.totalTokens ?? 0).toLocaleString()} color="blue" />
              <StatCard icon={Activity} label="Executions" value={Number(costData?.overall.executionCount ?? 0)} color="amber" />
              <StatCard icon={Target} label="Success Rate" value={`${kpi?.tasks.successRate ?? 0}%`} color="purple" />
            </div>

            {/* Per-Agent Cost */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-white">Chi phí theo Agent</h3>
              </div>
              {!costData?.perAgent.length ? (
                <p className="text-slate-600 text-sm">Chưa có dữ liệu</p>
              ) : (
                <div className="space-y-3">
                  {costData.perAgent.map((a) => {
                    const maxCost = Math.max(...costData.perAgent.map(x => Number(x.totalCost)));
                    const pct = maxCost > 0 ? (Number(a.totalCost) / maxCost) * 100 : 0;
                    return (
                      <div key={a.agentId}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white">{a.agentName ?? `Agent #${a.agentId}`}</span>
                          <span className="text-slate-400">{fmtCost(a.totalCost)} · {Number(a.totalTokens).toLocaleString()} tokens · {a.executionCount} runs</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KPI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-white">Task KPIs</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Hoàn thành", value: kpi?.tasks.completed ?? 0, color: "bg-emerald-500" },
                    { label: "Thất bại", value: kpi?.tasks.failed ?? 0, color: "bg-red-500" },
                    { label: "Đang chờ", value: kpi?.tasks.pending ?? 0, color: "bg-slate-500" },
                  ].map((item) => {
                    const total = kpi?.tasks.total ?? 1;
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{item.label}</span>
                          <span className="text-white">{item.value} / {total}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div className={`h-full ${item.color} rounded-full`}
                            initial={{ width: 0 }}
                            animate={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                            transition={{ duration: 0.8 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-white">Top Agents</h3>
                </div>
                <div className="space-y-3">
                  {(kpi?.agentPerformance ?? []).slice(0, 5).map((a, i) => (
                    <div key={a.agentId} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-slate-600"}`}>{i + 1}</span>
                      <div className="flex-1">
                        <div className="text-sm text-white">{a.agentName}</div>
                        <div className="text-xs text-slate-600">{a.agentRole}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-white">{Number(a.totalExecutions)} runs</div>
                        <div className="text-xs text-slate-500">{fmtCost(a.totalCost)}</div>
                      </div>
                    </div>
                  ))}
                  {!kpi?.agentPerformance.length && <p className="text-slate-600 text-sm">Chưa có dữ liệu</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Department */}
      <AnimatePresence>
        {showCreateDept && (
          <Modal title="Tạo Phòng ban" onClose={() => setShowCreateDept(false)}>
            <div className="space-y-4">
              <FormSelect label="Tổ chức *" value={deptForm.organizationId} onChange={v => setDeptForm(f => ({ ...f, organizationId: v }))}>
                <option value="">Chọn tổ chức...</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </FormSelect>
              <FormInput label="Tên phòng ban *" value={deptForm.name} onChange={v => setDeptForm(f => ({ ...f, name: v }))} placeholder="VD: Sales Department" />
              <FormInput label="Mô tả" value={deptForm.description} onChange={v => setDeptForm(f => ({ ...f, description: v }))} placeholder="Mô tả..." />
              <FormSelect label="Manager Agent" value={deptForm.managerAgentId} onChange={v => setDeptForm(f => ({ ...f, managerAgentId: v }))}>
                <option value="">Không có</option>
                {agents.filter(a => !deptForm.organizationId || a.organizationId === parseInt(deptForm.organizationId, 10))
                  .map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </FormSelect>
              {createDeptMut.isError && <p className="text-red-400 text-xs">{(createDeptMut.error as Error).message}</p>}
              <ModalActions
                onCancel={() => setShowCreateDept(false)}
                onConfirm={() => {
                  if (!deptForm.name || !deptForm.organizationId) return;
                  createDeptMut.mutate({
                    organizationId: parseInt(deptForm.organizationId, 10),
                    name: deptForm.name,
                    description: deptForm.description || undefined,
                    managerAgentId: deptForm.managerAgentId ? parseInt(deptForm.managerAgentId, 10) : undefined,
                  });
                }}
                loading={createDeptMut.isPending}
                disabled={!deptForm.name || !deptForm.organizationId}
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal: Add Agent to Dept */}
      <AnimatePresence>
        {showAddAgent && selectedDept && (
          <Modal title={`Thêm Agent vào ${selectedDept.name}`} onClose={() => setShowAddAgent(false)}>
            <div className="space-y-4">
              <FormSelect label="Agent *" value={addAgentForm.agentId} onChange={v => setAddAgentForm({ agentId: v })}>
                <option value="">Chọn agent...</option>
                {agents.filter(a => a.organizationId === selectedDept.organizationId && !selectedDept.agents.find(da => da.id === a.id))
                  .map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </FormSelect>
              {addAgentToDeptMut.isError && <p className="text-red-400 text-xs">{(addAgentToDeptMut.error as Error).message}</p>}
              <ModalActions
                onCancel={() => setShowAddAgent(false)}
                onConfirm={() => { if (!addAgentForm.agentId) return; addAgentToDeptMut.mutate({ agentId: parseInt(addAgentForm.agentId, 10) }); }}
                loading={addAgentToDeptMut.isPending}
                disabled={!addAgentForm.agentId}
                confirmLabel="Thêm"
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal: Run Department */}
      <AnimatePresence>
        {showDeptRun && selectedDept && (
          <Modal title={`Chạy — ${selectedDept.name}`} onClose={() => setShowDeptRun(false)}>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex gap-2">
                <Briefcase className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Department Manager sẽ tự phân công công việc cho {selectedDept.agents.length} agents, sau đó tổng hợp báo cáo.</span>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Yêu cầu *</label>
                <textarea value={deptRunInput} onChange={e => setDeptRunInput(e.target.value)}
                  placeholder="Nhập yêu cầu cho phòng ban..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none" />
              </div>
              {deptRunMut.isError && <p className="text-red-400 text-xs">{(deptRunMut.error as Error).message}</p>}
              <ModalActions
                onCancel={() => setShowDeptRun(false)}
                onConfirm={() => { if (deptRunInput.trim()) deptRunMut.mutate({ input: deptRunInput }); }}
                loading={deptRunMut.isPending}
                disabled={!deptRunInput.trim()}
                confirmLabel="Chạy ngay"
                confirmClass="bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Modal: Create Skill */}
      <AnimatePresence>
        {showCreateSkill && (
          <Modal title="Thêm Skill mới" onClose={() => setShowCreateSkill(false)}>
            <div className="space-y-4">
              <FormInput label="Tên skill *" value={skillForm.name} onChange={v => setSkillForm(f => ({ ...f, name: v }))} placeholder="VD: lead_generation" />
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Mô tả *</label>
                <textarea value={skillForm.description} onChange={e => setSkillForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả chức năng của skill..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none" />
              </div>
              <FormInput label="Input Schema (JSON)" value={skillForm.inputSchema} onChange={v => setSkillForm(f => ({ ...f, inputSchema: v }))} placeholder='{"query": "string"}' />
              <FormInput label="Output Schema (JSON)" value={skillForm.outputSchema} onChange={v => setSkillForm(f => ({ ...f, outputSchema: v }))} placeholder='{"result": "string"}' />
              {createSkillMut.isError && <p className="text-red-400 text-xs">{(createSkillMut.error as Error).message}</p>}
              <ModalActions
                onCancel={() => setShowCreateSkill(false)}
                onConfirm={() => {
                  if (!skillForm.name || !skillForm.description) return;
                  createSkillMut.mutate({
                    name: skillForm.name, description: skillForm.description,
                    inputSchema: skillForm.inputSchema || undefined,
                    outputSchema: skillForm.outputSchema || undefined,
                  });
                }}
                loading={createSkillMut.isPending}
                disabled={!skillForm.name || !skillForm.description}
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50" />
    </div>
  );
}

function FormSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5 font-medium">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50">
        {children}
      </select>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, loading, disabled, confirmLabel = "Tạo", confirmClass }: {
  onCancel: () => void; onConfirm: () => void; loading: boolean; disabled: boolean;
  confirmLabel?: string; confirmClass?: string;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-colors">Hủy</button>
      <button onClick={onConfirm} disabled={loading || disabled}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 ${confirmClass ?? "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"}`}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-white mb-5">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}
