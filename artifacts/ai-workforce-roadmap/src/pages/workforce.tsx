import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Activity, MessageSquare, Brain, Zap, Network, Shield,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Server,
  GitMerge, Users, Globe, ChevronRight, RefreshCw, Send,
  Database, Route, Star, Layers, Sparkles, ArrowRight,
  Loader2, BarChart2, Play,
} from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.06 } }),
};

interface MonitoringData {
  snapshot: {
    timestamp: string;
    agents: { total: number; registered: number; active: number; avgReputation: number; avgSuccessRate: number; totalExecutions: number };
    messages: { total: number; pending: number; done: number; failed: number; last24h: number; lastHour: number };
    memory: { total: number; personal: number; team: number; department: number; organization: number };
    events: { total: number; last24h: number; lastHour: number; errors: number };
    workflows: { running: number; completed: number; failed: number; total: number };
    executions: { total: number; today: number; avgDurationMs: number; totalCostUsd: number };
  };
  recentEvents: Event[];
  eventsByType: { eventType: string; count: number }[];
  topAgents: RegistryAgent[];
}

interface Event {
  id: number;
  eventType: string;
  severity: string;
  message: string | null;
  sourceType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface RegistryAgent {
  id: number;
  name: string;
  reputationScore: number;
  successRate: number;
  totalExecutions: number;
  capabilities: string[];
  status: string;
}

interface BusMessage {
  id: number;
  fromAgentId: number | null;
  toAgentId: number | null;
  messageType: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

interface RouteResult {
  routed: boolean;
  agent?: RegistryAgent;
  matchedCapabilities?: string[];
  score?: number;
  reason?: string;
  alternatives?: RegistryAgent[];
}

function MetricCard({
  label, value, sub, icon: Icon, color = "amber", i = 0
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; i?: number;
}) {
  const cls: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  };
  return (
    <motion.div initial="hidden" animate="visible" variants={fade} custom={i}
      className="bg-white/3 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cls[color] ?? cls.amber}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-blue-400 bg-blue-500/10",
  warning: "text-amber-400 bg-amber-500/10",
  error: "text-rose-400 bg-rose-500/10",
  critical: "text-red-400 bg-red-500/10",
};

const EVENT_ICON: Record<string, React.ElementType> = {
  TASK_CREATED: Zap,
  TASK_COMPLETED: CheckCircle2,
  TASK_FAILED: AlertTriangle,
  WORKFLOW_STARTED: GitMerge,
  WORKFLOW_COMPLETED: CheckCircle2,
  WORKFLOW_FAILED: AlertTriangle,
  AGENT_REGISTERED: Users,
  MESSAGE_SENT: MessageSquare,
  MESSAGE_DELIVERED: MessageSquare,
  MEMORY_WRITTEN: Brain,
  MEMORY_READ: Brain,
  CAPABILITY_ROUTED: Route,
  FEDERATION_LINKED: Globe,
  FEDERATION_REQUEST: Globe,
  COLLABORATION_STARTED: Layers,
  COLLABORATION_COMPLETED: CheckCircle2,
  SUBTASK_ROUTED: Route,
  SUBTASK_COMPLETED: CheckCircle2,
};

interface CollaborationSubtask {
  id: number;
  subtask: string;
  capability: string;
  assignedAgentName: string | null;
  status: string;
  result: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface CollaborationSession {
  id: number;
  title: string;
  originalTask: string;
  status: string;
  totalSubtasks: number;
  completedSubtasks: number;
  failedSubtasks: number;
  progressPct: number;
  aggregatedResult: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface CollaborateResult {
  session: CollaborationSession;
  subtasks: CollaborationSubtask[];
}

type Tab = "monitoring" | "collaborate" | "bus" | "registry" | "router" | "memory" | "events" | "graph" | "federation" | "sdk";

export default function WorkforcePage() {
  const [tab, setTab] = useState<Tab>("monitoring");
  const [routeTask, setRouteTask] = useState("");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [sendFrom, setSendFrom] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendType, setSendType] = useState("task");
  const [sendPayload, setSendPayload] = useState('{"task": "analyze market trends"}');
  const [memScope, setMemScope] = useState<"personal" | "team" | "department" | "organization">("organization");
  const [memKey, setMemKey] = useState("");
  const [memValue, setMemValue] = useState("");
  const [regName, setRegName] = useState("");
  const [regCaps, setRegCaps] = useState("");
  const [regVersion, setRegVersion] = useState("1.0.0");
  const [graphView, setGraphView] = useState<"tree" | "list">("tree");
  const [collabTask, setCollabTask] = useState("");
  const [collabResult, setCollabResult] = useState<CollaborateResult | null>(null);
  const [collabSelectedId, setCollabSelectedId] = useState<number | null>(null);

  const qc = useQueryClient();

  const { data: monitoring, isLoading: monLoading } = useQuery<MonitoringData>({
    queryKey: ["workforce-monitoring"],
    queryFn: () => apiFetch("/api/workforce/monitoring"),
    refetchInterval: 15000,
  });

  const { data: messagesData } = useQuery<{ messages: BusMessage[] }>({
    queryKey: ["workforce-bus"],
    queryFn: () => apiFetch("/api/workforce/bus/messages?limit=30"),
    enabled: tab === "bus",
    refetchInterval: 10000,
  });

  const { data: registryData } = useQuery<{ agents: RegistryAgent[] }>({
    queryKey: ["workforce-registry"],
    queryFn: () => apiFetch("/api/workforce/registry"),
    enabled: tab === "registry",
  });

  const { data: eventsData } = useQuery<{ events: Event[] }>({
    queryKey: ["workforce-events"],
    queryFn: () => apiFetch("/api/workforce/events?limit=100"),
    enabled: tab === "events",
    refetchInterval: 10000,
  });

  const { data: memoryData } = useQuery<{ memories: Array<{ id: number; scope: string; key: string; value: unknown; contentType: string; createdAt: string }> }>({
    queryKey: ["workforce-memory"],
    queryFn: () => apiFetch("/api/workforce/memory"),
    enabled: tab === "memory",
  });

  const { data: graphData } = useQuery<{ graph: { organization: { name: string }; departments: Array<{ id: number; name: string; agents: Array<{ id: number; name: string }>; teams: Array<{ id: number; name: string; agents: Array<{ id: number; name: string }> }> }>; stats: { totalDepartments: number; totalTeams: number; totalAgents: number } } }>({
    queryKey: ["workforce-graph"],
    queryFn: () => apiFetch("/api/workforce/graph"),
    enabled: tab === "graph",
  });

  const { data: fedData } = useQuery<{ agreements: Array<{ id: number; requesterOrganizationId: number; providerOrganizationId: number; status: string; isActive: boolean; sharedCapabilities: string[]; createdAt: string }> }>({
    queryKey: ["workforce-federation"],
    queryFn: () => apiFetch("/api/workforce/federation"),
    enabled: tab === "federation",
  });

  const sendMsgMut = useMutation({
    mutationFn: () => apiFetch("/api/workforce/bus/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAgentId: sendFrom ? Number(sendFrom) : undefined,
        toAgentId: Number(sendTo),
        messageType: sendType,
        payload: JSON.parse(sendPayload || "{}"),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-bus"] });
      qc.invalidateQueries({ queryKey: ["workforce-monitoring"] });
    },
  });

  const routeMut = useMutation({
    mutationFn: () => apiFetch("/api/workforce/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: routeTask }),
    }),
    onSuccess: (data) => setRouteResult(data as RouteResult),
  });

  const writeMut = useMutation({
    mutationFn: () => apiFetch("/api/workforce/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: memScope, key: memKey, value: memValue }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-memory"] });
      setMemKey(""); setMemValue("");
    },
  });

  const registerMut = useMutation({
    mutationFn: () => apiFetch("/api/workforce/registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: regName,
        version: regVersion,
        capabilities: regCaps.split(",").map((c) => c.trim()).filter(Boolean),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workforce-registry"] });
      setRegName(""); setRegCaps(""); setRegVersion("1.0.0");
    },
  });

  const { data: collabSessions } = useQuery<{ sessions: CollaborationSession[] }>({
    queryKey: ["workforce-collaborate"],
    queryFn: () => apiFetch("/api/workforce/collaborate"),
    enabled: tab === "collaborate",
    refetchInterval: 8000,
  });

  const { data: collabDetail } = useQuery<CollaborateResult>({
    queryKey: ["workforce-collaborate-detail", collabSelectedId],
    queryFn: () => apiFetch(`/api/workforce/collaborate/${collabSelectedId}`),
    enabled: !!collabSelectedId,
  });

  const collaborateMut = useMutation({
    mutationFn: () => apiFetch("/api/workforce/collaborate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task: collabTask }),
    }),
    onSuccess: (data) => {
      setCollabResult(data as CollaborateResult);
      setCollabSelectedId((data as CollaborateResult).session.id);
      qc.invalidateQueries({ queryKey: ["workforce-collaborate"] });
      qc.invalidateQueries({ queryKey: ["workforce-monitoring"] });
      setCollabTask("");
    },
  });

  const snap = monitoring?.snapshot;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "monitoring", label: "Monitoring", icon: Activity },
    { key: "collaborate", label: "Collaborate", icon: Sparkles },
    { key: "bus", label: "Message Bus", icon: MessageSquare },
    { key: "registry", label: "Registry", icon: Database },
    { key: "router", label: "Capability Router", icon: Route },
    { key: "memory", label: "Shared Memory", icon: Brain },
    { key: "events", label: "Events", icon: Zap },
    { key: "graph", label: "Workforce Graph", icon: Network },
    { key: "federation", label: "Federation", icon: Globe },
    { key: "sdk", label: "SDK", icon: Server },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Server className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Workforce Cloud</h1>
            <p className="text-sm text-slate-500">Cloud Runtime — quản lý hàng nghìn Agent và tổ chức</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-400">Live</span>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["workforce-monitoring"] })}
              className="ml-2 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-1 mt-6 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── MONITORING TAB ── */}
      {tab === "monitoring" && (
        <div className="space-y-6">
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Total Agents" value={snap?.agents.total ?? 0} icon={Users} color="amber" i={0} />
            <MetricCard label="Registered" value={snap?.agents.registered ?? 0} sub={`${snap?.agents.active ?? 0} active`} icon={Database} color="emerald" i={1} />
            <MetricCard label="Avg Reputation" value={`${snap?.agents.avgReputation ?? 100}%`} icon={Star} color="blue" i={2} />
            <MetricCard label="Messages (24h)" value={snap?.messages.last24h ?? 0} sub={`${snap?.messages.pending ?? 0} pending`} icon={MessageSquare} color="purple" i={3} />
            <MetricCard label="Events (24h)" value={snap?.events.last24h ?? 0} sub={`${snap?.events.errors ?? 0} errors`} icon={Zap} color="rose" i={4} />
            <MetricCard label="Cost Today" value={`$${(snap?.executions.totalCostUsd ?? 0).toFixed(4)}`} sub={`${snap?.executions.today ?? 0} runs`} icon={TrendingUp} color="cyan" i={5} />
          </div>

          {/* Second row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Workflows Running" value={snap?.workflows.running ?? 0} sub={`${snap?.workflows.total ?? 0} total`} icon={GitMerge} color="violet" i={6} />
            <MetricCard label="Memory Entries" value={snap?.memory.total ?? 0} sub="shared layers" icon={Brain} color="amber" i={7} />
            <MetricCard label="Avg Duration" value={`${snap?.executions.avgDurationMs ?? 0}ms`} icon={Clock} color="blue" i={8} />
            <MetricCard label="Message/hr" value={snap?.messages.lastHour ?? 0} icon={Activity} color="emerald" i={9} />
          </div>

          {/* Events & Top agents */}
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div initial="hidden" animate="visible" variants={fade} custom={10}
              className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Recent Events (Live)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(monitoring?.recentEvents ?? []).length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Chưa có events. Tương tác với hệ thống để tạo events.</p>
                ) : (
                  monitoring?.recentEvents.map((ev) => {
                    const Icon = EVENT_ICON[ev.eventType] ?? Activity;
                    return (
                      <div key={ev.id} className="flex items-start gap-2 text-xs">
                        <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-slate-300 font-medium">{ev.eventType}</span>
                          {ev.message && <span className="text-slate-500 ml-1">— {ev.message}</span>}
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${SEVERITY_COLOR[ev.severity] ?? ""}`}>
                          {ev.severity}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fade} custom={11}
              className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Top Agents by Reputation
              </h3>
              <div className="space-y-3">
                {(monitoring?.topAgents ?? []).length === 0 ? (
                  <p className="text-slate-600 text-sm text-center py-6">Chưa có agents trong registry. Đăng ký agents ở tab Registry.</p>
                ) : (
                  monitoring?.topAgents.map((ag, i) => (
                    <div key={ag.id} className="flex items-center gap-3">
                      <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white">{ag.name}</span>
                          <span className="text-xs text-amber-400">{ag.reputationScore}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${ag.reputationScore}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          {/* Events by type */}
          {(monitoring?.eventsByType ?? []).length > 0 && (
            <motion.div initial="hidden" animate="visible" variants={fade} custom={12}
              className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Event Distribution (24h)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {monitoring?.eventsByType.map((e) => (
                  <div key={e.eventType} className="bg-white/3 rounded-xl p-3">
                    <p className="text-xs text-slate-500 truncate">{e.eventType}</p>
                    <p className="text-xl font-bold text-white mt-1">{e.count}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* ── COLLABORATE TAB ── */}
      {tab === "collaborate" && (
        <div className="space-y-6">
          {/* Hero input */}
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="relative bg-gradient-to-br from-emerald-950/60 to-black border border-emerald-500/20 rounded-2xl p-6 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Agent-to-Agent Collaborative Execution</h3>
              </div>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Nhập một task phức tạp — hệ thống tự động phân tách thành sub-tasks, 
                route từng sub-task đến agent có capability phù hợp nhất qua Message Bus, 
                rồi tổng hợp kết quả từ tất cả agents.
              </p>
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  placeholder="vd: Tìm lead logistics tại HCMC, viết email outreach và tạo content LinkedIn campaign..."
                  value={collabTask}
                  onChange={(e) => setCollabTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && collabTask.length >= 5 && !collaborateMut.isPending && collaborateMut.mutate()}
                />
                <button
                  onClick={() => collaborateMut.mutate()}
                  disabled={collabTask.length < 5 || collaborateMut.isPending}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 transition-all"
                >
                  {collaborateMut.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</>
                    : <><Play className="w-4 h-4" /> Chạy</>}
                </button>
              </div>

              {/* Example tasks */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  "Tìm lead + viết email + tạo content LinkedIn",
                  "Research competitor + viết blog post + báo cáo SEO",
                  "Campaign marketing + analytics dashboard + CRM update",
                ].map((ex) => (
                  <button key={ex}
                    onClick={() => setCollabTask(ex)}
                    className="text-xs px-2.5 py-1 bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                  >{ex}</button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Live result from latest run */}
          {(collabResult || collabDetail) && (() => {
            const activeResult = collabDetail ?? collabResult!;
            const session = activeResult.session;
            const subtasks = activeResult.subtasks;
            const statusColor = session.status === "completed" ? "emerald" :
              session.status === "partial" ? "amber" : session.status === "failed" ? "rose" : "blue";
            const statusLabel = session.status === "completed" ? "✅ Hoàn thành" :
              session.status === "partial" ? "⚠️ Một phần" : session.status === "failed" ? "❌ Thất bại" : "⏳ Đang chạy";
            return (
              <motion.div key={session.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className={`border rounded-2xl overflow-hidden ${
                  statusColor === "emerald" ? "border-emerald-500/20" :
                  statusColor === "amber" ? "border-amber-500/20" :
                  statusColor === "rose" ? "border-rose-500/20" : "border-blue-500/20"
                }`}>
                {/* Session header */}
                <div className={`px-5 py-4 flex items-center justify-between ${
                  statusColor === "emerald" ? "bg-emerald-950/40" :
                  statusColor === "amber" ? "bg-amber-950/40" :
                  statusColor === "rose" ? "bg-rose-950/40" : "bg-blue-950/40"
                }`}>
                  <div className="flex items-center gap-3">
                    <Layers className={`w-4 h-4 ${statusColor === "emerald" ? "text-emerald-400" : statusColor === "amber" ? "text-amber-400" : statusColor === "rose" ? "text-rose-400" : "text-blue-400"}`} />
                    <div>
                      <p className="text-sm font-bold text-white">{session.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Session #{session.id} · {new Date(session.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{session.completedSubtasks}/{session.totalSubtasks} tasks</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      statusColor === "emerald" ? "bg-emerald-500/15 text-emerald-400" :
                      statusColor === "amber" ? "bg-amber-500/15 text-amber-400" :
                      statusColor === "rose" ? "bg-rose-500/15 text-rose-400" : "bg-blue-500/15 text-blue-400"
                    }`}>{statusLabel}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-white/5">
                  <div
                    className={`h-full transition-all duration-1000 ${statusColor === "emerald" ? "bg-emerald-500" : statusColor === "amber" ? "bg-amber-500" : statusColor === "rose" ? "bg-rose-500" : "bg-blue-500"}`}
                    style={{ width: `${session.progressPct}%` }}
                  />
                </div>

                <div className="p-5">
                  {/* Flow diagram */}
                  <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                    <div className="flex-shrink-0 bg-white/5 rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-1">Task gốc</p>
                      <p className="text-xs text-white font-medium max-w-[100px] truncate">{session.originalTask}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-shrink-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-emerald-400 mb-1">Router</p>
                      <p className="text-xs text-emerald-400 font-medium">Phân tách</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {subtasks.map((st, i) => (
                        <div key={st.id} className={`rounded-xl px-2 py-1.5 text-center ${
                          st.status === "completed" ? "bg-emerald-500/10 border border-emerald-500/20" :
                          st.status === "failed" || st.status === "no_agent" ? "bg-rose-500/10 border border-rose-500/20" :
                          "bg-blue-500/10 border border-blue-500/20"
                        }`}>
                          <p className={`text-[9px] font-medium ${st.status === "completed" ? "text-emerald-400" : st.status === "failed" || st.status === "no_agent" ? "text-rose-400" : "text-blue-400"}`}>
                            {st.capability}
                          </p>
                          <p className="text-[9px] text-slate-600 truncate max-w-[60px]">{st.assignedAgentName ?? "no agent"}</p>
                        </div>
                      ))}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-shrink-0 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 text-center">
                      <p className="text-[10px] text-violet-400 mb-1">Aggregator</p>
                      <p className="text-xs text-violet-400 font-medium">Tổng hợp</p>
                    </div>
                  </div>

                  {/* Sub-tasks detail */}
                  <div className="space-y-2 mb-4">
                    {subtasks.map((st) => (
                      <div key={st.id} className={`rounded-xl border p-3 ${
                        st.status === "completed" ? "border-emerald-500/15 bg-emerald-500/5" :
                        st.status === "failed" || st.status === "no_agent" ? "border-rose-500/15 bg-rose-500/5" :
                        "border-white/10 bg-white/3"
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {st.status === "completed"
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            : st.status === "failed" || st.status === "no_agent"
                            ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            : <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />}
                          <span className="text-xs font-semibold text-white">{st.capability}</span>
                          {st.assignedAgentName && (
                            <span className="text-[10px] text-slate-500">→ {st.assignedAgentName}</span>
                          )}
                          {st.durationMs && (
                            <span className="ml-auto text-[10px] text-slate-600">{st.durationMs}ms</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mb-1 ml-5">{st.subtask.slice(0, 80)}...</p>
                        {st.result && (
                          <p className="text-xs text-slate-300 ml-5 leading-relaxed">{st.result}</p>
                        )}
                        {(st.errorMessage || st.status === "no_agent") && (
                          <p className="text-xs text-rose-400 ml-5">{st.errorMessage ?? "Không tìm được agent phù hợp"}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Aggregated result */}
                  {session.aggregatedResult && session.status !== "running" && (
                    <div className="bg-white/3 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart2 className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-semibold text-violet-400">Kết quả tổng hợp</span>
                      </div>
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {session.aggregatedResult}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* Session history */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Lịch sử Collaboration ({collabSessions?.sessions.length ?? 0})
            </h3>
            <div className="space-y-2">
              {(collabSessions?.sessions ?? []).length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">Chưa có session nào. Chạy task đầu tiên ở trên!</p>
              ) : (
                collabSessions?.sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCollabSelectedId(s.id)}
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      collabSelectedId === s.id
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-white/5 bg-white/3 hover:border-white/15"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {s.completedSubtasks}/{s.totalSubtasks} agents · {new Date(s.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          s.status === "completed" ? "bg-emerald-500" :
                          s.status === "partial" ? "bg-amber-500" : s.status === "failed" ? "bg-rose-500" : "bg-blue-500"
                        }`} style={{ width: `${s.progressPct}%` }} />
                      </div>
                      <span className={`text-[10px] ${
                        s.status === "completed" ? "text-emerald-400" :
                        s.status === "partial" ? "text-amber-400" : s.status === "failed" ? "text-rose-400" : "text-blue-400"
                      }`}>{s.progressPct.toFixed(0)}%</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>

          {/* How it works */}
          <motion.div initial="hidden" animate="visible" variants={fade} custom={3}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Luồng hoạt động Agent-to-Agent</h3>
            <div className="grid sm:grid-cols-5 gap-3">
              {[
                { step: "1", icon: Layers, label: "Nhận task", desc: "User submit task phức tạp", color: "amber" },
                { step: "2", icon: Route, label: "Phân tách", desc: "DecomposeTask() tạo sub-tasks theo keyword", color: "blue" },
                { step: "3", icon: Database, label: "Route", desc: "Mỗi sub-task → best agent từ Registry", color: "purple" },
                { step: "4", icon: MessageSquare, label: "Message Bus", desc: "Gửi messages cho từng agent qua Bus", color: "emerald" },
                { step: "5", icon: BarChart2, label: "Tổng hợp", desc: "Aggregator kết hợp kết quả từ tất cả", color: "rose" },
              ].map((s) => {
                const Icon = s.icon;
                const cls: Record<string, string> = {
                  amber: "text-amber-400 bg-amber-500/10",
                  blue: "text-blue-400 bg-blue-500/10",
                  purple: "text-purple-400 bg-purple-500/10",
                  emerald: "text-emerald-400 bg-emerald-500/10",
                  rose: "text-rose-400 bg-rose-500/10",
                };
                return (
                  <div key={s.step} className="text-center">
                    <div className={`w-10 h-10 rounded-xl ${cls[s.color]} flex items-center justify-center mx-auto mb-2`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-white mb-1">{s.label}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MESSAGE BUS TAB ── */}
      {tab === "bus" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-400" /> Gửi Message giữa Agents
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">From Agent ID (tùy chọn)</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Agent ID nguồn..."
                  value={sendFrom}
                  onChange={(e) => setSendFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">To Agent ID *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="Agent ID đích..."
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Message Type</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={sendType}
                  onChange={(e) => setSendType(e.target.value)}
                >
                  {["task", "query", "result", "event", "broadcast"].map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Payload (JSON)</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  placeholder='{"task": "..."}'
                  value={sendPayload}
                  onChange={(e) => setSendPayload(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={() => sendMsgMut.mutate()}
              disabled={!sendTo || sendMsgMut.isPending}
              className="mt-4 px-5 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-50 transition-colors"
            >
              {sendMsgMut.isPending ? "Đang gửi..." : "Gửi Message"}
            </button>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Message Queue ({messagesData?.messages.length ?? 0})</h3>
            <div className="space-y-2">
              {(messagesData?.messages ?? []).length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-6">Chưa có messages. Gửi message đầu tiên ở trên.</p>
              ) : (
                messagesData?.messages.map((msg) => (
                  <div key={msg.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl text-xs">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      msg.status === "done" ? "bg-emerald-500/15 text-emerald-400" :
                      msg.status === "failed" ? "bg-rose-500/15 text-rose-400" :
                      msg.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                      "bg-blue-500/15 text-blue-400"
                    }`}>{msg.status}</div>
                    <span className="text-slate-500">[{msg.messageType}]</span>
                    <span className="text-slate-400">
                      {msg.fromAgentId ?? "sys"} <ChevronRight className="w-3 h-3 inline" /> {msg.toAgentId ?? "?"}
                    </span>
                    <span className="ml-auto text-slate-600">
                      {new Date(msg.createdAt).toLocaleTimeString("vi-VN")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── REGISTRY TAB ── */}
      {tab === "registry" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" /> Đăng ký Agent vào Global Registry
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tên Agent *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="vd: sdr-lead-hunter"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Version</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="1.0.0"
                  value={regVersion}
                  onChange={(e) => setRegVersion(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Capabilities (cách nhau bằng dấu phẩy)</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="sales, lead-gen, email"
                  value={regCaps}
                  onChange={(e) => setRegCaps(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={() => registerMut.mutate()}
              disabled={!regName || registerMut.isPending}
              className="mt-4 px-5 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-400 disabled:opacity-50 transition-colors"
            >
              {registerMut.isPending ? "Đang đăng ký..." : "Đăng ký Agent"}
            </button>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(registryData?.agents ?? []).map((ag, i) => (
              <motion.div key={ag.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{ag.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{ag.totalExecutions} runs</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-xs text-amber-400">{ag.reputationScore}%</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {((ag.capabilities ?? []) as string[]).slice(0, 4).map((c: string) => (
                    <span key={c} className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[10px] rounded">{c}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {ag.successRate.toFixed(0)}%
                  </span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full ${
                    ag.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"
                  }`}>{ag.status}</span>
                </div>
              </motion.div>
            ))}
            {(registryData?.agents ?? []).length === 0 && (
              <div className="col-span-3 text-center text-slate-600 py-12 text-sm">
                Chưa có agents trong registry. Đăng ký agent đầu tiên ở trên.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CAPABILITY ROUTER TAB ── */}
      {tab === "router" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Route className="w-4 h-4 text-cyan-400" /> Capability Router
            </h3>
            <p className="text-xs text-slate-500 mb-4">Nhập task bằng tiếng Anh hoặc tiếng Việt — hệ thống tự động tìm agent phù hợp nhất.</p>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white"
                placeholder="vd: Tìm lead logistics, Viết email marketing, Analyze competitor data..."
                value={routeTask}
                onChange={(e) => setRouteTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && routeTask && routeMut.mutate()}
              />
              <button
                onClick={() => routeMut.mutate()}
                disabled={!routeTask || routeMut.isPending}
                className="px-5 py-2 rounded-xl bg-cyan-500 text-black text-sm font-semibold hover:bg-cyan-400 disabled:opacity-50 transition-colors"
              >
                {routeMut.isPending ? "Routing..." : "Route"}
              </button>
            </div>

            {routeResult && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                {routeResult.routed ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Routed thành công!</span>
                    </div>
                    <p className="text-sm text-white">Agent: <span className="font-bold">{routeResult.agent?.name}</span></p>
                    <p className="text-xs text-slate-500 mt-1">Capabilities match: {routeResult.matchedCapabilities?.join(", ")}</p>
                    <p className="text-xs text-slate-500">Score: {routeResult.score}</p>
                    {routeResult.alternatives && routeResult.alternatives.length > 0 && (
                      <p className="text-xs text-slate-600 mt-2">Alternatives: {routeResult.alternatives.map((a) => a.name).join(", ")}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                    <p className="text-sm text-rose-400">Không tìm được agent phù hợp: {routeResult.reason}</p>
                    <p className="text-xs text-slate-500 mt-1">Gợi ý: đăng ký agents với capabilities tương ứng trong tab Registry.</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Capability Map</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { keyword: "lead / logistics", caps: ["sales", "sdr", "lead-gen", "crm"] },
                { keyword: "email / outreach", caps: ["email", "marketing", "copywriting"] },
                { keyword: "content / seo", caps: ["content", "writing", "blog"] },
                { keyword: "research / data", caps: ["research", "analytics", "bi"] },
                { keyword: "workflow / automation", caps: ["workflow", "pipeline"] },
                { keyword: "code / engineering", caps: ["code", "dev", "debugging"] },
                { keyword: "customer / support", caps: ["customer", "crm", "success"] },
              ].map((row) => (
                <div key={row.keyword} className="bg-white/3 rounded-xl p-3">
                  <p className="text-xs font-semibold text-white mb-2">"{row.keyword}"</p>
                  <div className="flex flex-wrap gap-1">
                    {row.caps.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] rounded">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── SHARED MEMORY TAB ── */}
      {tab === "memory" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" /> Ghi vào Shared Memory
            </h3>
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Scope</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  value={memScope}
                  onChange={(e) => setMemScope(e.target.value as "personal" | "team" | "department" | "organization")}
                >
                  {["personal", "team", "department", "organization"].map((s) => (
                    <option key={s} value={s} className="bg-zinc-900">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Key *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="vd: icp_target"
                  value={memKey}
                  onChange={(e) => setMemKey(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-400 mb-1 block">Value *</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                  placeholder="vd: logistics companies in HCMC"
                  value={memValue}
                  onChange={(e) => setMemValue(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={() => writeMut.mutate()}
              disabled={!memKey || !memValue || writeMut.isPending}
              className="mt-4 px-5 py-2 rounded-xl bg-violet-500 text-white text-sm font-medium hover:bg-violet-400 disabled:opacity-50 transition-colors"
            >
              {writeMut.isPending ? "Đang ghi..." : "Ghi Memory"}
            </button>
          </motion.div>

          {/* Memory layers visualization */}
          <div className="grid sm:grid-cols-4 gap-4">
            {(["organization", "department", "team", "personal"] as const).map((scope, i) => {
              const count = memoryData?.memories.filter((m) => m.scope === scope).length ?? 0;
              const colors: Record<string, string> = {
                organization: "amber", department: "blue", team: "emerald", personal: "violet",
              };
              const colorCls: Record<string, string> = {
                amber: "border-amber-500/30 text-amber-400",
                blue: "border-blue-500/30 text-blue-400",
                emerald: "border-emerald-500/30 text-emerald-400",
                violet: "border-violet-500/30 text-violet-400",
              };
              return (
                <motion.div key={scope} initial="hidden" animate="visible" variants={fade} custom={i}
                  className={`bg-white/3 border rounded-2xl p-4 text-center ${colorCls[colors[scope]] ?? ""}`}>
                  <p className="text-xs uppercase tracking-wider mb-2 opacity-70">{scope}</p>
                  <p className="text-3xl font-bold">{count}</p>
                  <p className="text-xs opacity-50 mt-1">entries</p>
                </motion.div>
              );
            })}
          </div>

          <motion.div initial="hidden" animate="visible" variants={fade} custom={4}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Memory Entries</h3>
            <div className="space-y-2">
              {(memoryData?.memories ?? []).length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-6">Chưa có memory entries.</p>
              ) : (
                memoryData?.memories.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      m.scope === "organization" ? "bg-amber-500/15 text-amber-400" :
                      m.scope === "department" ? "bg-blue-500/15 text-blue-400" :
                      m.scope === "team" ? "bg-emerald-500/15 text-emerald-400" :
                      "bg-violet-500/15 text-violet-400"
                    }`}>{m.scope}</span>
                    <span className="text-white font-mono font-medium">{m.key}</span>
                    <span className="text-slate-500 truncate flex-1">
                      {typeof m.value === "string" ? m.value : JSON.stringify(m.value)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── EVENTS TAB ── */}
      {tab === "events" && (
        <motion.div initial="hidden" animate="visible" variants={fade}
          className="bg-white/3 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Workforce Event Log ({eventsData?.events.length ?? 0})
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {(eventsData?.events ?? []).length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-12">Chưa có events.</p>
            ) : (
              eventsData?.events.map((ev) => {
                const Icon = EVENT_ICON[ev.eventType] ?? Activity;
                return (
                  <div key={ev.id} className="flex items-start gap-3 p-3 bg-white/3 rounded-xl">
                    <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-white">{ev.eventType}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${SEVERITY_COLOR[ev.severity] ?? ""}`}>
                          {ev.severity}
                        </span>
                        <span className="text-[10px] text-slate-600">{ev.sourceType}</span>
                      </div>
                      {ev.message && <p className="text-xs text-slate-400">{ev.message}</p>}
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">
                      {new Date(ev.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}

      {/* ── GRAPH TAB ── */}
      {tab === "graph" && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setGraphView("tree")}
              className={`px-3 py-1.5 rounded-lg text-sm ${graphView === "tree" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>
              Tree View
            </button>
            <button onClick={() => setGraphView("list")}
              className={`px-3 py-1.5 rounded-lg text-sm ${graphView === "list" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>
              List View
            </button>
          </div>

          {graphData && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <MetricCard label="Departments" value={graphData.graph.stats.totalDepartments} icon={Network} color="amber" />
                <MetricCard label="Teams" value={graphData.graph.stats.totalTeams} icon={Users} color="blue" />
                <MetricCard label="Agents" value={graphData.graph.stats.totalAgents} icon={Activity} color="emerald" />
              </div>

              <motion.div initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-400" />
                  {graphData.graph.organization?.name ?? "Organization"} — Workforce Structure
                </h3>
                <div className="space-y-4">
                  {graphData.graph.departments.map((dept) => (
                    <div key={dept.id} className="border-l-2 border-amber-500/40 pl-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-amber-400 rounded-full" />
                        <span className="text-sm font-semibold text-amber-400">{dept.name}</span>
                        <span className="text-xs text-slate-600">({dept.agents.length} agents)</span>
                      </div>
                      {dept.agents.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 ml-4 mb-1">
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                          <span className="text-xs text-slate-400">{a.name}</span>
                        </div>
                      ))}
                      {dept.teams.map((team) => (
                        <div key={team.id} className="ml-4 border-l border-blue-500/30 pl-3 mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                            <span className="text-xs font-medium text-blue-400">{team.name}</span>
                            <span className="text-[10px] text-slate-600">({team.agents.length} agents)</span>
                          </div>
                          {team.agents.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 ml-3 mb-1">
                              <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                              <span className="text-[11px] text-slate-500">{a.name}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                  {graphData.graph.departments.length === 0 && (
                    <p className="text-slate-600 text-sm text-center py-6">Chưa có departments. Tạo department trong Dashboard.</p>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </div>
      )}

      {/* ── FEDERATION TAB ── */}
      {tab === "federation" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Organization Federation</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Federation cho phép hai tổ chức chia sẻ Agents và Workflows qua API an toàn.
              Mỗi kết nối được bảo mật bằng API key riêng và cần được phê duyệt từ cả hai phía.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              {[
                { step: "1", label: "Gửi yêu cầu", desc: "POST /api/workforce/federation/link với provider org ID" },
                { step: "2", label: "Phê duyệt", desc: "Provider PATCH /api/workforce/federation/:id/approve" },
                { step: "3", label: "Chia sẻ", desc: "GET /api/workforce/federation/:id/shared — xem agents & workflows được chia sẻ" },
              ].map((s) => (
                <div key={s.step} className="bg-white/3 rounded-xl p-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold mb-2">{s.step}</div>
                  <p className="font-semibold text-white mb-1">{s.label}</p>
                  <p className="text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Federation Agreements ({fedData?.agreements.length ?? 0})</h3>
            {(fedData?.agreements ?? []).length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-6">Chưa có federation agreements.</p>
            ) : (
              <div className="space-y-3">
                {fedData?.agreements.map((ag) => (
                  <div key={ag.id} className="flex items-center gap-3 p-3 bg-white/3 rounded-xl text-xs">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <div>
                      <p className="text-white">Org {ag.requesterOrganizationId} ↔ Org {ag.providerOrganizationId}</p>
                      <p className="text-slate-500 mt-0.5">
                        Capabilities: {(ag.sharedCapabilities as string[]).join(", ") || "none"} •
                        {new Date(ag.createdAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        ag.isActive ? "bg-emerald-500/15 text-emerald-400" :
                        ag.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                        "bg-slate-500/15 text-slate-400"
                      }`}>{ag.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── SDK TAB ── */}
      {tab === "sdk" && (
        <div className="space-y-6">
          <motion.div initial="hidden" animate="visible" variants={fade}
            className="bg-white/3 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">AI Workforce TypeScript SDK</h3>
              <span className="ml-auto px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded">v1.0.0</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">SDK cho phép bên thứ ba tích hợp với AI Workforce Cloud Runtime.</p>
            <pre className="bg-black/50 rounded-xl p-4 text-xs text-emerald-300 overflow-x-auto">{`import { WorkforceSDK } from "@workforce/sdk";

const sdk = new WorkforceSDK({
  apiKey: "YOUR_API_KEY",
  baseUrl: "https://your-workforce.replit.app",
});

// Đăng ký Agent vào Global Registry
await sdk.registry.register({
  name: "sdr-lead-hunter",
  version: "1.0.0",
  capabilities: ["sales", "lead-gen", "email"],
});

// Gửi message qua Agent Bus
await sdk.bus.send({
  fromAgentId: 1,
  toAgentId: 2,
  messageType: "task",
  payload: { task: "tìm lead logistics tại HCMC" },
});

// Route task tự động
const result = await sdk.router.route("Tìm lead logistics");
console.log(result.agent.name); // → sdr-lead-hunter

// Đọc/ghi Shared Memory
await sdk.memory.write("organization", "icp_target", "logistics HCMC");
const mem = await sdk.memory.read({ scope: "organization" });

// Phát Workforce Event
await sdk.events.emit("TASK_CREATED", {
  taskId: 123, agentId: 1
});

// Xem Monitoring
const snapshot = await sdk.monitoring.snapshot();
console.log(snapshot.agents.active); // → số agents đang hoạt động`}
            </pre>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
              className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">REST API Endpoints</h3>
              <div className="space-y-2 text-xs font-mono">
                {[
                  ["POST", "/api/workforce/bus/send", "blue"],
                  ["GET", "/api/workforce/bus/messages", "blue"],
                  ["POST", "/api/workforce/registry", "emerald"],
                  ["GET", "/api/workforce/registry", "emerald"],
                  ["POST", "/api/workforce/route", "cyan"],
                  ["POST", "/api/workforce/memory", "violet"],
                  ["GET", "/api/workforce/memory", "violet"],
                  ["POST", "/api/workforce/events", "amber"],
                  ["GET", "/api/workforce/events", "amber"],
                  ["GET", "/api/workforce/monitoring", "rose"],
                  ["GET", "/api/workforce/graph", "blue"],
                  ["POST", "/api/workforce/federation/link", "purple"],
                ].map(([method, path, color]) => (
                  <div key={path} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      color === "blue" ? "bg-blue-500/15 text-blue-400" :
                      color === "emerald" ? "bg-emerald-500/15 text-emerald-400" :
                      color === "cyan" ? "bg-cyan-500/15 text-cyan-400" :
                      color === "violet" ? "bg-violet-500/15 text-violet-400" :
                      color === "amber" ? "bg-amber-500/15 text-amber-400" :
                      color === "rose" ? "bg-rose-500/15 text-rose-400" :
                      "bg-purple-500/15 text-purple-400"
                    }`}>{method}</span>
                    <span className="text-slate-300">{path}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
              className="bg-white/3 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Workforce Event Types</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  "TASK_CREATED", "TASK_COMPLETED", "TASK_FAILED",
                  "WORKFLOW_STARTED", "WORKFLOW_COMPLETED", "WORKFLOW_FAILED",
                  "AGENT_REGISTERED", "AGENT_UPDATED", "AGENT_DEACTIVATED",
                  "MESSAGE_SENT", "MESSAGE_DELIVERED",
                  "MEMORY_WRITTEN", "MEMORY_READ",
                  "CAPABILITY_ROUTED",
                  "FEDERATION_LINKED", "FEDERATION_REQUEST",
                ].map((et) => (
                  <span key={et} className="px-2 py-0.5 bg-white/5 text-slate-400 text-[10px] rounded font-mono">{et}</span>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-white mb-3 mt-5">Memory Scopes</h3>
              <div className="space-y-2">
                {[
                  { scope: "organization", desc: "Toàn tổ chức — mọi agent đều đọc được" },
                  { scope: "department", desc: "Trong một department" },
                  { scope: "team", desc: "Trong một team" },
                  { scope: "personal", desc: "Chỉ agent chủ sở hữu" },
                ].map((s) => (
                  <div key={s.scope} className="flex items-start gap-2 text-xs">
                    <span className="px-1.5 py-0.5 bg-violet-500/10 text-violet-400 rounded font-mono text-[10px]">{s.scope}</span>
                    <span className="text-slate-500">{s.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
