import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Users, Activity, AlertTriangle, CheckCircle,
  Clock, TrendingUp, Zap, BarChart3,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }),
};

interface CSData {
  activationRate: number;
  activatedCount: number;
  totalOrgs: number;
  trialUsers: number;
  expiringSoon: number;
  activatedTrials: number;
  trialConversionRate: number;
  churnRiskCount: number;
  paidCustomers: number;
  recentOrgs: {
    id: number;
    name: string;
    createdAt: string;
    trialEndsAt: string | null;
    isTrialing: boolean;
    isPaid: boolean;
    isActivated: boolean;
    tasksLast7d: number;
    churnRisk: boolean;
  }[];
}

function MetricCard({ label, value, sub, icon: Icon, color = "amber", warning = false, i = 0 }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string; warning?: boolean; i?: number;
}) {
  const colorMap: Record<string, string> = {
    amber:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
    rose:    "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  const cls = colorMap[color] ?? colorMap.amber;
  return (
    <motion.div
      initial="hidden" animate="visible" variants={fadeUp} custom={i}
      className={`bg-white/3 border rounded-2xl p-5 flex flex-col gap-3 ${warning ? "border-rose-500/30" : "border-white/10"}`}
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
      </div>
    </motion.div>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-slate-600"
    }`}>
      {label}
    </span>
  );
}

export default function CustomerSuccessPage() {
  const { data, isLoading } = useQuery<CSData>({
    queryKey: ["customer-success"],
    queryFn: () => apiFetch("/api/kpi/customer-success"),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-slate-400 animate-pulse text-sm">Đang tải dữ liệu...</div>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="w-6 h-6 text-emerald-400" /> Customer Success Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Theo dõi activation, churn risk và trial conversion</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Activation Rate"
          value={`${d.activationRate}%`}
          sub={`${d.activatedCount}/${d.totalOrgs} orgs đã kích hoạt`}
          icon={Zap}
          color="emerald"
          i={0}
        />
        <MetricCard
          label="Trial Conversion"
          value={`${d.trialConversionRate}%`}
          sub={`${d.paidCustomers} khách hàng trả phí`}
          icon={TrendingUp}
          color="amber"
          i={1}
        />
        <MetricCard
          label="Churn Risk"
          value={d.churnRiskCount}
          sub="Paid, 0 tasks trong 7 ngày"
          icon={AlertTriangle}
          color="rose"
          warning={d.churnRiskCount > 0}
          i={2}
        />
        <MetricCard
          label="Expiring Soon"
          value={d.expiringSoon}
          sub="Trial hết hạn trong ≤3 ngày"
          icon={Clock}
          color={d.expiringSoon > 0 ? "rose" : "blue"}
          warning={d.expiringSoon > 0}
          i={3}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Orgs" value={d.totalOrgs} sub="Tổng organizations" icon={Users} color="blue" i={0} />
        <MetricCard label="Trial Users" value={d.trialUsers} sub="Đang trong trial" icon={Zap} color="amber" i={1} />
        <MetricCard label="Activated Trials" value={d.activatedTrials} sub="Trial đã chạy workflow" icon={CheckCircle} color="emerald" i={2} />
        <MetricCard label="Paid Customers" value={d.paidCustomers} sub="Đang trả phí" icon={BarChart3} color="emerald" i={3} />
      </div>

      {/* Activation funnel */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp}
        className="bg-white/3 border border-white/10 rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-5">📊 Activation Funnel</h3>
        <div className="flex flex-col gap-2">
          {[
            { label: "Total Signups", value: d.totalOrgs, color: "bg-slate-500", pct: 100 },
            { label: "Started Trial", value: d.trialUsers, color: "bg-blue-500", pct: d.totalOrgs > 0 ? (d.trialUsers / d.totalOrgs) * 100 : 0 },
            { label: "Activated (ran workflow)", value: d.activatedCount, color: "bg-amber-500", pct: d.totalOrgs > 0 ? (d.activatedCount / d.totalOrgs) * 100 : 0 },
            { label: "Converted to Paid", value: d.paidCustomers, color: "bg-emerald-500", pct: d.totalOrgs > 0 ? (d.paidCustomers / d.totalOrgs) * 100 : 0 },
          ].map(({ label, value, color, pct }) => (
            <div key={label} className="flex items-center gap-4">
              <span className="text-xs text-slate-400 w-40 shrink-0">{label}</span>
              <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full ${color}/60 rounded-lg transition-all`}
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs text-white font-medium">
                  {value}
                </span>
              </div>
              <span className="text-xs text-slate-500 w-12 text-right">{pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent organizations table */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> Organizations Gần Đây
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Organization", "Ngày đăng ký", "Trial hết hạn", "Tasks (7d)", "Trạng thái", "Churn Risk"].map((h) => (
                  <th key={h} className="text-left px-6 py-3 text-xs text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.recentOrgs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-600 text-sm">
                    Chưa có organizations
                  </td>
                </tr>
              ) : (
                d.recentOrgs.map((org) => (
                  <tr key={org.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${org.churnRisk ? "bg-rose-500/5" : ""}`}>
                    <td className="px-6 py-3">
                      <p className="text-white font-medium text-sm">{org.name}</p>
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {new Date(org.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-3 text-slate-400 text-xs">
                      {org.trialEndsAt
                        ? new Date(org.trialEndsAt).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`font-mono text-sm ${org.tasksLast7d === 0 ? "text-slate-600" : "text-emerald-400"}`}>
                        {org.tasksLast7d}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge label="Paid" active={org.isPaid} />
                        <StatusBadge label="Trial" active={org.isTrialing} />
                        <StatusBadge label="Active" active={org.isActivated} />
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      {org.churnRisk ? (
                        <span className="flex items-center gap-1 text-rose-400 text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" /> Risk
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
