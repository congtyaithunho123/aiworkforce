import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store, Bot, GitMerge, Star, Download, Zap, Shield, Crown,
  Search, Filter, X, Plus, ArrowRight, CheckCircle, Clock,
  TrendingUp, Users, BarChart3, ChevronRight, Award,
  Eye, Tag, Activity, DollarSign, Package
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketItem {
  id: number;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  status: string;
  isFeatured: boolean;
  isVerified: boolean;
  iconEmoji: string;
  priceType: string;
  priceCents: number;
  installCount: number;
  activeInstalls: number;
  executionCount: number;
  successRate: string;
  avgTokenCost: number;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
  // agent only
  model?: string;
  tools?: string[];
  // workflow only
  steps?: { name: string; agentRole: string; description?: string }[];
  estimatedMinutes?: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
}

interface AnalyticsData {
  agents: { totalInstalls: number; totalExecutions: number; totalPublished: number };
  workflows: { totalInstalls: number; totalExecutions: number; totalPublished: number };
  reviews: { count: number; avgRating: number };
  topAgents: MarketItem[];
  topWorkflows: MarketItem[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: "all", label: "Tất cả" },
  { key: "sales", label: "Sales" },
  { key: "marketing", label: "Marketing" },
  { key: "support", label: "Support" },
  { key: "hr", label: "HR" },
  { key: "research", label: "Research" },
  { key: "analytics", label: "Analytics" },
];

const SORT_OPTIONS = [
  { key: "popular", label: "Phổ biến nhất" },
  { key: "rating", label: "Đánh giá cao" },
  { key: "newest", label: "Mới nhất" },
  { key: "name", label: "Tên A-Z" },
];

const CATEGORY_COLORS: Record<string, string> = {
  sales: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  marketing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  hr: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  support: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  research: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  analytics: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  general: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "bg-slate-500/20 text-slate-400" },
  published: { label: "Published", cls: "bg-blue-500/20 text-blue-400" },
  verified:  { label: "Verified",  cls: "bg-emerald-500/20 text-emerald-400" },
  featured:  { label: "Featured",  cls: "bg-amber-500/20 text-amber-400" },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.04 } }),
};

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ value, max = 5, size = "sm", interactive = false, onChange }: {
  value: number; max?: number; size?: "sm" | "md"; interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === "sm" ? "w-3 h-3" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const filled = n <= (interactive ? (hovered || value) : value);
        return (
          <Star
            key={n}
            className={`${sz} transition-colors ${filled ? "text-amber-400 fill-amber-400" : "text-slate-700"} ${interactive ? "cursor-pointer hover:scale-110" : ""}`}
            onMouseEnter={() => interactive && setHovered(n)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(n)}
          />
        );
      })}
    </div>
  );
}

// ── Item Detail Modal ─────────────────────────────────────────────────────────

function ItemDetailModal({
  item, type, onClose
}: { item: MarketItem; type: "agent" | "workflow"; onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [installName, setInstallName] = useState(item.displayName);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: detail } = useQuery<MarketItem & { reviews: Review[] }>({
    queryKey: ["marketplace-detail", type, item.id],
    queryFn: () => apiFetch(`/api/marketplace/${type === "agent" ? "agents" : "workflows"}/${item.id}`),
  });

  const installMutation = useMutation({
    mutationFn: () => apiFetch(`/api/marketplace/${type === "agent" ? "agents" : "workflows"}/${item.id}/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: installName }),
    }),
    onSuccess: (data: { message: string }) => {
      toast({ title: "✅ " + (data.message || "Đã cài đặt thành công!"), description: type === "agent" ? "Vào Dashboard → Agents để xem." : "Vào Workflows để chạy ngay." });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["workflows"] });
      onClose();
      if (type === "workflow") navigate("/workflows");
    },
    onError: (e: Error) => toast({ title: "Lỗi cài đặt", description: e.message, variant: "destructive" }),
  });

  const reviewMutation = useMutation({
    mutationFn: () => apiFetch("/api/marketplace/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: type, targetId: item.id, rating, comment }),
    }),
    onSuccess: () => {
      toast({ title: "✅ Đánh giá đã được gửi!" });
      qc.invalidateQueries({ queryKey: ["marketplace-detail", type, item.id] });
      setRating(0); setComment("");
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const catCls = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general;
  const reviews = detail?.reviews ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 border-b border-white/10 px-6 py-4 flex items-start justify-between gap-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{item.iconEmoji}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">{item.displayName}</h2>
                {item.isVerified && <Shield className="w-4 h-4 text-emerald-400" title="Verified" />}
                {item.isFeatured && <Crown className="w-4 h-4 text-amber-400" title="Featured" />}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${catCls}`}>{item.category}</span>
                <span className="text-xs text-slate-500">v{item.version}</span>
                <div className="flex items-center gap-1">
                  <StarRating value={item.avgRating} />
                  <span className="text-xs text-slate-500">{item.avgRating} ({item.reviewCount})</span>
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 flex-shrink-0 p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Cài đặt", value: item.installCount.toLocaleString(), icon: Download },
              { label: "Đang dùng", value: item.activeInstalls.toLocaleString(), icon: Users },
              { label: "Lần chạy", value: item.executionCount.toLocaleString(), icon: Activity },
              { label: "Thành công", value: `${Number(item.successRate).toFixed(0)}%`, icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-3 text-center">
                <Icon className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div>
            <p className="text-slate-300 text-sm leading-relaxed">{detail?.longDescription || item.description}</p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {(item.tags || []).map((tag) => (
              <span key={tag} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />#{tag}
              </span>
            ))}
          </div>

          {/* Workflow steps or Agent tools */}
          {type === "workflow" && item.steps && item.steps.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><GitMerge className="w-4 h-4 text-blue-400" /> Các bước thực hiện</h4>
              <div className="space-y-2">
                {item.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white/3 border border-white/10 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                    <div>
                      <p className="text-sm text-white font-medium">{step.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{step.description || step.agentRole}</p>
                    </div>
                  </div>
                ))}
              </div>
              {item.estimatedMinutes && (
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Ước tính ~{item.estimatedMinutes} phút</p>
              )}
            </div>
          )}

          {type === "agent" && item.model && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">Model: <span className="text-white font-medium">{item.model}</span></span>
              <span className="text-slate-400">Avg cost: <span className="text-white font-medium">{item.avgTokenCost} tokens/run</span></span>
            </div>
          )}

          {/* Install section */}
          <div className="bg-gradient-to-r from-amber-500/5 to-emerald-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-white">⚡ Cài đặt 1 click</h4>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tên {type === "agent" ? "Agent" : "Workflow"}</label>
              <input
                value={installName}
                onChange={(e) => setInstallName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                placeholder={`Tên ${type === "agent" ? "agent" : "workflow"}...`}
              />
            </div>
            <button
              onClick={() => installMutation.mutate()}
              disabled={!installName || installMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-xl disabled:opacity-40 transition-colors"
            >
              {installMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Đang cài đặt...</>
              ) : (
                <><Download className="w-4 h-4" /> Cài đặt & Chạy ngay</>
              )}
            </button>
            <p className="text-xs text-slate-500 text-center">
              {type === "agent" ? "Agent sẽ xuất hiện trong Dashboard → Agents" : "Workflow sẽ sẵn sàng chạy ngay lập tức"}
            </p>
          </div>

          {/* Reviews */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Đánh giá ({reviews.length})</h4>
            
            {/* Write review */}
            <div className="bg-white/3 border border-white/10 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-xs text-slate-400 font-medium">Viết đánh giá</p>
              <div className="flex items-center gap-2">
                <StarRating value={rating} interactive onChange={setRating} size="md" />
                <span className="text-xs text-slate-500">{rating > 0 ? ["", "Tệ", "Không tốt", "Tạm được", "Tốt", "Xuất sắc"][rating] : "Chọn sao"}</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm của bạn..."
                rows={2}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <button
                onClick={() => reviewMutation.mutate()}
                disabled={rating === 0 || reviewMutation.isPending}
                className="px-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs rounded-lg disabled:opacity-40 transition-colors"
              >
                {reviewMutation.isPending ? "Đang gửi..." : "Gửi đánh giá"}
              </button>
            </div>

            {/* Review list */}
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-4">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="border border-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StarRating value={r.rating} />
                        <span className="text-xs text-white font-medium">{r.authorName || r.authorEmail?.split("@")[0] || "Ẩn danh"}</span>
                      </div>
                      <span className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                    {r.comment && <p className="text-xs text-slate-400 leading-relaxed">{r.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Market Card ───────────────────────────────────────────────────────────────

function MarketCard({ item, type, i }: { item: MarketItem; type: "agent" | "workflow"; i: number }) {
  const [showDetail, setShowDetail] = useState(false);
  const catCls = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general;

  return (
    <>
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={i}
        className="bg-white/3 border border-white/10 hover:border-white/20 rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-white/5 group cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl">{item.iconEmoji}</div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-white text-sm leading-tight">{item.displayName}</h3>
                {item.isVerified && <Shield className="w-3 h-3 text-emerald-400 flex-shrink-0" title="Verified" />}
                {item.isFeatured && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" title="Featured" />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catCls}`}>{item.category}</span>
                <span className="text-[10px] text-slate-600">v{item.version}</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-600 flex-shrink-0 bg-white/5 px-2 py-1 rounded-lg">
            {item.priceType === "free" ? "Free" : `$${(item.priceCents / 100).toFixed(0)}/mo`}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed flex-1 line-clamp-2">{item.description}</p>

        {/* Workflow steps preview */}
        {type === "workflow" && item.steps && item.steps.length > 0 && (
          <div className="flex items-center gap-1 overflow-hidden">
            {item.steps.slice(0, 4).map((s, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-[10px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded truncate max-w-[80px]">{s.name}</span>
                {idx < Math.min(item.steps!.length, 4) - 1 && <ChevronRight className="w-2.5 h-2.5 text-slate-700 flex-shrink-0" />}
              </div>
            ))}
            {item.steps.length > 4 && <span className="text-[10px] text-slate-600">+{item.steps.length - 4}</span>}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {(item.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded">#{tag}</span>
          ))}
        </div>

        {/* Stats + CTA */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{item.installCount.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <StarRating value={Math.round(item.avgRating)} />
              <span>{item.avgRating > 0 ? item.avgRating : "–"}</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors ${
              type === "agent"
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
          >
            <Download className="w-3 h-3" /> Install
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDetail && <ItemDetailModal item={item} type={type} onClose={() => setShowDetail(false)} />}
      </AnimatePresence>
    </>
  );
}

// ── Creator Profile Panel ─────────────────────────────────────────────────────

function CreatorProfilePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-creator-profile"],
    queryFn: () => apiFetch("/api/marketplace/creator-profile"),
  });

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse py-8 text-center">Đang tải...</div>;
  if (!data) return null;

  const { user, org, stats, agents, workflows } = data as {
    user: { name: string; email: string };
    org: { name: string };
    stats: { totalInstalls: number; totalExecutions: number; publishedAgents: number; publishedWorkflows: number; totalEarnings: string };
    agents: MarketItem[];
    workflows: MarketItem[];
  };

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-bold text-black">
            {(user?.name || user?.email || "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold text-lg">{user?.name || user?.email}</p>
            <p className="text-slate-400 text-sm">{org?.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400">Creator</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Tổng cài đặt", value: stats?.totalInstalls?.toLocaleString() ?? "0", icon: Download },
            { label: "Tổng lần chạy", value: stats?.totalExecutions?.toLocaleString() ?? "0", icon: Activity },
            { label: "Agents", value: stats?.publishedAgents ?? 0, icon: Bot },
            { label: "Workflows", value: stats?.publishedWorkflows ?? 0, icon: GitMerge },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-3 text-center">
              <Icon className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue */}
      <div className="bg-gradient-to-r from-emerald-500/5 to-amber-500/5 border border-emerald-500/20 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" /> Revenue Share</span>
          <span className="text-2xl font-bold text-emerald-400">${stats?.totalEarnings ?? "0.00"}</span>
        </div>
        <p className="text-xs text-slate-500">70% doanh thu từ các lượt tải xuống trả phí. Thanh toán hàng tháng.</p>
      </div>

      {/* My published agents */}
      {agents?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Bot className="w-4 h-4 text-amber-400" /> My Agents ({agents.length})</h3>
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 bg-white/3 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{a.iconEmoji}</span>
                  <div>
                    <p className="text-sm text-white">{a.displayName}</p>
                    <p className="text-xs text-slate-500">{a.installCount} installs</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status]?.cls ?? "bg-slate-500/20 text-slate-400"}`}>
                  {STATUS_BADGE[a.status]?.label ?? a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My published workflows */}
      {workflows?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><GitMerge className="w-4 h-4 text-blue-400" /> My Workflows ({workflows.length})</h3>
          <div className="space-y-2">
            {workflows.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-white/3 border border-white/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{w.iconEmoji}</span>
                  <div>
                    <p className="text-sm text-white">{w.displayName}</p>
                    <p className="text-xs text-slate-500">{w.installCount} installs</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[w.status]?.cls ?? "bg-slate-500/20 text-slate-400"}`}>
                  {STATUS_BADGE[w.status]?.label ?? w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────

function AnalyticsPanel() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["marketplace-analytics"],
    queryFn: () => apiFetch("/api/marketplace/analytics"),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse py-8 text-center">Đang tải analytics...</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Agent Installs", value: Number(data.agents?.totalInstalls ?? 0).toLocaleString(), icon: Bot, color: "text-amber-400" },
          { label: "Workflow Installs", value: Number(data.workflows?.totalInstalls ?? 0).toLocaleString(), icon: GitMerge, color: "text-blue-400" },
          { label: "Avg Rating", value: `${data.reviews?.avgRating ?? 0} ⭐`, icon: Star, color: "text-amber-400" },
          { label: "Reviews", value: data.reviews?.count ?? 0, icon: Award, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-4">
            <Icon className={`w-4 h-4 ${color} mb-2`} />
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">🔥 Top Agents</h3>
        <div className="space-y-2">
          {data.topAgents.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 p-2">
              <span className="text-slate-600 text-xs w-4">{i + 1}</span>
              <span className="text-base">{a.iconEmoji}</span>
              <span className="text-sm text-white flex-1 truncate">{a.displayName}</span>
              <span className="text-xs text-slate-500">{a.installCount} installs</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">⚡ Top Workflows</h3>
        <div className="space-y-2">
          {data.topWorkflows.map((w, i) => (
            <div key={w.id} className="flex items-center gap-3 p-2">
              <span className="text-slate-600 text-xs w-4">{i + 1}</span>
              <span className="text-base">{w.iconEmoji}</span>
              <span className="text-sm text-white flex-1 truncate">{w.displayName}</span>
              <span className="text-xs text-slate-500">{w.installCount} installs</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Marketplace Page ─────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [tab, setTab] = useState<"agents" | "workflows" | "analytics" | "profile">("agents");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [showFilters, setShowFilters] = useState(false);

  const { data: agents = [], isLoading: loadingAgents } = useQuery<MarketItem[]>({
    queryKey: ["marketplace-agents", category, search, sort],
    queryFn: () => apiFetch(`/api/marketplace/agents?category=${category}&search=${encodeURIComponent(search)}&sort=${sort}`),
    enabled: tab === "agents",
  });

  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery<MarketItem[]>({
    queryKey: ["marketplace-workflows", category, search, sort],
    queryFn: () => apiFetch(`/api/marketplace/workflows?category=${category}&search=${encodeURIComponent(search)}&sort=${sort}`),
    enabled: tab === "workflows",
  });

  const items = tab === "agents" ? agents : tab === "workflows" ? workflows : [];
  const isLoading = tab === "agents" ? loadingAgents : tab === "workflows" ? loadingWorkflows : false;

  // Featured items for hero
  const featuredAgents = agents.filter((a) => a.isFeatured).slice(0, 3);
  const featuredWorkflows = workflows.filter((w) => w.isFeatured).slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Store className="w-6 h-6 text-amber-400" /> Agent Marketplace
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Hệ sinh thái agents & workflows chia sẻ giữa cộng đồng AI Workforce</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("profile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${tab === "profile" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:text-white border border-white/10 hover:border-white/20"}`}
            >
              <Award className="w-3.5 h-3.5" /> Creator Profile
            </button>
            <button
              onClick={() => setTab("analytics")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${tab === "analytics" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "text-slate-400 hover:text-white border border-white/10 hover:border-white/20"}`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </button>
          </div>
        </div>

        {/* Main tabs */}
        <div className="flex gap-2">
          {([
            { key: "agents", label: "Agent Store", icon: Bot },
            { key: "workflows", label: "Workflow Store", icon: GitMerge },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-white/10"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Analytics or Profile panel */}
        {(tab === "analytics" || tab === "profile") && (
          <div className="max-w-2xl">
            {tab === "analytics" ? <AnalyticsPanel /> : <CreatorProfilePanel />}
          </div>
        )}

        {/* Store panels */}
        {(tab === "agents" || tab === "workflows") && (
          <>
            {/* Featured banner */}
            {(tab === "agents" ? featuredAgents : featuredWorkflows).length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-amber-400">Featured</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(tab === "agents" ? featuredAgents : featuredWorkflows).map((item, i) => (
                    <MarketCard key={item.id} item={item} type={tab === "agents" ? "agent" : "workflow"} i={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Tìm kiếm ${tab === "agents" ? "agent" : "workflow"}...`}
                  className="w-full bg-white/3 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="bg-white/3 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${showFilters ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "text-slate-400 border-white/10 hover:border-white/20 hover:text-white"}`}
                >
                  <Filter className="w-3.5 h-3.5" /> Filter
                </button>
              </div>
            </div>

            {/* Category filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pb-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setCategory(c.key)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          category === c.key
                            ? "bg-white/15 text-white border border-white/30"
                            : "text-slate-500 hover:text-slate-300 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Results count */}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {isLoading ? "Đang tải..." : `${items.length} ${tab === "agents" ? "agents" : "workflows"} tìm thấy`}
                {category !== "all" && ` trong "${CATEGORIES.find(c => c.key === category)?.label}"`}
                {search && ` cho "${search}"`}
              </span>
              {(category !== "all" || search) && (
                <button onClick={() => { setCategory("all"); setSearch(""); }} className="text-amber-400 hover:text-amber-300">
                  Xoá bộ lọc
                </button>
              )}
            </div>

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="bg-white/3 border border-white/10 rounded-2xl h-52 animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20">
                {tab === "agents" ? <Bot className="w-12 h-12 mx-auto mb-3 text-slate-700" /> : <GitMerge className="w-12 h-12 mx-auto mb-3 text-slate-700" />}
                <p className="text-slate-500 text-sm">Không tìm thấy kết quả</p>
                <p className="text-slate-600 text-xs mt-1">Thử tìm kiếm với từ khóa khác</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, i) => (
                  <MarketCard key={item.id} item={item} type={tab === "agents" ? "agent" : "workflow"} i={i} />
                ))}
              </div>
            )}

            {/* One-click flow reminder */}
            <div className="flex items-center justify-center gap-3 py-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Browse</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1"><Download className="w-3 h-3" /> Install</span>
              <ArrowRight className="w-3 h-3" />
              <span className="flex items-center gap-1 text-emerald-600"><Zap className="w-3 h-3" /> Run</span>
              <span className="text-slate-700 ml-2">— Dưới 60 giây</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
