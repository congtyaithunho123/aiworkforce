import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/api";
import { Activity, Zap, CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";

type LiveEvent =
  | { type: "connected"; organizationId: number }
  | { type: "task_started"; taskId: number; agentName: string; input: string }
  | { type: "task_progress"; taskId: number; message: string; percent: number }
  | { type: "task_completed"; taskId: number; durationMs: number; tokens: number; cost: number }
  | { type: "task_failed"; taskId: number; error: string }
  | { type: "workflow_started"; workflowId: number; name: string; stepCount: number }
  | { type: "workflow_step"; workflowId: number; step: number; stepName: string; percent: number }
  | { type: "workflow_completed"; workflowId: number; durationMs: number }
  | { type: "workflow_failed"; workflowId: number; error: string }
  | { type: "budget_warning"; percentUsed: number; spent: number; budget: number }
  | { type: "budget_exceeded"; spent: number; budget: number };

interface ActivityItem {
  id: string;
  event: LiveEvent;
  timestamp: Date;
}

const MAX_ITEMS = 30;

function EventBadge({ type }: { type: string }) {
  if (type.includes("completed")) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (type.includes("failed") || type.includes("exceeded")) return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  if (type.includes("started")) return <Zap className="w-3.5 h-3.5 text-amber-400" />;
  if (type.includes("progress") || type.includes("step")) return <Clock className="w-3.5 h-3.5 text-blue-400" />;
  if (type.includes("warning")) return <TrendingUp className="w-3.5 h-3.5 text-orange-400" />;
  return <Activity className="w-3.5 h-3.5 text-slate-400" />;
}

function formatEvent(ev: LiveEvent): { title: string; detail?: string; progress?: number } {
  switch (ev.type) {
    case "task_started":
      return { title: `🤖 ${ev.agentName} bắt đầu`, detail: ev.input.slice(0, 60) + (ev.input.length > 60 ? "…" : "") };
    case "task_progress":
      return { title: `⏳ Task #${ev.taskId} — ${ev.message}`, progress: ev.percent };
    case "task_completed":
      return { title: `✅ Task #${ev.taskId} hoàn thành`, detail: `${(ev.durationMs / 1000).toFixed(1)}s · ${ev.tokens} tokens · $${ev.cost.toFixed(4)}` };
    case "task_failed":
      return { title: `❌ Task #${ev.taskId} thất bại`, detail: ev.error.slice(0, 80) };
    case "workflow_started":
      return { title: `🔄 Workflow "${ev.name}" bắt đầu`, detail: `${ev.stepCount} bước` };
    case "workflow_step":
      return { title: `↪ Bước ${ev.step}: ${ev.stepName}`, progress: ev.percent };
    case "workflow_completed":
      return { title: `✅ Workflow hoàn thành`, detail: `${(ev.durationMs / 1000).toFixed(1)}s` };
    case "workflow_failed":
      return { title: `❌ Workflow thất bại`, detail: ev.error.slice(0, 80) };
    case "budget_warning":
      return { title: `⚠️ Ngân sách ${ev.percentUsed}% đã dùng`, detail: `$${ev.spent.toFixed(2)} / $${ev.budget.toFixed(2)}` };
    case "budget_exceeded":
      return { title: `🚨 Vượt ngân sách!`, detail: `$${ev.spent.toFixed(2)} / $${ev.budget.toFixed(2)}` };
    default:
      return { title: "System event" };
  }
}

export function LiveActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let retryTimeout: ReturnType<typeof setTimeout>;

    const connect = async () => {
      // Get auth token for SSE (EventSource doesn't support headers natively)
      // We use a token query param approach via a short-lived fetch
      const baseUrl = import.meta.env.VITE_API_URL || "";
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const url = `${baseUrl}/api/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as LiveEvent;
          if (event.type === "connected") return;

          setItems((prev) => {
            const newItem: ActivityItem = {
              id: `${Date.now()}-${Math.random()}`,
              event,
              timestamp: new Date(),
            };
            return [newItem, ...prev].slice(0, MAX_ITEMS);
          });
        } catch { /* ignore malformed events */ }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      esRef.current?.close();
    };
  }, []);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [items.length]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-slate-200">Live Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-500">{connected ? "Live" : "Đang kết nối..."}</span>
        </div>
      </div>

      <div ref={listRef} className="h-64 overflow-y-auto space-y-0 divide-y divide-white/5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            <Activity className="w-6 h-6" />
            <p className="text-xs">Chờ hoạt động từ agents...</p>
          </div>
        ) : (
          items.map((item) => {
            const { title, detail, progress } = formatEvent(item.event);
            return (
              <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/5 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <EventBadge type={item.event.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">{title}</p>
                  {detail && <p className="text-xs text-slate-500 mt-0.5 truncate">{detail}</p>}
                  {progress !== undefined && (
                    <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {item.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
