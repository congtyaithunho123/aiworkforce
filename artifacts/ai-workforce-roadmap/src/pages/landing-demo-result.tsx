import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Loader2, CheckCircle, User, Mail, Building2,
  Globe, Target, Zap, AlertCircle, Lock, Unlock, X
} from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

/* ── types ───────────────────────────────────────────────────── */
interface Lead {
  name: string;
  title: string;
  company: string;
  email: string;
  reason: string;
}

interface DemoResult {
  company: {
    name: string;
    industry: string;
    product: string;
    targetMarket: string;
    painPoints: string[];
    companySize?: string;
  };
  icp: {
    title: string;
    companySize: string;
    industry: string;
    painPoints: string[];
    decisionMaker: string;
    budget?: string;
  };
  leads: Lead[];
  email: {
    subject: string;
    body: string;
  };
}

/* ── skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/8 ${className}`} />;
}

function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center gap-2 mb-5">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-40 h-5" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-24 h-3" />
          <Skeleton className={`h-4 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
        </div>
      ))}
    </div>
  );
}

/* ── loading steps ───────────────────────────────────────────── */
const STEPS = [
  "Đang đọc metadata từ website...",
  "Xây dựng Ideal Customer Profile...",
  "Tạo danh sách leads phù hợp ICP...",
  "Viết email outreach cá nhân hóa...",
];

function LoadingView({ website, step }: { website: string; step: number }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-md px-6 w-full">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">AI đang phân tích</h2>
        <p className="text-slate-400 mb-8 text-sm flex items-center justify-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> {website}
        </p>
        <div className="space-y-3 text-left">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                i < step ? "text-emerald-400" : i === step ? "text-white" : "text-slate-600"
              }`}
            >
              {i < step ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : i === step ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
              )}
              {s}
            </div>
          ))}
        </div>
        <div className="mt-10 space-y-3 opacity-40 pointer-events-none">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
      </div>
    </div>
  );
}

/* ── single lead gate modal ──────────────────────────────────── */
function LeadGateModal({
  website,
  onUnlocked,
  onClose,
}: {
  website: string;
  onUnlocked: () => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Vui lòng nhập email hợp lệ");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/marketing-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "demo_gate", websiteAnalyzed: website }),
      });
      if (!res.ok) throw new Error("save failed");
      onUnlocked();
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-zinc-950 border border-amber-500/30 rounded-2xl p-8 max-w-sm w-full shadow-2xl shadow-amber-500/10 text-center"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          aria-label="Đóng"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Mở khoá toàn bộ kết quả</h3>
        <p className="text-slate-400 text-sm mb-6">
          Nhập email để xem đầy đủ 5 leads + email outreach cá nhân hóa. Miễn phí.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              placeholder="email@company.com"
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-xs text-left">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-black font-bold rounded-xl transition-all text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
            {loading ? "Đang mở khoá..." : "Mở khoá kết quả đầy đủ"}
          </button>
        </form>
        <p className="text-slate-600 text-xs mt-4">Không spam. Huỷ bất kỳ lúc nào.</p>
      </motion.div>
    </div>
  );
}

/* ── lead row ────────────────────────────────────────────────── */
function LeadRow({ lead, index, blurred }: { lead: Lead; index: number; blurred: boolean }) {
  return (
    <div
      className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-300"
      style={blurred ? { filter: "blur(6px)", userSelect: "none" } : {}}
      aria-hidden={blurred}
    >
      <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <p className="text-white font-medium">{lead.name}</p>
          <p className="text-slate-400 text-sm">{lead.title}</p>
        </div>
        <div>
          <p className="text-slate-300 text-sm flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {lead.company}
          </p>
          <p className="text-slate-400 text-sm flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {lead.email}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Lý do phù hợp:</p>
          <p className="text-slate-300 text-sm">{lead.reason}</p>
        </div>
      </div>
    </div>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function DemoResultPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const website = params.get("website") ?? "";

  const [loadStep, setLoadStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [apiError, setApiError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const lockedSectionRef = useRef<HTMLDivElement>(null);

  /* advance loading steps for visual feedback */
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setLoadStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(id);
  }, [loading]);

  /* call real API */
  useEffect(() => {
    if (!website) { setLoading(false); return; }
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/public/demo/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ website }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "API error");
        setResult(json.data as DemoResult);
        setLoadStep(STEPS.length);
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") return;
        setApiError(err instanceof Error ? err.message : "Phân tích thất bại");
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [website]);

  /* scroll-based gate: show modal when user scrolls to the blurred section */
  useEffect(() => {
    if (!result || unlocked) return;
    const el = lockedSectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowGate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [result, unlocked]);

  function handleUnlocked() {
    setUnlocked(true);
    setShowGate(false);
  }

  /* ── no website param ── */
  if (!website && !loading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Thiếu website</h2>
            <p className="text-slate-400 mb-6">Vui lòng quay lại và nhập website cần phân tích.</p>
            <Link href="/demo" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all inline-block">
              Quay lại Demo
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  /* ── loading ── */
  if (loading) {
    return (
      <PublicLayout>
        <LoadingView website={website} step={loadStep} />
      </PublicLayout>
    );
  }

  /* ── api error ── */
  if (apiError || !result) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Phân tích thất bại</h2>
            <p className="text-slate-400 mb-2">{apiError || "Không thể phân tích website này."}</p>
            <p className="text-slate-600 text-sm mb-6">Vui lòng thử lại hoặc dùng một website khác.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/demo" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all inline-block">
                Thử website khác
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-white/20 text-white hover:bg-white/5 rounded-xl transition-all"
              >
                Thử lại
              </button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const VISIBLE_LEADS = 2;
  const visibleLeads = result.leads.slice(0, VISIBLE_LEADS);
  const lockedLeads  = result.leads.slice(VISIBLE_LEADS);

  return (
    <PublicLayout>
      {/* single lead gate modal — only one instance */}
      {showGate && !unlocked && (
        <LeadGateModal
          website={website}
          onUnlocked={handleUnlocked}
          onClose={() => setShowGate(false)}
        />
      )}

      {/* header */}
      <section className="py-10 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                <CheckCircle className="w-4 h-4" />
                Phân tích hoàn tất
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2 flex-wrap">
                <Globe className="w-6 h-6 text-amber-400 shrink-0" />
                {website}
              </h1>
            </div>
            <Link
              href="/register"
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all text-sm whitespace-nowrap shrink-0 hover:-translate-y-0.5"
            >
              Bắt đầu miễn phí <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Company analysis */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Phân tích công ty</h2>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { label: "Tên công ty",           value: result.company.name },
              { label: "Ngành",                 value: result.company.industry },
              { label: "Quy mô",                value: result.company.companySize ?? "Chưa xác định" },
              { label: "Thị trường mục tiêu",   value: result.company.targetMarket },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-white font-medium">{value}</p>
              </div>
            ))}
            <div className="col-span-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sản phẩm / Dịch vụ</p>
              <p className="text-slate-300">{result.company.product}</p>
            </div>
            <div className="col-span-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Pain Points</p>
              <div className="flex flex-wrap gap-2">
                {result.company.painPoints.map(p => (
                  <span key={p} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ICP */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Ideal Customer Profile (ICP)</h2>
          </div>
          <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { label: "Chức danh mục tiêu",        value: result.icp.title },
              { label: "Quy mô công ty target",      value: result.icp.companySize },
              { label: "Ngành target",               value: result.icp.industry },
              { label: "Decision maker",             value: result.icp.decisionMaker },
              ...(result.icp.budget ? [{ label: "Budget ước tính", value: result.icp.budget }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-white font-medium">{value}</p>
              </div>
            ))}
            <div className="col-span-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Buyer Pain Points</p>
              <div className="flex flex-wrap gap-2">
                {result.icp.painPoints.map(p => (
                  <span key={p} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Leads */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">
                {unlocked ? "5 Leads phù hợp ICP" : `${VISIBLE_LEADS} Leads mẫu (${lockedLeads.length} đang khoá)`}
              </h2>
            </div>
            {unlocked ? (
              <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium">
                <Unlock className="w-4 h-4" /> Đã mở khoá
              </span>
            ) : (
              <button
                onClick={() => setShowGate(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/15 transition-colors"
              >
                <Unlock className="w-4 h-4" /> Mở khoá tất cả
              </button>
            )}
          </div>

          <div className="space-y-3">
            {visibleLeads.map((lead, i) => (
              <motion.div key={lead.email + i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.1 }}>
                <LeadRow lead={lead} index={i} blurred={false} />
              </motion.div>
            ))}

            {/* locked leads — blurred, click-to-unlock button overlay */}
            {lockedLeads.length > 0 && (
              <div className="relative" ref={lockedSectionRef}>
                <div className="space-y-3">
                  {lockedLeads.map((lead, i) => (
                    <LeadRow key={lead.email + i} lead={lead} index={i + VISIBLE_LEADS} blurred={!unlocked} />
                  ))}
                </div>
                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={() => setShowGate(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg transition-all"
                    >
                      <Lock className="w-4 h-4" />
                      Nhập email để xem {lockedLeads.length} leads còn lại
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* Email preview */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Email Outreach mẫu</h2>
            {!unlocked && (
              <span className="ml-2 flex items-center gap-1 text-xs text-slate-500 border border-white/10 rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" /> Cần mở khoá
              </span>
            )}
          </div>
          <div className={`rounded-2xl bg-white/5 border border-white/10 overflow-hidden ${!unlocked ? "relative" : ""}`}>
            <div className={`transition-all duration-500 ${!unlocked ? "blur-sm select-none pointer-events-none" : ""}`}>
              <div className="px-6 py-4 border-b border-white/10 bg-white/3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Subject</p>
                <p className="text-white font-medium">{result.email.subject}</p>
              </div>
              <div className="px-6 py-5">
                <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{result.email.body}</pre>
              </div>
            </div>
            {!unlocked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => setShowGate(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl shadow-lg transition-all"
                >
                  <Lock className="w-4 h-4" />
                  Nhập email để xem email mẫu
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center py-10 border-t border-white/10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-5">
            <Zap className="w-3.5 h-3.5" />
            Đây chỉ là preview — phiên bản thật chạy với data thực của bạn
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Bắt đầu với leads thật ngay hôm nay</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Đăng ký miễn phí để AI SDR chạy 24/7 với prospects thật — không cần thẻ tín dụng.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-amber-500/20"
            >
              Bắt đầu miễn phí <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white hover:bg-white/5 rounded-xl transition-all"
            >
              Thử website khác
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm text-slate-500">
            {["✓ Miễn phí 7 ngày", "✓ Không cần thẻ tín dụng", "✓ Setup trong 5 phút"].map(t => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </motion.section>
      </div>
    </PublicLayout>
  );
}
