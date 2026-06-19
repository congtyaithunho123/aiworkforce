import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { CreditCard, Zap, CheckCircle, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: number;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: string;
  maxAgents: number;
  maxWorkflows: number;
  maxTasksPerMonth: number;
  maxTokensPerMonth: number;
  maxTeamMembers: number;
}

interface BillingData {
  subscription: { id: number; status: string; currentPeriodEnd: string };
  plan: Plan;
  usage: {
    tasksUsed: number;
    workflowsUsed: number;
    tokensUsed: number;
    estimatedCost: number;
    tasksRemaining: number;
    tokensRemaining: number;
    tasksPercent: number;
    tokensPercent: number;
  };
}

function UsageBar({ label, used, max, percent, color = "amber" }: {
  label: string; used: number; max: number; percent: number; color?: string;
}) {
  const colorClass = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">
          {used.toLocaleString()} / {max.toLocaleString()}
          <span className="ml-2 text-xs text-slate-500">({percent}%)</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 80 && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Sắp đạt giới hạn
        </p>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [upgrading, setUpgrading] = useState(false);

  const { data, isLoading } = useQuery<BillingData>({
    queryKey: ["billing"],
    queryFn: () => apiFetch("/api/subscriptions/current"),
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["plans"],
    queryFn: () => apiFetch("/api/subscriptions/plans"),
  });

  const upgradeMutation = useMutation({
    mutationFn: (planName: string) =>
      apiFetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName }),
      }),
    onSuccess: () => {
      toast({ title: "Nâng cấp thành công!" });
      qc.invalidateQueries({ queryKey: ["billing"] });
      setUpgrading(false);
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-slate-400 animate-pulse">Đang tải...</div>
    </div>
  );

  const { subscription, plan, usage } = data!;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <CreditCard className="w-6 h-6" /> Billing & Subscription
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Quản lý gói dịch vụ và theo dõi mức sử dụng</p>
      </div>

      {/* Current Plan */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 uppercase font-semibold">
              {plan.displayName}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${subscription.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {subscription.status === "active" ? "Đang hoạt động" : subscription.status}
            </span>
          </div>
          <p className="text-slate-300 text-sm mt-1">{plan.description}</p>
          <p className="text-slate-500 text-xs mt-2">
            Chu kỳ hiện tại kết thúc: {new Date(subscription.currentPeriodEnd).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">${plan.priceMonthly}<span className="text-sm text-slate-400">/tháng</span></div>
          <button
            onClick={() => setUpgrading(true)}
            className="mt-2 text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-lg px-3 py-1.5 transition-colors"
          >
            Nâng cấp gói
          </button>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="font-semibold text-slate-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" /> Mức sử dụng tháng này
        </h2>
        <UsageBar
          label="Tasks chạy"
          used={usage.tasksUsed}
          max={plan.maxTasksPerMonth}
          percent={usage.tasksPercent}
        />
        <UsageBar
          label="Tokens AI"
          used={usage.tokensUsed}
          max={plan.maxTokensPerMonth}
          percent={usage.tokensPercent}
        />
      </div>

      {/* Cost summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Chi phí AI tháng này</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">${usage.estimatedCost.toFixed(4)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Tasks còn lại</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{usage.tasksRemaining.toLocaleString()}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Tokens còn lại</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{usage.tokensRemaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Plan limits */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Giới hạn gói {plan.displayName}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Agents", value: plan.maxAgents >= 9999 ? "Không giới hạn" : plan.maxAgents },
            { label: "Workflows", value: plan.maxWorkflows >= 9999 ? "Không giới hạn" : plan.maxWorkflows },
            { label: "Tasks/tháng", value: plan.maxTasksPerMonth >= 99999 ? "Không giới hạn" : plan.maxTasksPerMonth.toLocaleString() },
            { label: "Thành viên", value: plan.maxTeamMembers >= 9999 ? "Không giới hạn" : plan.maxTeamMembers },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade modal */}
      {upgrading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full space-y-6">
            <h3 className="text-lg font-semibold text-white">Chọn gói</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 space-y-3 ${p.id === plan.id ? "border-amber-500/50 bg-amber-500/5" : "border-white/10 bg-white/5"}`}
                >
                  <div>
                    <p className="font-semibold text-white">{p.displayName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>
                  </div>
                  <p className="text-xl font-bold text-amber-400">
                    ${p.priceMonthly}<span className="text-sm text-slate-400">/tháng</span>
                  </p>
                  <ul className="text-xs text-slate-400 space-y-1">
                    <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {p.maxAgents >= 9999 ? "∞" : p.maxAgents} Agents</li>
                    <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {p.maxTasksPerMonth >= 99999 ? "∞" : p.maxTasksPerMonth.toLocaleString()} Tasks/tháng</li>
                    <li className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {p.maxTeamMembers >= 9999 ? "∞" : p.maxTeamMembers} Thành viên</li>
                  </ul>
                  <button
                    onClick={() => upgradeMutation.mutate(p.name)}
                    disabled={p.id === plan.id || upgradeMutation.isPending}
                    className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 hover:bg-amber-400 text-black"
                  >
                    {p.id === plan.id ? "Gói hiện tại" : "Chọn gói này"}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setUpgrading(false)} className="text-sm text-slate-500 hover:text-slate-300">
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
