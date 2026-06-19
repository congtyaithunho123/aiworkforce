import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Link } from "wouter";
import { Clock, AlertTriangle, Zap } from "lucide-react";

interface TrialStatus {
  trialEndsAt: string | null;
  daysRemaining: number;
  isTrialing: boolean;
  isExpired: boolean;
  freeTasksRemaining: number;
  showWarning: boolean;
}

export function TrialBanner() {
  const { data } = useQuery<TrialStatus>({
    queryKey: ["trial-status"],
    queryFn: () => apiFetch("/api/trial/status"),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (!data) return null;

  // Show banner when: warning (≤3 days), expired, or tasks exhausted
  const showBanner = data.showWarning || data.isExpired || data.freeTasksRemaining === 0;
  if (!showBanner) return null;

  if (data.isExpired) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-red-500/10 border-t border-red-500/30 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-red-300">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>
            <span className="font-semibold text-red-400">Trial đã hết hạn.</span>{" "}
            Nâng cấp ngay để tiếp tục sử dụng đầy đủ tính năng.
          </span>
        </div>
        <Link
          href="/billing"
          className="flex-shrink-0 px-4 py-1.5 bg-red-500 hover:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Nâng cấp ngay
        </Link>
      </div>
    );
  }

  if (data.freeTasksRemaining === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500/10 border-t border-amber-500/30 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-amber-300">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <span className="font-semibold text-amber-400">Đã dùng hết 100 task miễn phí.</span>{" "}
            Nâng cấp để tiếp tục chạy AI agents.
          </span>
        </div>
        <Link
          href="/billing"
          className="flex-shrink-0 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
        >
          Nâng cấp
        </Link>
      </div>
    );
  }

  // showWarning: 1–3 days left
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500/8 border-t border-amber-500/20 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-amber-200/80">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span>
          Trial còn{" "}
          <span className="font-semibold text-amber-400">{data.daysRemaining} ngày</span>
          {" "}· {data.freeTasksRemaining} task miễn phí còn lại.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/settings" className="text-xs text-slate-400 hover:text-slate-200">
          Referral +7 ngày
        </Link>
        <Link
          href="/billing"
          className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium border border-amber-500/30 rounded-lg transition-colors"
        >
          Nâng cấp
        </Link>
      </div>
    </div>
  );
}
