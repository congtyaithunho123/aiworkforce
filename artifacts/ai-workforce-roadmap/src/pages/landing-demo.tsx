import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Globe, ArrowRight, Zap, CheckCircle, Loader2 } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const EXAMPLES = [
  "hubspot.com",
  "salesforce.com",
  "notion.so",
  "figma.com",
  "stripe.com",
];

const WHAT_YOU_GET = [
  { icon: "🏢", title: "Phân tích công ty", desc: "Ngành nghề, sản phẩm, thị trường mục tiêu, điểm mạnh/yếu" },
  { icon: "🎯", title: "Ideal Customer Profile", desc: "Chân dung khách hàng lý tưởng được AI tạo dựa trên dữ liệu thực tế" },
  { icon: "👥", title: "5 Lead mẫu", desc: "Danh sách prospects phù hợp ICP với thông tin đầy đủ" },
  { icon: "📧", title: "Email outreach mẫu", desc: "Một email cá nhân hóa hoàn chỉnh, sẵn sàng gửi" },
];

export default function LandingDemoPage() {
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, navigate] = useLocation();

  function normalizeUrl(raw: string): string {
    let url = raw.trim();
    if (!url) return "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    try {
      const parsed = new URL(url);
      return parsed.hostname || url;
    } catch {
      return url;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeUrl(website);
    if (!normalized) {
      setError("Vui lòng nhập website công ty");
      return;
    }
    setError("");
    setLoading(true);
    // Small artificial delay for UX
    await new Promise(r => setTimeout(r, 600));
    navigate(`/demo/result?website=${encodeURIComponent(normalized)}`);
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-24 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Demo miễn phí — không cần đăng nhập
            </span>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-5xl md:text-6xl font-bold text-white mb-5"
          >
            Xem AI SDR phân tích{" "}
            <span className="text-amber-400">công ty của bạn</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto"
          >
            Nhập website bất kỳ. AI sẽ phân tích, tạo ICP, tìm 5 leads mẫu và viết email outreach — trong vòng 30 giây.
          </motion.p>

          {/* Form */}
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="max-w-xl mx-auto"
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  value={website}
                  onChange={e => { setWebsite(e.target.value); setError(""); }}
                  placeholder="Nhập website công ty (vd: hubspot.com)"
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:bg-white/8 text-lg transition-colors"
                />
              </div>

              {error && <p className="text-red-400 text-sm text-left">{error}</p>}

              <button
                type="submit"
                disabled={loading || !website.trim()}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-black font-bold rounded-xl text-lg transition-all hover:-translate-y-0.5 disabled:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang chuẩn bị phân tích...
                  </>
                ) : (
                  <>
                    Phân tích ngay <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Example links */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="text-slate-500 text-sm">Thử với:</span>
              {EXAMPLES.map(ex => (
                <button
                  key={ex}
                  onClick={() => setWebsite(ex)}
                  className="text-sm text-amber-400/70 hover:text-amber-400 transition-colors underline underline-offset-2"
                >
                  {ex}
                </button>
              ))}
            </div>

            <p className="mt-4 text-slate-600 text-xs">
              Miễn phí · Không cần đăng nhập · Kết quả trong ~30 giây
            </p>
          </motion.div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Bạn sẽ nhận được gì?</h2>
            <p className="text-slate-400">Kết quả phân tích đầy đủ, không cần đăng ký</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHAT_YOU_GET.map(({ icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.3}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center"
              >
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-semibold text-white mb-2 text-sm">{title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Quy trình phân tích</h2>
          </motion.div>

          <div className="space-y-6">
            {[
              { step: 1, title: "AI đọc website", desc: "Phân tích tên công ty, ngành, sản phẩm, thị trường mục tiêu từ website." },
              { step: 2, title: "Xây dựng ICP", desc: "Tạo Ideal Customer Profile dựa trên context của công ty: ngành target, company size, pain points." },
              { step: 3, title: "Tạo leads mẫu", desc: "Generate 5 leads phù hợp ICP với tên, chức danh, email và lý do phù hợp." },
              { step: 4, title: "Viết email outreach", desc: "Tạo 1 email cá nhân hóa hoàn chỉnh, tailored cho lead đầu tiên trong danh sách." },
            ].map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.3}
                className="flex gap-5"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 font-bold text-sm">
                  {step}
                </div>
                <div className="pt-1">
                  <h3 className="text-white font-semibold mb-1">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex gap-4">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-emerald-300 font-medium text-sm">Sau khi xem kết quả demo</p>
              <p className="text-slate-400 text-sm mt-1">
                Bạn có thể đăng ký để chạy AI SDR thật với leads thật — 7 ngày miễn phí.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
