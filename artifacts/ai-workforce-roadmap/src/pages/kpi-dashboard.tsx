import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, DollarSign, BarChart3, Target,
  Activity, AlertTriangle, ArrowUpRight, Zap, Mail,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }),
};

interface KpiData {
  mrr: number;
  arr: number;
  activeCustomers: number;
  trialUsers: number;
  totalSignups: number;
  conversionRate: number;
  cac: number;
  ltv: number;
  newLeads30d: number;
  totalLeads: number;
  pipelineValue: number;
  workflowRuns30d: number;
  mrrTrend: { month: string; count: number }[];
  dealsByStage: { stage: string; totalValue: string; count: number }[];
}

function KpiCard({
  label, value, sub, icon: Icon, color = "amber", trend, i = 0
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; trend?: string; i?: number;
}) {
  const colorMap: Record<string, string> = {
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };
  const cls = colorMap[color] ?? colorMap.amber;
  return (
    <motion.div
      initial="hidden" animate="visible" variants={fadeUp} custom={i}
      className="bg-white/3 border border-white/10 rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cls}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        {trend && (
          <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
            <ArrowUpRight className="w-3 h-3" /> {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  lead:  { label: "Lead",  color: "bg-slate-500"  },
  demo:  { label: "Demo",  color: "bg-blue-500"   },
  trial: { label: "Trial", color: "bg-amber-500"  },
  paid:  { label: "Paid",  color: "bg-emerald-500" },
};

export default function KpiDashboard() {
  const { data, isLoading } = useQuery<KpiData>({
    queryKey: ["kpi-overview"],
    queryFn: () => apiFetch("/api/kpi/overview"),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-slate-400 animate-pulse text-sm">Đang tải KPI...</div>
      </div>
    );
  }

  const d = data!;
  const ltvCac = d.cac > 0 ? (d.ltv / d.cac).toFixed(1) : "∞";

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-400" /> KPI Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Theo dõi tăng trưởng kinh doanh theo thời gian thực</p>
      </div>

      {/* Revenue KPIs */}
      <div>
        <h2 className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-4">💰 Doanh thu</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="MRR" value={`$${d.mrr.toLocaleString()}`} sub="Monthly Recurring Revenue" icon={DollarSign} color="emerald" trend="Tháng này" i={0} />
          <KpiCard label="ARR" value={`$${d.arr.toLocaleString()}`} sub="Annual Recurring Revenue" icon={TrendingUp} color="emerald" i={1} />
          <KpiCard label="Pipeline Value" value={`$${d.pipelineValue.toLocaleString()}`} sub="Tổng giá trị deals" icon={Target} color="amber" i={2} />
          <KpiCard label="LTV/CAC" value={ltvCac} sub={`LTV $${d.ltv} · CAC $${d.cac}`} icon={Activity} color="blue" i={3} />
        </div>
      </div>

      {/* Customer KPIs */}
      <div>
        <h2 className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-4">👥 Khách hàng</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Active Customers" value={d.activeCustomers} sub="Đang trả phí" icon={Users} color="emerald" i={0} />
          <KpiCard label="Trial Users" value={d.trialUsers} sub="Đang dùng thử" icon={Zap} color="amber" i={1} />
          <KpiCard label="Total Signups" value={d.totalSignups} sub="Tổng đăng ký" icon={Users} color="blue" i={2} />
          <KpiCard label="Conversion Rate" value={`${d.conversionRate}%`} sub="Trial → Paid" icon={ArrowUpRight} color="purple" i={3} />
        </div>
      </div>

      {/* Lead & Activity KPIs */}
      <div>
        <h2 className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-4">📊 Leads & Hoạt động</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="New Leads (30d)" value={d.newLeads30d} sub="Leads mới trong 30 ngày" icon={Mail} color="cyan" i={0} />
          <KpiCard label="Total Leads" value={d.totalLeads} sub="Tổng marketing leads" icon={Mail} color="cyan" i={1} />
          <KpiCard label="Workflow Runs (30d)" value={d.workflowRuns30d} sub="Lần chạy workflow" icon={Activity} color="purple" i={2} />
          <KpiCard label="CAC" value={`$${d.cac}`} sub="Customer Acquisition Cost" icon={DollarSign} color="rose" i={3} />
        </div>
      </div>

      {/* MRR Trend + Deal Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Trend */}
        <motion.div
          initial="hidden" animate="visible" variants={fadeUp}
          className="bg-white/3 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> MRR Trend (6 tháng)
          </h3>
          {d.mrrTrend.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              Chưa có dữ liệu
            </div>
          ) : (
            <div className="space-y-3">
              {d.mrrTrend.map((m) => {
                const maxCount = Math.max(...d.mrrTrend.map((x) => Number(x.count)));
                const pct = maxCount > 0 ? (Number(m.count) / maxCount) * 100 : 0;
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-14 shrink-0">{m.month}</span>
                    <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/50 rounded-lg transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{m.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Deal Pipeline */}
        <motion.div
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
          className="bg-white/3 border border-white/10 rounded-2xl p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" /> Deal Pipeline by Stage
          </h3>
          {d.dealsByStage.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
              Chưa có deals
            </div>
          ) : (
            <div className="space-y-4">
              {["lead", "demo", "trial", "paid"].map((stage) => {
                const stageData = d.dealsByStage.find((s) => s.stage === stage);
                const count = Number(stageData?.count ?? 0);
                const value = Number(stageData?.totalValue ?? 0);
                const info = STAGE_LABELS[stage];
                const maxCount = Math.max(...d.dealsByStage.map((s) => Number(s.count)));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                return (
                  <div key={stage} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${info.color}`} />
                        <span className="text-slate-300">{info.label}</span>
                      </div>
                      <div className="text-slate-400">
                        {count} deals · ${value.toLocaleString()}
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${info.color}/60`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Summary Row */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp}
        className="bg-gradient-to-r from-amber-500/5 to-emerald-500/5 border border-white/10 rounded-2xl p-6"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "LTV", value: `$${d.ltv.toLocaleString()}`, desc: "Avg lifetime value" },
            { label: "CAC", value: `$${d.cac}`, desc: "Avg acquisition cost" },
            { label: "LTV/CAC Ratio", value: ltvCac + "x", desc: ">3x = healthy" },
            { label: "Payback Period", value: d.cac > 0 && d.mrr / Math.max(d.activeCustomers, 1) > 0 ? `${Math.round(d.cac / (d.mrr / Math.max(d.activeCustomers, 1)))} tháng` : "N/A", desc: "Months to recover CAC" },
          ].map(({ label, value, desc }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-amber-400">{value}</p>
              <p className="text-xs font-medium text-white mt-1">{label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
