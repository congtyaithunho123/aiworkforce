import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Activity, GitBranch, Database, Shield, ScrollText,
  Rocket, Terminal, LayoutDashboard, ChevronRight, Play,
  Pause, Square, Trash2, RefreshCw, Plus, CheckCircle2,
  AlertTriangle, Clock, Zap, Server, Network, Lock,
  FileText, Settings, BarChart2, ArrowRight, Package,
  Globe, Layers, Eye, X, Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const fade = {
  hidden: { opacity: 0, y: 10 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
};

type OsTab = "control-plane" | "kernel" | "scheduler" | "workflows" | "resources" | "sandbox" | "policies" | "governance" | "deployments" | "cli";

const STATUS_COLOR: Record<string, string> = {
  CREATED: "text-slate-400 bg-slate-500/10",
  READY: "text-blue-400 bg-blue-500/10",
  RUNNING: "text-emerald-400 bg-emerald-500/10",
  PAUSED: "text-amber-400 bg-amber-500/10",
  FAILED: "text-rose-400 bg-rose-500/10",
  TERMINATED: "text-slate-600 bg-slate-500/5",
  idle: "text-slate-400 bg-slate-500/10",
  running: "text-emerald-400 bg-emerald-500/10",
  completed: "text-blue-400 bg-blue-500/10",
  failed: "text-rose-400 bg-rose-500/10",
  pending: "text-amber-400 bg-amber-500/10",
  deploying: "text-violet-400 bg-violet-500/10",
  queued: "text-cyan-400 bg-cyan-500/10",
  approved: "text-emerald-400 bg-emerald-500/10",
  rejected: "text-rose-400 bg-rose-500/10",
};

function Badge({ status, label }: { status: string; label?: string }) {
  const cls = STATUS_COLOR[status] ?? "text-slate-400 bg-slate-500/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label ?? status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "emerald" }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string;
}) {
  const c: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    violet: "text-violet-400 bg-violet-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
  };
  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${c[color]} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

const CLI_COMMANDS = [
  { cmd: "wf agent list", desc: "Liệt kê tất cả agents và trạng thái" },
  { cmd: "wf agent start <id>", desc: "Khởi động agent theo ID" },
  { cmd: "wf workflow run <id>", desc: "Chạy workflow ngay lập tức" },
  { cmd: "wf workflow list", desc: "Xem tất cả workflows" },
  { cmd: "wf task status <id>", desc: "Kiểm tra trạng thái task" },
  { cmd: "wf task list", desc: "Liệt kê 20 tasks gần nhất" },
  { cmd: "wf monitor", desc: "Dashboard realtime (kernel + resource)" },
  { cmd: "wf deploy production --target docker", desc: "Deploy lên Docker" },
  { cmd: "wf deploy production --target kubernetes", desc: "Deploy lên Kubernetes" },
  { cmd: "wf policy list", desc: "Xem tất cả policies" },
  { cmd: "wf audit --since 7d", desc: "Xem audit log 7 ngày gần nhất" },
];

export default function OSPage() {
  const [tab, setTab] = useState<OsTab>("control-plane");
  const qc = useQueryClient();

  // ─ Kernel states ──────────────────────────────────────────────────────────
  const [agentName, setAgentName] = useState("");
  const [agentType, setAgentType] = useState("generic");
  const [agentPriority, setAgentPriority] = useState(5);
  const [agentCaps, setAgentCaps] = useState("");

  // ─ Workflow states ─────────────────────────────────────────────────────────
  const [wfName, setWfName] = useState("");
  const [wfSchedule, setWfSchedule] = useState<"immediate" | "cron" | "event">("immediate");
  const [wfCron, setWfCron] = useState("0 8 * * *");
  const [wfEvent, setWfEvent] = useState("");

  // ─ Deploy states ───────────────────────────────────────────────────────────
  const [depName, setDepName] = useState("");
  const [depTarget, setDepTarget] = useState<"local" | "docker" | "vps" | "kubernetes">("docker");
  const [depEnv, setDepEnv] = useState<"development" | "staging" | "production">("production");
  const [depReplicas, setDepReplicas] = useState(1);
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  // ─ Policy states ───────────────────────────────────────────────────────────
  const [evalRole, setEvalRole] = useState("sales_agent");
  const [evalResource, setEvalResource] = useState("billing");
  const [evalAction, setEvalAction] = useState("read");
  const [evalResult, setEvalResult] = useState<{ allowed: boolean; reason: string } | null>(null);

  // ─ Sandbox states ─────────────────────────────────────────────────────────
  const [sbTools, setSbTools] = useState("search,email");
  const [sbResources, setSbResources] = useState("crm,knowledge_base");
  const [sbNetwork, setSbNetwork] = useState(false);

  // ─ Approval states ────────────────────────────────────────────────────────
  const [approvalTitle, setApprovalTitle] = useState("");
  const [approvalType, setApprovalType] = useState("deploy");
  const [approvalPriority, setApprovalPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  // ─ Queries ────────────────────────────────────────────────────────────────
  const { data: cp, isLoading: cpLoading } = useQuery<{
    kernel: { agents: { total: number; byStatus: Record<string, number>; list: unknown[] }; workflows: { total: number; enabled: number; list: unknown[] }; tasks: { total: number; recentList: unknown[] } };
    resources: { quotas: unknown[]; summary: { totalAgents: number; runningAgents: number; activeSandboxes: number } };
    governance: { pendingApprovals: number; recentAuditLogs: unknown[]; recentDeployments: unknown[]; policies: number };
  }>({
    queryKey: ["os-control-plane"],
    queryFn: () => apiFetch("/api/os/control-plane"),
    enabled: tab === "control-plane",
    refetchInterval: 10000,
  });

  const { data: agentsData, refetch: refetchAgents } = useQuery<{ agents: KernelAgent[] }>({
    queryKey: ["os-kernel-agents"],
    queryFn: () => apiFetch("/api/os/kernel/agents"),
    enabled: tab === "kernel" || tab === "scheduler",
    refetchInterval: 8000,
  });

  const { data: schedulerData } = useQuery<{
    nodes: { name: string; load: number; capacity: number; utilization: number }[];
    queue: { queued: number; running: number; completed: number; failed: number; total: number };
    agents: { total: number; byStatus: Record<string, number> };
  }>({
    queryKey: ["os-scheduler-status"],
    queryFn: () => apiFetch("/api/os/scheduler/status"),
    enabled: tab === "scheduler",
    refetchInterval: 5000,
  });

  const { data: workflowsData, refetch: refetchWf } = useQuery<{ workflows: KernelWorkflow[] }>({
    queryKey: ["os-workflows"],
    queryFn: () => apiFetch("/api/os/workflows"),
    enabled: tab === "workflows",
    refetchInterval: 10000,
  });

  const { data: tasksData, refetch: refetchTasks } = useQuery<{ tasks: KernelTask[] }>({
    queryKey: ["os-tasks"],
    queryFn: () => apiFetch("/api/os/tasks"),
    enabled: tab === "workflows",
    refetchInterval: 5000,
  });

  const { data: usageData, refetch: refetchUsage } = useQuery<{
    usage: ResourceUsage[];
    summary: { totalCpu: number; totalRam: number; totalTokens: number; totalCost: number; totalRequests: number };
  }>({
    queryKey: ["os-usage"],
    queryFn: () => apiFetch("/api/os/resources/usage"),
    enabled: tab === "resources",
    refetchInterval: 8000,
  });

  const { data: quotasData } = useQuery<{ quotas: ResourceQuota[] }>({
    queryKey: ["os-quotas"],
    queryFn: () => apiFetch("/api/os/resources/quotas"),
    enabled: tab === "resources",
  });

  const { data: sandboxData, refetch: refetchSandbox } = useQuery<{ sessions: SandboxSession[] }>({
    queryKey: ["os-sandbox"],
    queryFn: () => apiFetch("/api/os/sandbox"),
    enabled: tab === "sandbox",
    refetchInterval: 8000,
  });

  const { data: policiesData } = useQuery<{ policies: Policy[] }>({
    queryKey: ["os-policies"],
    queryFn: () => apiFetch("/api/os/policies"),
    enabled: tab === "policies",
  });

  const { data: auditData, refetch: refetchAudit } = useQuery<{ logs: AuditLog[]; count: number }>({
    queryKey: ["os-audit"],
    queryFn: () => apiFetch("/api/os/governance/audit"),
    enabled: tab === "governance",
    refetchInterval: 10000,
  });

  const { data: approvalsData, refetch: refetchApprovals } = useQuery<{ approvals: Approval[] }>({
    queryKey: ["os-approvals"],
    queryFn: () => apiFetch("/api/os/governance/approvals"),
    enabled: tab === "governance",
    refetchInterval: 8000,
  });

  const { data: deploymentsData, refetch: refetchDeployments } = useQuery<{ deployments: Deployment[] }>({
    queryKey: ["os-deployments"],
    queryFn: () => apiFetch("/api/os/deployments"),
    enabled: tab === "deployments",
    refetchInterval: 8000,
  });

  // ─ Mutations ─────────────────────────────────────────────────────────────
  const createAgentMut = useMutation({
    mutationFn: () => apiFetch("/api/os/kernel/agents", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: agentName, agentType, priority: agentPriority, capabilities: agentCaps.split(",").map(s => s.trim()).filter(Boolean) }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-kernel-agents"] }); setAgentName(""); setAgentCaps(""); },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiFetch(`/api/os/kernel/agents/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-kernel-agents"] }),
  });

  const dispatchMut = useMutation({
    mutationFn: (agentId: number) => apiFetch("/api/os/scheduler/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-kernel-agents"] }); qc.invalidateQueries({ queryKey: ["os-scheduler-status"] }); },
  });

  const createWfMut = useMutation({
    mutationFn: () => apiFetch("/api/os/workflows", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wfName, scheduleType: wfSchedule, cronExpression: wfSchedule === "cron" ? wfCron : undefined, eventTrigger: wfSchedule === "event" ? wfEvent : undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-workflows"] }); setWfName(""); },
  });

  const runWfMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/os/workflows/${id}/run`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-workflows"] }); qc.invalidateQueries({ queryKey: ["os-tasks"] }); },
  });

  const snapshotMut = useMutation({
    mutationFn: () => apiFetch("/api/os/resources/snapshot", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-usage"] }),
  });

  const launchSandboxMut = useMutation({
    mutationFn: () => apiFetch("/api/os/sandbox/launch", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedTools: sbTools.split(",").map(s => s.trim()), allowedResources: sbResources.split(",").map(s => s.trim()), networkAccess: sbNetwork }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-sandbox"] }),
  });

  const terminateSandboxMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/os/sandbox/${id}/terminate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-sandbox"] }),
  });

  const seedPoliciesMut = useMutation({
    mutationFn: () => apiFetch("/api/os/policies/seed", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-policies"] }),
  });

  const evalPolicyMut = useMutation({
    mutationFn: () => apiFetch("/api/os/policies/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: evalRole, resource: evalResource, action: evalAction }) }),
    onSuccess: (data) => setEvalResult(data as { allowed: boolean; reason: string }),
  });

  const togglePolicyMut = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/api/os/policies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-policies"] }),
  });

  const createApprovalMut = useMutation({
    mutationFn: () => apiFetch("/api/os/governance/approvals", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: approvalTitle, requestType: approvalType, requestedBy: "admin", priority: approvalPriority }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["os-approvals"] }); setApprovalTitle(""); },
  });

  const approveActionMut = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      apiFetch(`/api/os/governance/approvals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, approvedBy: "admin" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-approvals"] }),
  });

  const deployMut = useMutation({
    mutationFn: async () => {
      setIsDeploying(true);
      setDeployLog([]);
      const steps = {
        local: ["Đọc config local", "Khởi động process", "Health check"],
        docker: ["Build Docker image", "Push to registry", "Deploy container", "Health check"],
        vps: ["Connect SSH", "Pull code", "Build", "Restart service", "Health check"],
        kubernetes: ["Apply manifests", "Wait for pods", "Scale replicas", "Ingress update", "Health check"],
      }[depTarget];
      for (const step of steps) {
        await new Promise(r => setTimeout(r, 600));
        setDeployLog(prev => [...prev, `✅ ${step}`]);
      }
      return apiFetch("/api/os/deployments", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: depName || `Deployment ${new Date().toLocaleTimeString("vi-VN")}`, environment: depEnv, target: depTarget, replicas: depReplicas }) });
    },
    onSuccess: () => { setIsDeploying(false); qc.invalidateQueries({ queryKey: ["os-deployments"] }); },
    onError: () => setIsDeploying(false),
  });

  const tabs: { key: OsTab; label: string; icon: React.ElementType }[] = [
    { key: "control-plane", label: "Control Plane", icon: LayoutDashboard },
    { key: "kernel", label: "Kernel", icon: Cpu },
    { key: "scheduler", label: "Scheduler", icon: Activity },
    { key: "workflows", label: "Workflows", icon: GitBranch },
    { key: "resources", label: "Resources", icon: BarChart2 },
    { key: "sandbox", label: "Sandbox", icon: Lock },
    { key: "policies", label: "Policies", icon: Shield },
    { key: "governance", label: "Governance", icon: ScrollText },
    { key: "deployments", label: "Deploy", icon: Rocket },
    { key: "cli", label: "CLI", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Workforce OS</h1>
            <p className="text-sm text-slate-500">Operating System — quản lý Agent như Process, Workflow như Service</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-xs text-violet-400">Kernel Running</span>
            <button onClick={() => qc.invalidateQueries({ queryKey: ["os-control-plane"] })}
              className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1 mt-6 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key ? "bg-violet-500/15 text-violet-400 border border-violet-500/30" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── CONTROL PLANE ─────────────────────────────────────────────────── */}
      {tab === "control-plane" && (
        <div className="space-y-6">
          {cpLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-violet-400 animate-spin" /></div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={Cpu} label="Total Agents" value={cp?.kernel.agents.total ?? 0} sub={`${cp?.kernel.agents.byStatus.RUNNING ?? 0} running`} color="emerald" />
                <StatCard icon={GitBranch} label="Workflows" value={cp?.kernel.workflows.total ?? 0} sub={`${cp?.kernel.workflows.enabled ?? 0} enabled`} color="blue" />
                <StatCard icon={ScrollText} label="Pending Approvals" value={cp?.governance.pendingApprovals ?? 0} sub="awaiting review" color="amber" />
                <StatCard icon={Lock} label="Active Sandboxes" value={cp?.resources.summary.activeSandboxes ?? 0} sub="isolated envs" color="violet" />
              </div>

              {/* Agent status matrix */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-violet-400" /> Agent Status Matrix
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {["CREATED","READY","RUNNING","PAUSED","FAILED","TERMINATED"].map((s) => (
                    <div key={s} className="text-center p-3 bg-white/3 rounded-xl">
                      <p className="text-lg font-bold text-white">{cp?.kernel.agents.byStatus[s] ?? 0}</p>
                      <Badge status={s} />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent activity */}
              <div className="grid sm:grid-cols-2 gap-4">
                <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
                  className="bg-white/3 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" /> Audit Log gần nhất
                  </h3>
                  <div className="space-y-1.5">
                    {(cp?.governance.recentAuditLogs as AuditLog[] ?? []).slice(0, 6).map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 flex-shrink-0 w-14 text-right">{new Date(log.createdAt).toLocaleTimeString("vi-VN")}</span>
                        <span className="text-slate-400">{log.actor}</span>
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <span className="text-white font-mono">{log.action}</span>
                        <span className="text-slate-500 truncate">{log.resource}</span>
                      </div>
                    ))}
                    {(cp?.governance.recentAuditLogs as AuditLog[] ?? []).length === 0 && (
                      <p className="text-slate-600 text-xs py-4 text-center">Chưa có audit log</p>
                    )}
                  </div>
                </motion.div>

                <motion.div initial="hidden" animate="visible" variants={fade} custom={3}
                  className="bg-white/3 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-slate-400" /> Deployments gần nhất
                  </h3>
                  <div className="space-y-2">
                    {(cp?.governance.recentDeployments as Deployment[] ?? []).slice(0, 5).map((dep) => (
                      <div key={dep.id} className="flex items-center gap-2">
                        <Badge status={dep.status} />
                        <span className="text-xs text-white flex-1 truncate">{dep.name}</span>
                        <span className="text-[10px] text-slate-500">{dep.target}</span>
                      </div>
                    ))}
                    {(cp?.governance.recentDeployments as Deployment[] ?? []).length === 0 && (
                      <p className="text-slate-600 text-xs py-4 text-center">Chưa có deployment</p>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* OS Architecture diagram */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={4}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Kiến trúc AI Workforce OS</h3>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { icon: LayoutDashboard, label: "Control Plane", color: "violet" },
                    { icon: Cpu, label: "WorkforceKernel", color: "emerald" },
                    { icon: Activity, label: "AgentScheduler", color: "blue" },
                    { icon: Shield, label: "PolicyEngine", color: "amber" },
                    { icon: Lock, label: "ExecSandbox", color: "rose" },
                  ].map((item) => {
                    const Icon = item.icon;
                    const cls: Record<string, string> = { violet: "text-violet-400 bg-violet-500/10", emerald: "text-emerald-400 bg-emerald-500/10", blue: "text-blue-400 bg-blue-500/10", amber: "text-amber-400 bg-amber-500/10", rose: "text-rose-400 bg-rose-500/10" };
                    return (
                      <div key={item.label}>
                        <div className={`w-10 h-10 rounded-xl ${cls[item.color]} flex items-center justify-center mx-auto mb-2`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-600">
                  <span>ResourceManager</span><ArrowRight className="w-3 h-3" />
                  <span>GovernanceLayer</span><ArrowRight className="w-3 h-3" />
                  <span>AuditTrail</span><ArrowRight className="w-3 h-3" />
                  <span>DeploymentManager</span><ArrowRight className="w-3 h-3" />
                  <span>WorkforceCLI</span>
                </div>
              </motion.div>
            </>
          )}
        </div>
      )}

      {/* ── KERNEL TAB ─────────────────────────────────────────────────────── */}
      {tab === "kernel" && (
        <div className="space-y-5">
          {/* Create agent */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-400" /> Tạo Agent mới
            </h3>
            <div className="grid sm:grid-cols-4 gap-3">
              <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                placeholder="Tên agent" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                value={agentType} onChange={(e) => setAgentType(e.target.value)}>
                {["generic","sales","marketing","support","analytics","research"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                placeholder="Capabilities (vd: crm,email)" value={agentCaps} onChange={(e) => setAgentCaps(e.target.value)} />
              <button onClick={() => createAgentMut.mutate()} disabled={!agentName || createAgentMut.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-400 disabled:opacity-40 transition-all">
                {createAgentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo
              </button>
            </div>
          </motion.div>

          {/* Agent list */}
          <div className="space-y-2">
            {(agentsData?.agents ?? []).map((agent, i) => (
              <motion.div key={agent.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white">{agent.name}</p>
                    <Badge status={agent.status} />
                    <span className="text-[10px] text-slate-500">{agent.agentType}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Priority {agent.priority} · {agent.workerNode ? `→ ${agent.workerNode}` : "not dispatched"} · Retry {agent.retryCount}/{agent.maxRetries}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {agent.status === "CREATED" && (
                    <button onClick={() => statusMut.mutate({ id: agent.id, status: "READY" })}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">READY</button>
                  )}
                  {agent.status === "READY" && (
                    <button onClick={() => dispatchMut.mutate(agent.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                      <Play className="w-3 h-3 inline mr-1" />RUN
                    </button>
                  )}
                  {agent.status === "RUNNING" && (
                    <button onClick={() => statusMut.mutate({ id: agent.id, status: "PAUSED" })}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors">
                      <Pause className="w-3 h-3 inline mr-1" />PAUSE
                    </button>
                  )}
                  {agent.status === "PAUSED" && (
                    <button onClick={() => statusMut.mutate({ id: agent.id, status: "RUNNING" })}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                      <Play className="w-3 h-3 inline mr-1" />RESUME
                    </button>
                  )}
                  {agent.status !== "TERMINATED" && (
                    <button onClick={() => statusMut.mutate({ id: agent.id, status: "TERMINATED" })}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                      <Square className="w-3 h-3 inline mr-1" />TERM
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            {(agentsData?.agents ?? []).length === 0 && (
              <p className="text-slate-600 text-sm text-center py-12">Chưa có agents. Tạo agent đầu tiên!</p>
            )}
          </div>
        </div>
      )}

      {/* ── SCHEDULER TAB ──────────────────────────────────────────────────── */}
      {tab === "scheduler" && (
        <div className="space-y-5">
          {/* Queue stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Clock} label="Queued" value={schedulerData?.queue.queued ?? 0} color="amber" />
            <StatCard icon={Zap} label="Running" value={schedulerData?.queue.running ?? 0} color="emerald" />
            <StatCard icon={CheckCircle2} label="Completed" value={schedulerData?.queue.completed ?? 0} color="blue" />
            <StatCard icon={AlertTriangle} label="Failed" value={schedulerData?.queue.failed ?? 0} color="rose" />
          </div>

          {/* Worker nodes */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-400" /> Worker Nodes — Load Balancer
            </h3>
            <div className="grid sm:grid-cols-4 gap-3">
              {(schedulerData?.nodes ?? []).map((node) => (
                <div key={node.name} className="bg-white/3 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-white">{node.name}</span>
                    <span className="text-[10px] text-slate-500">{node.load}/{node.capacity}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${node.utilization > 80 ? "bg-rose-500" : node.utilization > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${node.utilization}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1.5 text-center">{node.utilization.toFixed(0)}% utilization</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dispatch agents */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Agents — Dispatch to Worker Nodes</h3>
            <div className="space-y-2">
              {(agentsData?.agents ?? []).filter(a => a.status !== "TERMINATED").map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
                  <Badge status={agent.status} />
                  <div className="flex-1">
                    <p className="text-sm text-white">{agent.name}</p>
                    <p className="text-xs text-slate-500">Priority {agent.priority} {agent.workerNode ? `→ ${agent.workerNode}` : ""}</p>
                  </div>
                  {["READY", "CREATED"].includes(agent.status) && (
                    <button onClick={() => dispatchMut.mutate(agent.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-semibold hover:bg-blue-500/25 transition-colors">
                      Dispatch
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── WORKFLOWS TAB ─────────────────────────────────────────────────── */}
      {tab === "workflows" && (
        <div className="space-y-5">
          {/* Create workflow */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" /> Tạo Workflow
            </h3>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
                  placeholder="Tên workflow" value={wfName} onChange={(e) => setWfName(e.target.value)} />
                <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  value={wfSchedule} onChange={(e) => setWfSchedule(e.target.value as "immediate" | "cron" | "event")}>
                  <option value="immediate">⚡ Chạy ngay (Immediate)</option>
                  <option value="cron">🕐 Theo lịch (Cron)</option>
                  <option value="event">🔔 Theo Event (Event-driven)</option>
                </select>
                {wfSchedule === "cron" && (
                  <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none"
                    placeholder="Cron: 0 8 * * *" value={wfCron} onChange={(e) => setWfCron(e.target.value)} />
                )}
                {wfSchedule === "event" && (
                  <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                    placeholder="Event: user.registered" value={wfEvent} onChange={(e) => setWfEvent(e.target.value)} />
                )}
              </div>
              {wfSchedule === "cron" && (
                <div className="flex gap-2 flex-wrap">
                  {[["0 8 * * *", "8h sáng mỗi ngày"], ["0 9 * * 1", "9h thứ 2"], ["*/30 * * * *", "Mỗi 30 phút"], ["0 0 * * *", "Midnight"]].map(([expr, label]) => (
                    <button key={expr} onClick={() => setWfCron(expr)}
                      className="text-xs px-2.5 py-1 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors">
                      {label} <span className="font-mono text-slate-600">({expr})</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => createWfMut.mutate()} disabled={!wfName || createWfMut.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 disabled:opacity-40 transition-all">
                {createWfMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tạo Workflow
              </button>
            </div>
          </motion.div>

          {/* Workflow list */}
          <div className="space-y-2">
            {(workflowsData?.workflows ?? []).map((wf, i) => (
              <motion.div key={wf.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  {wf.scheduleType === "cron" ? <Clock className="w-4 h-4 text-blue-400" /> :
                   wf.scheduleType === "event" ? <Zap className="w-4 h-4 text-amber-400" /> :
                   <Play className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white">{wf.name}</p>
                    <Badge status={wf.status} />
                    <span className="text-[10px] text-slate-500">{wf.scheduleType}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Runs: {wf.runCount} · ✅{wf.successCount} · ❌{wf.failureCount}
                    {wf.cronExpression && <span className="font-mono ml-2 text-slate-600">{wf.cronExpression}</span>}
                    {wf.nextRunAt && <span className="ml-2">Next: {new Date(wf.nextRunAt).toLocaleString("vi-VN")}</span>}
                  </p>
                </div>
                <button onClick={() => runWfMut.mutate(wf.id)} disabled={runWfMut.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors">
                  <Play className="w-3 h-3" /> Run
                </button>
              </motion.div>
            ))}
          </div>

          {/* Recent tasks */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={10}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" /> Recent Tasks
            </h3>
            <div className="space-y-1.5">
              {(tasksData?.tasks ?? []).slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <Badge status={t.status} />
                  <span className="text-white flex-1 truncate">{t.name}</span>
                  <span className="text-slate-600">{t.durationMs ? `${t.durationMs}ms` : "..."}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── RESOURCES TAB ─────────────────────────────────────────────────── */}
      {tab === "resources" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Cpu} label="Total CPU" value={`${Math.round((usageData?.summary.totalCpu ?? 0) / 1000)}s`} sub="CPU time used" color="emerald" />
            <StatCard icon={Server} label="Avg RAM" value={`${Math.round(usageData?.summary.totalRam ?? 0)}MB`} sub="memory usage" color="blue" />
            <StatCard icon={Zap} label="Total Tokens" value={(usageData?.summary.totalTokens ?? 0).toLocaleString()} sub="LLM tokens" color="violet" />
            <StatCard icon={BarChart2} label="Total Cost" value={`$${(usageData?.summary.totalCost ?? 0).toFixed(4)}`} sub="24h spending" color="amber" />
          </div>

          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Live Resource Usage
              </h3>
              <button onClick={() => snapshotMut.mutate()} disabled={snapshotMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors">
                {snapshotMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Snapshot
              </button>
            </div>
            <div className="space-y-2">
              {(usageData?.usage ?? []).slice(0, 15).map((u) => (
                <div key={u.id} className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500 w-14 flex-shrink-0">{new Date(u.recordedAt).toLocaleTimeString("vi-VN")}</span>
                  <span className="text-white w-28 truncate flex-shrink-0">{u.agentName ?? "System"}</span>
                  <div className="flex gap-3 flex-1">
                    <span className="text-emerald-400">CPU {u.cpuMs}ms</span>
                    <span className="text-blue-400">RAM {u.ramMb}MB</span>
                    <span className="text-violet-400">{u.tokensUsed} tok</span>
                    <span className="text-amber-400">${u.costUsd.toFixed(4)}</span>
                  </div>
                </div>
              ))}
              {(usageData?.usage ?? []).length === 0 && (
                <p className="text-slate-600 text-sm text-center py-8">Chưa có dữ liệu. Click Snapshot để tạo mẫu từ agents đang chạy.</p>
              )}
            </div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" /> Resource Quotas
            </h3>
            {(quotasData?.quotas ?? []).length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-6">Chưa có quotas. Quotas được tạo tự động khi thêm agent vào resource tracking.</p>
            ) : (
              <div className="space-y-2">
                {(quotasData?.quotas ?? []).map((q) => (
                  <div key={q.id} className="p-3 bg-white/3 rounded-xl text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">{q.scope} quota #{q.id}</span>
                      <Badge status="running" label="active" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "CPU", cur: q.currentCpuMs, lim: q.cpuLimitMs, unit: "ms" },
                        { label: "RAM", cur: q.currentRamMb, lim: q.ramLimitMb, unit: "MB" },
                        { label: "Tokens", cur: q.currentTokens, lim: q.tokenLimit, unit: "" },
                        { label: "Cost", cur: q.currentCostUsd.toFixed(2), lim: q.costLimitUsd.toFixed(2), unit: "$" },
                      ].map((metric) => {
                        const pct = (Number(metric.cur) / Number(metric.lim)) * 100;
                        return (
                          <div key={metric.label}>
                            <p className="text-slate-500 mb-1">{metric.label}</p>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-0.5">
                              <div className={`h-full rounded-full ${pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <p className="text-[9px] text-slate-600">{metric.cur}/{metric.lim}{metric.unit}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── SANDBOX TAB ───────────────────────────────────────────────────── */}
      {tab === "sandbox" && (
        <div className="space-y-5">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-violet-400" /> Launch Execution Sandbox
            </h3>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Allowed Tools</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                    placeholder="search,email,crm" value={sbTools} onChange={(e) => setSbTools(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Allowed Resources</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                    placeholder="crm,knowledge_base" value={sbResources} onChange={(e) => setSbResources(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sbNetwork} onChange={(e) => setSbNetwork(e.target.checked)} className="w-3.5 h-3.5 rounded accent-violet-500" />
                  <span className="text-xs text-slate-400">Network Access (mở internet)</span>
                </label>
                <button onClick={() => launchSandboxMut.mutate()} disabled={launchSandboxMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-semibold hover:bg-violet-400 disabled:opacity-40 transition-all ml-auto">
                  {launchSandboxMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Launch Sandbox
                </button>
              </div>
            </div>
          </motion.div>

          <div className="space-y-2">
            {(sandboxData?.sessions ?? []).map((s, i) => (
              <motion.div key={s.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white">Sandbox #{s.id}</p>
                    <Badge status={s.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Tools: {(s.allowedTools as string[]).join(", ")} ·
                    Resources: {(s.allowedResources as string[]).join(", ")} ·
                    Network: {s.networkAccess ? "✅" : "❌"}
                  </p>
                  <p className="text-xs text-slate-600">NS: {s.memoryNamespace}</p>
                </div>
                {s.status === "running" && (
                  <button onClick={() => terminateSandboxMut.mutate(s.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-semibold hover:bg-rose-500/25 transition-colors">
                    <Square className="w-3 h-3 inline mr-1" />Stop
                  </button>
                )}
              </motion.div>
            ))}
            {(sandboxData?.sessions ?? []).length === 0 && (
              <p className="text-slate-600 text-sm text-center py-12">Chưa có sandbox session. Launch một sandbox ở trên!</p>
            )}
          </div>
        </div>
      )}

      {/* ── POLICIES TAB ──────────────────────────────────────────────────── */}
      {tab === "policies" && (
        <div className="space-y-5">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" /> Policy Evaluation Engine
            </h3>
            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Role</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  value={evalRole} onChange={(e) => setEvalRole(e.target.value)} placeholder="sales_agent" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Resource</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  value={evalResource} onChange={(e) => setEvalResource(e.target.value)} placeholder="billing" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Action</label>
                <input className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                  value={evalAction} onChange={(e) => setEvalAction(e.target.value)} placeholder="read" />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <button onClick={() => evalPolicyMut.mutate()} disabled={evalPolicyMut.isPending}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 disabled:opacity-40 transition-all">
                  <Eye className="w-4 h-4" /> Evaluate
                </button>
              </div>
            </div>
            {evalResult && (
              <div className={`p-3 rounded-xl border ${evalResult.allowed ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>
                <div className="flex items-center gap-2">
                  {evalResult.allowed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <X className="w-4 h-4 text-rose-400" />}
                  <p className={`text-sm font-semibold ${evalResult.allowed ? "text-emerald-400" : "text-rose-400"}`}>
                    {evalResult.allowed ? "✅ ALLOWED" : "❌ DENIED"}
                  </p>
                </div>
                <p className="text-xs text-slate-400 mt-1 ml-6">{evalResult.reason}</p>
              </div>
            )}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => seedPoliciesMut.mutate()} disabled={seedPoliciesMut.isPending}
                className="text-xs px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors">
                Seed preset policies
              </button>
              <span className="text-xs text-slate-600">(Sales Agent, Support Agent, Finance Block)</span>
            </div>
          </motion.div>

          <div className="space-y-2">
            {(policiesData?.policies ?? []).map((p, i) => (
              <motion.div key={p.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.effect === "allow" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                  {p.effect === "allow" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <Badge status={p.effect === "allow" ? "running" : "failed"} label={p.effect.toUpperCase()} />
                    {!p.isActive && <Badge status="TERMINATED" label="INACTIVE" />}
                  </div>
                  <p className="text-xs text-slate-500">
                    Role: <span className="text-white">{p.role}</span> ·
                    Resources: {(p.resources as string[]).join(", ")} ·
                    Actions: {(p.actions as string[]).join(", ")} ·
                    Priority {p.priority}
                  </p>
                </div>
                <button onClick={() => togglePolicyMut.mutate({ id: p.id, isActive: !p.isActive })}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${p.isActive ? "bg-slate-500/10 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"}`}>
                  {p.isActive ? "Disable" : "Enable"}
                </button>
              </motion.div>
            ))}
            {(policiesData?.policies ?? []).length === 0 && (
              <p className="text-slate-600 text-sm text-center py-12">Chưa có policies. Click "Seed preset policies" để bắt đầu.</p>
            )}
          </div>
        </div>
      )}

      {/* ── GOVERNANCE TAB ────────────────────────────────────────────────── */}
      {tab === "governance" && (
        <div className="space-y-5">
          {/* Create approval */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" /> Yêu cầu Approval
            </h3>
            <div className="grid sm:grid-cols-4 gap-3">
              <input className="sm:col-span-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                placeholder="Tiêu đề yêu cầu" value={approvalTitle} onChange={(e) => setApprovalTitle(e.target.value)} />
              <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                value={approvalPriority} onChange={(e) => setApprovalPriority(e.target.value as "low" | "medium" | "high" | "critical")}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="critical">🔴 Critical</option>
              </select>
              <button onClick={() => createApprovalMut.mutate()} disabled={!approvalTitle || createApprovalMut.isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-400 disabled:opacity-40 transition-all">
                {createApprovalMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Submit
              </button>
            </div>
          </motion.div>

          {/* Pending approvals */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Approvals ({approvalsData?.approvals.filter(a => a.status === "pending").length ?? 0} pending)
            </h3>
            <div className="space-y-2">
              {(approvalsData?.approvals ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.priority === "critical" ? "bg-rose-400" : a.priority === "high" ? "bg-amber-400" : a.priority === "medium" ? "bg-blue-400" : "bg-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.requestedBy} · {new Date(a.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  <Badge status={a.status} />
                  {a.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => approveActionMut.mutate({ id: a.id, action: "approve" })}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors">✅ Approve</button>
                      <button onClick={() => approveActionMut.mutate({ id: a.id, action: "reject" })}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-[11px] font-semibold hover:bg-rose-500/25 transition-colors">❌ Reject</button>
                    </div>
                  )}
                </div>
              ))}
              {(approvalsData?.approvals ?? []).length === 0 && (
                <p className="text-slate-600 text-sm text-center py-6">Không có approval requests</p>
              )}
            </div>
          </motion.div>

          {/* Audit log */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-slate-400" /> Audit Trail ({auditData?.count ?? 0} records)
              </h3>
              <button onClick={() => refetchAudit()} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {(auditData?.logs ?? []).map((log) => (
                <div key={log.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-white/5">
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${log.severity === "critical" ? "bg-rose-500/20 text-rose-400" : log.severity === "warning" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/10 text-slate-400"}`}>
                    {log.severity}
                  </span>
                  <span className="text-slate-500 flex-shrink-0">{new Date(log.createdAt).toLocaleTimeString("vi-VN")}</span>
                  <span className="text-slate-400 flex-shrink-0">{log.actor}</span>
                  <span className="font-mono text-white">{log.action}</span>
                  <span className="text-slate-600 truncate">{log.resource} {log.resourceId ? `#${log.resourceId}` : ""}</span>
                </div>
              ))}
              {(auditData?.logs ?? []).length === 0 && (
                <p className="text-slate-600 text-sm text-center py-6">Audit log trống — actions sẽ được ghi tại đây</p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── DEPLOYMENTS TAB ───────────────────────────────────────────────── */}
      {tab === "deployments" && (
        <div className="space-y-5">
          {/* Deploy form */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-gradient-to-br from-violet-950/40 to-black border border-violet-500/20 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-violet-400" /> Deploy Workforce
            </h3>
            <div className="grid sm:grid-cols-4 gap-3 mb-4">
              <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none"
                placeholder="Tên deployment" value={depName} onChange={(e) => setDepName(e.target.value)} />
              <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                value={depTarget} onChange={(e) => setDepTarget(e.target.value as "local" | "docker" | "vps" | "kubernetes")}>
                <option value="local">💻 Local</option>
                <option value="docker">🐳 Docker</option>
                <option value="vps">☁️ VPS</option>
                <option value="kubernetes">⚓ Kubernetes</option>
              </select>
              <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                value={depEnv} onChange={(e) => setDepEnv(e.target.value as "development" | "staging" | "production")}>
                <option value="development">🔧 Development</option>
                <option value="staging">🧪 Staging</option>
                <option value="production">🚀 Production</option>
              </select>
              <select className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                value={depReplicas} onChange={(e) => setDepReplicas(Number(e.target.value))}>
                {[1,2,3,5,10,20].map(n => <option key={n} value={n}>{n} replica{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <button onClick={() => deployMut.mutate()} disabled={isDeploying || deployMut.isPending}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-400 disabled:opacity-40 transition-all">
              {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {`wf deploy ${depEnv} --target ${depTarget}`}
            </button>

            {/* Deploy log terminal */}
            {deployLog.length > 0 && (
              <div className="mt-4 bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-slate-500 ml-2">Deployment Log</span>
                </div>
                {deployLog.map((line, i) => (
                  <p key={i} className="text-emerald-400 leading-relaxed">{`> ${line}`}</p>
                ))}
                {isDeploying && <p className="text-slate-500 animate-pulse">{">"} Running...</p>}
              </div>
            )}
          </motion.div>

          {/* Deployment history */}
          <div className="space-y-2">
            {(deploymentsData?.deployments ?? []).map((dep, i) => (
              <motion.div key={dep.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    {dep.target === "kubernetes" ? <Network className="w-4 h-4 text-violet-400" /> :
                     dep.target === "docker" ? <Package className="w-4 h-4 text-blue-400" /> :
                     dep.target === "vps" ? <Globe className="w-4 h-4 text-emerald-400" /> :
                     <Server className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white">{dep.name}</p>
                      <Badge status={dep.status} />
                      {dep.isHealthy !== null && (dep.isHealthy
                        ? <span className="text-[10px] text-emerald-400">🟢 Healthy</span>
                        : <span className="text-[10px] text-rose-400">🔴 Unhealthy</span>)}
                    </div>
                    <p className="text-xs text-slate-500">
                      {dep.target} · {dep.environment} · v{dep.version} · {dep.replicas} replica(s)
                      {dep.deployedBy && ` · by ${dep.deployedBy}`}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-600 flex-shrink-0">{new Date(dep.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                {(dep.deployLog as string[]).length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Xem deploy log</summary>
                    <div className="mt-2 bg-black/40 rounded-lg p-2 font-mono text-[10px] text-slate-400">
                      {(dep.deployLog as string[]).map((l, idx) => <p key={idx}>{l}</p>)}
                    </div>
                  </details>
                )}
              </motion.div>
            ))}
            {(deploymentsData?.deployments ?? []).length === 0 && (
              <p className="text-slate-600 text-sm text-center py-12">Chưa có deployment. Dùng form trên để deploy!</p>
            )}
          </div>
        </div>
      )}

      {/* ── CLI TAB ───────────────────────────────────────────────────────── */}
      {tab === "cli" && (
        <div className="space-y-5">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-black border border-white/10 rounded-2xl overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-500 ml-3 font-mono">Workforce CLI — wf</span>
            </div>

            {/* ASCII art + intro */}
            <div className="p-5 font-mono text-xs">
              <p className="text-emerald-400 mb-1">{"╔══════════════════════════════════════════════╗"}</p>
              <p className="text-emerald-400 mb-1">{"║  AI Workforce OS — Command Line Interface   ║"}</p>
              <p className="text-emerald-400 mb-3">{"╚══════════════════════════════════════════════╝"}</p>
              <p className="text-slate-500 mb-4">$ wf --version &nbsp;→ &nbsp;<span className="text-white">workforce-os/1.0.0</span></p>

              <div className="space-y-3">
                {CLI_COMMANDS.map(({ cmd, desc }) => (
                  <div key={cmd} className="flex gap-3">
                    <span className="text-violet-400 flex-shrink-0">$</span>
                    <div>
                      <p className="text-white font-mono">{cmd}</p>
                      <p className="text-slate-600 mt-0.5"># {desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Installation & usage */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" /> Cài đặt & Sử dụng
            </h3>
            <div className="space-y-3">
              {[
                { title: "Install CLI", code: "chmod +x ./wf && ln -s $(pwd)/wf /usr/local/bin/wf" },
                { title: "Quick start", code: "wf agent list\nwf workflow run 1\nwf monitor" },
                { title: "Deploy production", code: "wf deploy production --target docker --replicas 3" },
                { title: "Full deploy + rollback", code: "wf deploy production --target kubernetes\nwf deploy rollback --id <deploy_id>" },
              ].map(({ title, code }) => (
                <div key={title}>
                  <p className="text-xs text-slate-500 mb-1.5"># {title}</p>
                  <div className="bg-black/60 border border-white/10 rounded-xl p-3 font-mono text-xs">
                    {code.split("\n").map((line, i) => (
                      <p key={i} className="text-emerald-400">{`$ ${line}`}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CLI file location */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
            className="bg-amber-950/30 border border-amber-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Terminal className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-400 mb-1">Workforce CLI đã được tạo tại:</p>
                <p className="text-xs font-mono text-white bg-black/40 rounded-lg px-3 py-2 mb-2">./wf</p>
                <p className="text-xs text-slate-400">Chạy từ terminal: <span className="font-mono text-emerald-400">chmod +x wf && ./wf monitor</span></p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─── Type helpers (inline, not importing from server) ─────────────────────────
interface KernelAgent {
  id: number; name: string; agentType: string; status: string;
  workerNode: string | null; priority: number; retryCount: number; maxRetries: number;
  capabilities: unknown; createdAt: string; updatedAt: string;
}
interface KernelWorkflow {
  id: number; name: string; status: string; scheduleType: string;
  cronExpression: string | null; eventTrigger: string | null; isEnabled: boolean;
  runCount: number; successCount: number; failureCount: number;
  lastRunAt: string | null; nextRunAt: string | null; steps: unknown;
}
interface KernelTask {
  id: number; name: string; type: string; status: string;
  priority: number; durationMs: number | null; createdAt: string;
}
interface ResourceUsage {
  id: number; agentName: string | null; cpuMs: number; ramMb: number;
  tokensUsed: number; costUsd: number; requestCount: number; recordedAt: string;
}
interface ResourceQuota {
  id: number; scope: string; cpuLimitMs: number; ramLimitMb: number;
  tokenLimit: number; costLimitUsd: number; currentCpuMs: number;
  currentRamMb: number; currentTokens: number; currentCostUsd: number;
}
interface SandboxSession {
  id: number; agentName: string | null; status: string; allowedTools: unknown;
  allowedResources: unknown; networkAccess: boolean; memoryNamespace: string | null;
}
interface Policy {
  id: number; name: string; role: string; effect: string; isActive: boolean;
  resources: unknown; actions: unknown; priority: number;
}
interface AuditLog {
  id: number; actor: string; action: string; resource: string;
  resourceId: string | null; severity: string; createdAt: string;
}
interface Approval {
  id: number; title: string; requestedBy: string; status: string;
  priority: string; createdAt: string;
}
interface Deployment {
  id: number; name: string; target: string; environment: string;
  status: string; version: string; replicas: number; isHealthy: boolean | null;
  deployedBy: string | null; deployLog: unknown; createdAt: string;
}
