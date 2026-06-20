import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, BarChart2, Shield, Activity, Server, Globe,
  FileText, CheckCircle2, AlertTriangle, X, Loader2,
  Play, Download, TrendingUp, Award, Target, Package, Lock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const fade = {
  hidden: { opacity: 0, y: 8 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } }),
};

type BenchTab = "overview" | "load" | "stress" | "cost" | "reliability" | "evaluation" | "multitenant" | "security" | "observability" | "report";

interface BenchRun {
  id: number; name: string; type: string; status: string;
  readinessScore: number | null; durationMs: number | null;
  summary: Record<string, unknown>; createdAt: string;
}
interface BenchResult {
  id: number; testName: string; category: string; status: string;
  score: number | null; passed: boolean;
  metrics: Record<string, unknown>; details: Record<string, unknown>;
  durationMs: number | null;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : score >= 50 ? "#f97316" : "#ef4444";
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-black text-white leading-none">{grade}</span>
        <span className="text-[9px] text-slate-500">{score}</span>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, unit = "", color = "emerald" }: { label: string; value: string | number; unit?: string; color?: string }) {
  const cls: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    rose: "text-rose-400 bg-rose-500/10",
    violet: "text-violet-400 bg-violet-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
    slate: "text-slate-400 bg-slate-500/10",
  };
  return (
    <div className={`px-3 py-2 rounded-xl ${cls[color] ?? cls.slate} text-center`}>
      <p className="text-xs font-bold">{value}<span className="text-[10px] ml-0.5 opacity-70">{unit}</span></p>
      <p className="text-[9px] opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

function PassBadge({ passed }: { passed: boolean }) {
  return passed
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" />PASS</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400"><X className="w-2.5 h-2.5" />FAIL</span>;
}

function ProgressBar({ value, max, color = "emerald" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const cls: Record<string, string> = {
    emerald: "bg-emerald-500", blue: "bg-blue-500", amber: "bg-amber-500",
    rose: "bg-rose-500", violet: "bg-violet-500", cyan: "bg-cyan-500",
  };
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full transition-all duration-700 ${cls[color] ?? "bg-emerald-500"}`}
        style={{ width: `${pct}%` }} />
    </div>
  );
}

const CATEGORY_ICON: Record<string, React.ElementType> = {
  load: Zap, stress: Server, cost: BarChart2, reliability: Shield,
  evaluation: Target, "multi-tenant": Globe, security: Lock,
  observability: Activity, report: FileText,
};

export default function BenchmarkPage() {
  const [tab, setTab] = useState<BenchTab>("overview");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [agentScale, setAgentScale] = useState<"100" | "500" | "1000">("100");
  const reportRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: runsData, refetch: refetchRuns } = useQuery<{ runs: BenchRun[] }>({
    queryKey: ["benchmark-runs"],
    queryFn: () => apiFetch("/api/os/benchmark/runs"),
    refetchInterval: running ? 3000 : 15000,
  });

  const { data: runDetail, refetch: refetchDetail } = useQuery<{ run: BenchRun; results: BenchResult[] }>({
    queryKey: ["benchmark-run-detail", selectedRunId],
    queryFn: () => apiFetch(`/api/os/benchmark/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
    refetchInterval: running ? 2000 : false,
  });

  const { data: reportData } = useQuery<{
    run: BenchRun; results: BenchResult[];
    readiness: { score: number; grade: string; verdict: string; breakdown: Record<string, number> };
    recommendations: string[]; architecture: Record<string, string>;
    bottlenecks: { test: string; category: string; score: number | null }[];
    generatedAt: string;
  }>({
    queryKey: ["benchmark-report", selectedRunId],
    queryFn: () => apiFetch(`/api/os/benchmark/report/${selectedRunId}`),
    enabled: !!selectedRunId && tab === "report",
  });

  const fullBenchMut = useMutation({
    mutationFn: () => apiFetch("/api/os/benchmark/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Full Suite — ${new Date().toLocaleString("vi-VN")}`, tests: ["all"], agentScale }),
    }),
    onMutate: () => {
      setRunning(true);
      setProgress([]);
      const steps = [
        "Load Test (100/500/1000 agents)",
        "Workflow Stress Test (10K/100K)",
        "Cost Benchmark (5 models)",
        "Reliability Test (6 scenarios)",
        "Agent Evaluation (5 types)",
        "Multi-Tenant Benchmark (100 orgs)",
        "Security Audit (12 checks)",
        "Observability Report",
        "Computing Readiness Score",
        "Generating Executive Report",
      ];
      let i = 0;
      const iv = setInterval(() => {
        if (i < steps.length) { setProgress(p => [...p, `✅ ${steps[i]}`]); i++; }
        else clearInterval(iv);
      }, 850);
    },
    onSuccess: (data) => {
      const run = (data as { run: BenchRun }).run;
      setSelectedRunId(run.id);
      qc.invalidateQueries({ queryKey: ["benchmark-runs"] });
      setTimeout(() => {
        setRunning(false);
        refetchRuns();
        refetchDetail();
      }, 9500);
    },
    onError: () => setRunning(false),
  });

  const singleMut = useMutation({
    mutationFn: ({ endpoint, body }: { endpoint: string; body?: Record<string, unknown> }) =>
      apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: (data) => {
      const runId = (data as { run: BenchRun }).run.id;
      setSelectedRunId(runId);
      qc.invalidateQueries({ queryKey: ["benchmark-runs"] });
      qc.invalidateQueries({ queryKey: ["benchmark-run-detail", runId] });
    },
  });

  const tabs: { key: BenchTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Award },
    { key: "load", label: "Load Test", icon: Zap },
    { key: "stress", label: "Stress Test", icon: Server },
    { key: "cost", label: "Cost Benchmark", icon: TrendingUp },
    { key: "reliability", label: "Reliability", icon: Shield },
    { key: "evaluation", label: "Agent Eval", icon: Target },
    { key: "multitenant", label: "Multi-Tenant", icon: Globe },
    { key: "security", label: "Security Audit", icon: Lock },
    { key: "observability", label: "Observability", icon: Activity },
    { key: "report", label: "Executive Report", icon: FileText },
  ];

  const currentRun = runDetail?.run;
  const currentResults = runDetail?.results ?? [];
  const summary = currentRun?.summary as Record<string, unknown> | undefined;
  const readiness = summary?.readiness as {
    score: number; grade: string; verdict: string; breakdown: Record<string, number>
  } | undefined;

  const categoryMap: Record<BenchTab, string[]> = {
    overview: [], load: ["load"], stress: ["stress"], cost: ["cost"],
    reliability: ["reliability"], evaluation: ["evaluation"],
    multitenant: ["multi-tenant"], security: ["security"],
    observability: ["observability"], report: [],
  };
  const tabResults = (tab === "overview" || tab === "report")
    ? currentResults
    : currentResults.filter(r => (categoryMap[tab] ?? []).includes(r.category));

  function exportReport() {
    if (!reportRef.current) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>AI Workforce OS — Executive Report</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #000; color: #fff; padding: 40px; max-width: 1000px; margin: auto; }
  h1 { color: #a78bfa; } h2 { color: #6ee7b7; border-bottom: 1px solid #1f2937; padding-bottom: 8px; }
  h3 { color: #93c5fd; } table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #374151; padding: 8px 12px; text-align: left; font-size: 13px; }
  th { background: #111827; color: #9ca3af; }
  .pass { color: #10b981; } .fail { color: #ef4444; }
  .section { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; }
</style></head><body>
<h1>🚀 AI Workforce OS — Executive Report</h1>
<p style="color:#6b7280">Generated: ${new Date().toLocaleString("vi-VN")} | Run #${selectedRunId}</p>
${reportRef.current.innerHTML}
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workforce-os-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Workforce OS Benchmark Suite</h1>
            <p className="text-sm text-slate-500">Chứng minh hiệu năng thực tế — 10 bộ test toàn diện</p>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <select
              value={agentScale}
              onChange={(e) => setAgentScale(e.target.value as "100" | "500" | "1000")}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="100">100 Agents</option>
              <option value="500">500 Agents</option>
              <option value="1000">1000 Agents</option>
            </select>
            <button
              onClick={() => fullBenchMut.mutate()}
              disabled={running || fullBenchMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 disabled:opacity-50 transition-all"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Running..." : "Run Full Suite"}
            </button>
            {tab === "report" && selectedRunId && (
              <button
                onClick={exportReport}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-sm font-semibold hover:bg-violet-500/25 transition-all"
              >
                <Download className="w-4 h-4" /> Export HTML
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Live progress log */}
      <AnimatePresence>
        {running && progress.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-black/60 border border-amber-500/20 rounded-xl p-4 font-mono text-xs overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-400 font-semibold">Benchmark running...</span>
            </div>
            {progress.map((p, i) => <p key={i} className="text-emerald-400 leading-relaxed">{p}</p>)}
            {running && <p className="text-slate-500 animate-pulse">⏳ Processing next test...</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="flex gap-1 mt-5 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Run selector pills */}
      {(runsData?.runs ?? []).length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {(runsData?.runs ?? []).slice(0, 8).map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                selectedRunId === run.id
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-white/10 bg-white/3 text-slate-500 hover:border-white/20"
              }`}
            >
              {run.status === "running" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {run.status === "completed" && run.readinessScore !== null && (
                <span className={`font-bold ${run.readinessScore >= 80 ? "text-emerald-400" : run.readinessScore >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                  {Math.round(run.readinessScore)}
                </span>
              )}
              <span className="max-w-[140px] truncate">{run.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {(runsData?.runs ?? []).length === 0 && !running && (
        <motion.div initial="hidden" animate="visible" variants={fade}
          className="text-center py-20 border border-white/5 rounded-2xl bg-white/2">
          <Award className="w-12 h-12 text-amber-400/30 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Chưa có benchmark nào</h3>
          <p className="text-slate-500 text-sm mb-6">Click "Run Full Suite" để bắt đầu kiểm tra toàn diện hệ thống</p>
          <button
            onClick={() => fullBenchMut.mutate()}
            className="px-6 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
          >
            <Play className="w-4 h-4 inline mr-2" />Chạy Full Benchmark
          </button>
        </motion.div>
      )}

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {tab === "overview" && selectedRunId && currentRun && (
        <div className="space-y-5">
          {readiness && (
            <motion.div initial="hidden" animate="visible" variants={fade}
              className="bg-gradient-to-br from-violet-950/40 to-black border border-violet-500/20 rounded-2xl p-6">
              <div className="flex flex-wrap items-center gap-6">
                <ScoreRing score={readiness.score} size={100} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-1">Production Readiness Score</p>
                  <h2 className="text-3xl font-black text-white">{readiness.score}/100</h2>
                  <p className={`text-lg font-bold mt-1 ${readiness.score >= 85 ? "text-emerald-400" : readiness.score >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                    {readiness.verdict}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentRun.durationMs ? `Completed in ${(currentRun.durationMs / 1000).toFixed(1)}s` : "In progress..."}
                    {" · "}{currentResults.length} tests · {currentResults.filter(r => r.passed).length} passed
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(readiness.breakdown ?? {}).map(([cat, score]) => (
                    <MetricBadge key={cat} label={cat} value={Math.round(score)}
                      color={score >= 80 ? "emerald" : score >= 60 ? "amber" : "rose"} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {currentResults.map((r, i) => {
              const Icon = CATEGORY_ICON[r.category] ?? BarChart2;
              const iconColor = r.category === "security" ? "text-rose-400 bg-rose-500/10"
                : r.category === "reliability" ? "text-violet-400 bg-violet-500/10"
                : r.category === "cost" ? "text-amber-400 bg-amber-500/10"
                : r.category === "load" ? "text-emerald-400 bg-emerald-500/10"
                : "text-blue-400 bg-blue-500/10";
              return (
                <motion.div key={r.id} initial="hidden" animate="visible" variants={fade} custom={i}
                  className="bg-white/3 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{r.testName}</p>
                      <p className="text-[10px] text-slate-500">{r.durationMs ? `${r.durationMs}ms` : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.score !== null && (
                        <span className={`text-sm font-bold ${(r.score ?? 0) >= 80 ? "text-emerald-400" : (r.score ?? 0) >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                          {Math.round(r.score ?? 0)}
                        </span>
                      )}
                      <PassBadge passed={r.passed} />
                    </div>
                  </div>
                  <ProgressBar value={r.score ?? (r.passed ? 70 : 30)} max={100}
                    color={r.passed ? (r.category === "security" ? "violet" : "emerald") : "rose"} />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOAD TEST ──────────────────────────────────────────────────────── */}
      {tab === "load" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 p-4 bg-white/3 border border-white/10 rounded-2xl">
            {[100, 500, 1000].map((n) => (
              <button
                key={n}
                onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/load-test", body: { agentCount: n } })}
                disabled={singleMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/25 disabled:opacity-40 transition-all"
              >
                {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {n} Agents
              </button>
            ))}
          </div>

          {tabResults.map((r, i) => {
            const m = r.metrics as Record<string, unknown>;
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade} custom={i}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Duration: {r.durationMs}ms · Success: {m.successRate as string}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.score !== null && (
                      <span className={`text-xl font-black ${(r.score ?? 0) >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                        {Math.round(r.score ?? 0)}
                      </span>
                    )}
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  <MetricBadge label="Agents" value={m.agentCount as number} color="blue" />
                  <MetricBadge label="Completed" value={m.completed as number} color="emerald" />
                  <MetricBadge label="Failed" value={m.failed as number} color="rose" />
                  <MetricBadge label="p50" value={m.p50Ms as number} unit="ms" color="cyan" />
                  <MetricBadge label="p95" value={m.p95Ms as number} unit="ms" color="amber" />
                  <MetricBadge label="p99" value={m.p99Ms as number} unit="ms" color={((m.p99Ms as number) ?? 0) > 200 ? "rose" : "emerald"} />
                  <MetricBadge label="Throughput" value={m.throughputRps as number} unit="/s" color="violet" />
                  <MetricBadge label="Memory" value={m.memUsageMb as number} unit="MB" color="slate" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-600 mb-1">Queue Time: {m.queueTimeMs as number}ms</p>
                    <ProgressBar value={m.queueTimeMs as number} max={5000} color="amber" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 mb-1">Memory Usage: {m.memUsageMb as number}MB</p>
                    <ProgressBar value={m.memUsageMb as number} max={16000} color="blue" />
                  </div>
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && (
            <div className="text-center py-12 text-slate-600 text-sm">
              Chưa có kết quả Load Test. Chọn số agents ở trên hoặc chạy Full Suite.
            </div>
          )}
        </div>
      )}

      {/* ── STRESS TEST ────────────────────────────────────────────────────── */}
      {tab === "stress" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">10.000 workflows + 100.000 tasks — kiểm tra khả năng mở rộng tối đa</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/stress-test" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-400 text-sm font-bold hover:bg-blue-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Stress Test
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as Record<string, unknown>;
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                  <div className="flex items-center gap-2">
                    {r.score !== null && (
                      <span className={`text-xl font-black ${(r.score ?? 0) >= 80 ? "text-blue-400" : "text-amber-400"}`}>
                        {Math.round(r.score ?? 0)}
                      </span>
                    )}
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-semibold">WORKFLOWS (10,000)</p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <MetricBadge label="Completed" value={m.workflowsCompleted as number} color="emerald" />
                      <MetricBadge label="Failed" value={m.workflowsFailed as number} color="rose" />
                      <MetricBadge label="/s" value={m.wfThroughputRps as number} color="blue" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricBadge label="WF p95" value={m.wfP95Ms as number} unit="ms" color="amber" />
                      <MetricBadge label="WF p99" value={m.wfP99Ms as number} unit="ms" color={((m.wfP99Ms as number) ?? 0) > 500 ? "rose" : "emerald"} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-semibold">TASKS (100,000)</p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <MetricBadge label="Completed" value={m.tasksCompleted as number} color="emerald" />
                      <MetricBadge label="Failed" value={m.tasksFailed as number} color="rose" />
                      <MetricBadge label="/s" value={m.taskThroughputRps as number} color="blue" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricBadge label="Task p95" value={m.taskP95Ms as number} unit="ms" color="amber" />
                      <MetricBadge label="Task p99" value={m.taskP99Ms as number} unit="ms" color={((m.taskP99Ms as number) ?? 0) > 200 ? "rose" : "emerald"} />
                    </div>
                  </div>
                </div>
                {(r.details as Record<string, string>).bottleneck && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                    ⚠️ Bottleneck: {(r.details as Record<string, string>).bottleneck}
                  </div>
                )}
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Stress Test.</div>}
        </div>
      )}

      {/* ── COST BENCHMARK ─────────────────────────────────────────────────── */}
      {tab === "cost" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">So sánh 5 models: GPT-4o-mini · GPT-4o · GPT-5 · Claude 3.5 Sonnet · Gemini 1.5 Pro</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/cost-compare" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-400 text-sm font-bold hover:bg-amber-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Compare Models
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as { models: Record<string, unknown>[]; bestModel: string; bestEfficiency: number };
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                    <p className="text-xs text-emerald-400 mt-0.5">🏆 Best value: {m.bestModel}</p>
                  </div>
                  <PassBadge passed={r.passed} />
                </div>
                <div className="space-y-3">
                  {(m.models ?? []).map((model: Record<string, unknown>, idx: number) => {
                    const maxEff = Math.max(...(m.models ?? []).map((x: Record<string, unknown>) => x.efficiencyScore as number));
                    const effPct = ((model.efficiencyScore as number) / maxEff) * 100;
                    const isRec = (model.recommendation as string)?.includes("Recommended");
                    return (
                      <div key={idx} className={`p-3 rounded-xl border ${isRec ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5 bg-white/2"}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-sm font-semibold text-white w-40">{model.model as string}</p>
                          <span className="text-[10px] text-slate-500">{model.recommendation as string}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                          <MetricBadge label="$/1K tok" value={`$${model.costPer1kTokens}`} color="amber" />
                          <MetricBadge label="p50 latency" value={model.p50LatencyMs as number} unit="ms" color="blue" />
                          <MetricBadge label="Quality" value={model.qualityScore as number} unit="/100" color="emerald" />
                          <MetricBadge label="Efficiency" value={model.efficiencyScore as number} color={isRec ? "emerald" : "slate"} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-600 w-16">Efficiency</span>
                          <ProgressBar value={effPct} max={100} color={isRec ? "emerald" : "blue"} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Cost Benchmark.</div>}
        </div>
      )}

      {/* ── RELIABILITY ────────────────────────────────────────────────────── */}
      {tab === "reliability" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">6 failure scenarios: Redis down · PostgreSQL restart · OpenAI timeout · Worker crash</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/reliability" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/15 border border-violet-500/20 text-violet-400 text-sm font-bold hover:bg-violet-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Reliability
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as { scenarios: Record<string, unknown>[]; recovered: number; mttrMs: number; availabilityPct: string };
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">MTTR: {m.mttrMs}ms · Availability: {m.availabilityPct}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MetricBadge label="Recovered" value={`${m.recovered}/${(m.scenarios ?? []).length}`} color="emerald" />
                    {r.score !== null && (
                      <span className={`text-xl font-black ${(r.score ?? 0) >= 80 ? "text-violet-400" : "text-amber-400"}`}>
                        {Math.round(r.score ?? 0)}
                      </span>
                    )}
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="space-y-2">
                  {(m.scenarios ?? []).map((s: Record<string, unknown>, idx: number) => (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border ${s.recovered ? "border-emerald-500/15 bg-emerald-500/5" : "border-rose-500/15 bg-rose-500/5"}`}>
                      <span className="text-base">{s.recovered ? "✅" : "❌"}</span>
                      <div className="flex-1">
                        <p className="text-sm text-white">{s.scenario as string}</p>
                        <p className="text-xs text-slate-500">Recovery time: {s.recoveryMs as number}ms</p>
                      </div>
                      <div className="w-24">
                        <ProgressBar value={s.recoveryMs as number} max={20000}
                          color={(s.recoveryMs as number) < 3000 ? "emerald" : (s.recoveryMs as number) < 7000 ? "amber" : "rose"} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Reliability Test.</div>}
        </div>
      )}

      {/* ── AGENT EVALUATION ───────────────────────────────────────────────── */}
      {tab === "evaluation" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">Đánh giá 5 loại agent theo accuracy · consistency · completion rate · hallucination</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/agent-eval" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 text-sm font-bold hover:bg-cyan-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Evaluation
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as { agents: Record<string, unknown>[]; avgOverallScore: number };
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Avg Score: <span className="text-white font-bold">{m.avgOverallScore}</span></span>
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="space-y-3">
                  {(m.agents ?? []).map((agent: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="p-3 bg-white/3 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`text-xl font-black w-7 text-center ${agent.grade === "A" ? "text-emerald-400" : agent.grade === "B" ? "text-blue-400" : agent.grade === "C" ? "text-amber-400" : "text-rose-400"}`}>
                          {agent.grade as string}
                        </span>
                        <p className="text-sm font-semibold text-white capitalize">{agent.agentType as string} Agent</p>
                        <span className="ml-auto text-sm font-bold text-white">{agent.overallScore as number}/100</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "Accuracy", key: "accuracyPct", color: "emerald" },
                          { label: "Consistency", key: "consistencyPct", color: "blue" },
                          { label: "Completion", key: "completionRatePct", color: "violet" },
                          { label: "Hallucination ↓", key: "hallucinationRatePct", color: "rose", max: 20 },
                        ].map(({ label, key, color, max = 100 }) => (
                          <div key={key}>
                            <p className="text-[9px] text-slate-600 mb-1">{label}</p>
                            <ProgressBar value={agent[key] as number} max={max} color={color} />
                            <p className="text-[9px] text-slate-500 mt-0.5">{agent[key] as number}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Agent Evaluation.</div>}
        </div>
      )}

      {/* ── MULTI-TENANT ───────────────────────────────────────────────────── */}
      {tab === "multitenant" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">100 organizations × 10 agents × 100 workflows — kiểm tra isolation đa tenant</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/multi-tenant" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-500/15 border border-slate-500/20 text-slate-300 text-sm font-bold hover:bg-slate-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run Multi-Tenant
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as Record<string, unknown>;
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                  <div className="flex items-center gap-2">
                    {r.score !== null && (
                      <span className={`text-xl font-black ${(r.score ?? 0) >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                        {Math.round(r.score ?? 0)}
                      </span>
                    )}
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MetricBadge label="Orgs Simulated" value={m.organizationsSimulated as number} color="blue" />
                  <MetricBadge label="Total Agents" value={m.totalAgents as number} color="emerald" />
                  <MetricBadge label="Total Workflows" value={m.totalWorkflows as number} color="violet" />
                  <MetricBadge label="Isolation" value={`${m.isolationScorePct}%`} color={(m.isolationScorePct as number) >= 100 ? "emerald" : "rose"} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBadge label="p95 Latency" value={m.p95LatencyMs as number} unit="ms" color="amber" />
                  <MetricBadge label="p99 Latency" value={m.p99LatencyMs as number} unit="ms" color={(m.p99LatencyMs as number) > 200 ? "rose" : "emerald"} />
                  <MetricBadge label="X-Tenant Blocked" value={`${m.crossTenantBlocked}/${m.crossTenantAttempts}`} color="emerald" />
                </div>
                <div className={`p-3 rounded-xl border text-xs ${(m.isolationViolations as number) === 0 ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-rose-500/20 bg-rose-500/5 text-rose-400"}`}>
                  {(r.details as Record<string, string>).tenantIsolation}
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Multi-Tenant Benchmark.</div>}
        </div>
      )}

      {/* ── SECURITY AUDIT ─────────────────────────────────────────────────── */}
      {tab === "security" && (
        <div className="space-y-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">12 security checks: injection · privilege escalation · memory leakage · cross-tenant</p>
            <button
              onClick={() => singleMut.mutate({ endpoint: "/api/os/benchmark/security-audit" })}
              disabled={singleMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 text-sm font-bold hover:bg-rose-500/25 disabled:opacity-40"
            >
              {singleMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Run Security Audit
            </button>
          </div>
          {tabResults.map((r) => {
            const m = r.metrics as { checks: Record<string, unknown>[]; passed: number; criticalPassed: number; criticalTotal: number; securityScore: number };
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {m.passed}/{(m.checks ?? []).length} passed · Critical: {m.criticalPassed}/{m.criticalTotal} ·
                      Risk: <span className={m.securityScore >= 90 ? "text-emerald-400" : m.securityScore >= 70 ? "text-amber-400" : "text-rose-400"}>
                        {(r.details as Record<string, string>).riskLevel}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-black ${m.securityScore >= 90 ? "text-emerald-400" : m.securityScore >= 70 ? "text-amber-400" : "text-rose-400"}`}>
                      {Math.round(m.securityScore)}
                    </span>
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(m.checks ?? []).map((check: Record<string, unknown>, idx: number) => {
                    const passed = (check.status as string).includes("PASS");
                    return (
                      <div key={idx} className={`flex items-start gap-2 p-2.5 rounded-lg ${!passed ? "bg-rose-500/5 border border-rose-500/10" : ""}`}>
                        <span className="text-sm mt-0.5">{passed ? "✅" : "❌"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-white">{check.name as string}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${check.severity === "critical" ? "bg-rose-500/15 text-rose-400" : check.severity === "high" ? "bg-amber-500/15 text-amber-400" : "bg-slate-500/15 text-slate-400"}`}>
                              {check.severity as string}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{check.detail as string}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">Chưa có kết quả Security Audit.</div>}
        </div>
      )}

      {/* ── OBSERVABILITY ──────────────────────────────────────────────────── */}
      {tab === "observability" && (
        <div className="space-y-5">
          <p className="text-sm text-slate-400">p50 · p95 · p99 latency · error rate · token usage · cost — across 5 time windows</p>
          {tabResults.map((r) => {
            const m = r.metrics as { windows: Record<string, unknown>[] };
            return (
              <motion.div key={r.id} initial="hidden" animate="visible" variants={fade}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white">{r.testName}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${(r.details as Record<string, string>).slaStatus?.includes("✅") ? "text-emerald-400" : "text-amber-400"}`}>
                      {(r.details as Record<string, string>).slaStatus}
                    </span>
                    <PassBadge passed={r.passed} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        {["Window", "p50", "p95", "p99", "Error %", "RPS", "Tokens", "Cost", "Agents"].map(h => (
                          <th key={h} className="text-left text-slate-500 pb-2 pr-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(m.windows ?? []).map((w: Record<string, unknown>, idx: number) => (
                        <tr key={idx} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white font-mono font-bold">{w.window as string}</td>
                          <td className="py-2 pr-4 text-cyan-400">{w.p50LatencyMs as number}ms</td>
                          <td className="py-2 pr-4 text-amber-400">{w.p95LatencyMs as number}ms</td>
                          <td className={`py-2 pr-4 font-semibold ${(w.p99LatencyMs as number) > 500 ? "text-rose-400" : "text-emerald-400"}`}>{w.p99LatencyMs as number}ms</td>
                          <td className={`py-2 pr-4 ${(w.errorRatePct as number) > 1 ? "text-rose-400" : "text-emerald-400"}`}>{w.errorRatePct as number}%</td>
                          <td className="py-2 pr-4 text-blue-400">{w.requestsPerSec as number}</td>
                          <td className="py-2 pr-4 text-violet-400">{(w.tokenUsage as number).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-amber-400">${w.costUsd as number}</td>
                          <td className="py-2 text-slate-400">{w.activeAgents as number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            );
          })}
          {tabResults.length === 0 && (
            <div className="text-center py-12 text-slate-600 text-sm">
              Observability data xuất hiện sau khi chạy Full Benchmark Suite.
            </div>
          )}
        </div>
      )}

      {/* ── EXECUTIVE REPORT ───────────────────────────────────────────────── */}
      {tab === "report" && (
        <div className="space-y-5">
          {!selectedRunId && (
            <div className="text-center py-12 text-slate-600 text-sm">Chọn một run ở trên để xem Executive Report.</div>
          )}
          {selectedRunId && !reportData && (
            <div className="text-center py-12 text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading report...
            </div>
          )}
          {reportData && (
            <div ref={reportRef} className="space-y-5">
              {/* Summary card */}
              <motion.div initial="hidden" animate="visible" variants={fade}
                className="bg-gradient-to-br from-violet-950/50 to-black border border-violet-500/20 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white mb-1">AI Workforce OS — Executive Report</h2>
                    <p className="text-xs text-slate-500">
                      Generated: {new Date(reportData.generatedAt).toLocaleString("vi-VN")} · Run #{reportData.run.id}
                    </p>
                    <div className="flex gap-3 flex-wrap mt-3">
                      <div className={`px-4 py-2 rounded-xl text-sm font-bold border ${reportData.readiness.score >= 85 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : reportData.readiness.score >= 70 ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                        {reportData.readiness.verdict}
                      </div>
                      <div className="px-4 py-2 rounded-xl text-xs text-slate-400 border border-white/10">
                        {reportData.results.filter(r => r.passed).length}/{reportData.results.length} tests passed
                      </div>
                      {reportData.run.durationMs && (
                        <div className="px-4 py-2 rounded-xl text-xs text-slate-400 border border-white/10">
                          Completed in {(reportData.run.durationMs / 1000).toFixed(1)}s
                        </div>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={reportData.readiness.score} size={90} />
                </div>
              </motion.div>

              {/* Score breakdown */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={1}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Score Breakdown by Category
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Object.entries(reportData.readiness.breakdown ?? {}).map(([cat, score]) => (
                    <div key={cat} className="text-center">
                      <div className={`text-2xl font-black ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                        {Math.round(score)}
                      </div>
                      <div className="text-[9px] text-slate-500 capitalize mt-1">{cat}</div>
                      <ProgressBar value={score} max={100} color={score >= 80 ? "emerald" : score >= 60 ? "amber" : "rose"} />
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Architecture */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={2}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-400" /> System Architecture
                </h3>
                <div className="space-y-2">
                  {Object.entries(reportData.architecture).map(([key, desc]) => (
                    <div key={key} className="flex gap-3 text-xs">
                      <span className="text-blue-400 font-semibold capitalize w-24 flex-shrink-0">{key}</span>
                      <span className="text-slate-300">{desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Bottlenecks */}
              {reportData.bottlenecks.length > 0 && (
                <motion.div initial="hidden" animate="visible" variants={fade} custom={3}
                  className="bg-rose-950/30 border border-rose-500/20 rounded-2xl p-5">
                  <h3 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Bottlenecks Detected
                  </h3>
                  <div className="space-y-2">
                    {reportData.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-rose-400">●</span>
                        <span className="text-white">{b.test}</span>
                        <span className="text-slate-500">({b.category})</span>
                        {b.score !== null && <span className="text-rose-400 ml-auto font-bold">{Math.round(b.score ?? 0)}/100</span>}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Recommendations */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={4}
                className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Optimization Recommendations
                </h3>
                <div className="space-y-2">
                  {(reportData.recommendations.length > 0 ? reportData.recommendations : [
                    "💰 Use GPT-4o-mini for routine tasks, reserve GPT-4o for complex reasoning",
                    "📊 Set up alerting for p99 > 500ms and error rate > 1%",
                    "🔐 Enforce rate limiting at API gateway level for all orgs",
                    "⚡ Scale horizontally with Kubernetes for >500 concurrent agents",
                    "🔧 Add circuit breakers between agent→LLM calls to handle provider outages",
                  ]).map((rec, i) => (
                    <p key={i} className="text-xs text-emerald-300 leading-relaxed">{rec}</p>
                  ))}
                </div>
              </motion.div>

              {/* Full results table */}
              <motion.div initial="hidden" animate="visible" variants={fade} custom={5}
                className="bg-white/3 border border-white/10 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-3">Full Test Results</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-slate-500 pb-2 pr-4">Test</th>
                        <th className="text-left text-slate-500 pb-2 pr-4">Category</th>
                        <th className="text-left text-slate-500 pb-2 pr-4">Score</th>
                        <th className="text-left text-slate-500 pb-2 pr-4">Status</th>
                        <th className="text-left text-slate-500 pb-2">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.results.map((r, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 pr-4 text-white">{r.testName}</td>
                          <td className="py-2 pr-4 text-slate-500 capitalize">{r.category}</td>
                          <td className={`py-2 pr-4 font-bold ${(r.score ?? 0) >= 80 ? "text-emerald-400" : (r.score ?? 0) >= 60 ? "text-amber-400" : "text-rose-400"}`}>
                            {r.score !== null ? Math.round(r.score ?? 0) : "—"}
                          </td>
                          <td className="py-2 pr-4"><PassBadge passed={r.passed} /></td>
                          <td className="py-2 text-slate-500">{r.durationMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
