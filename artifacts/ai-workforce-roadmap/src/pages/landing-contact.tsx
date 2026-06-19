import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MessageSquare, CheckCircle, Loader2, Building2, User } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { apiFetch } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08 } }),
};

const CONTACT_OPTIONS = [
  {
    icon: MessageSquare,
    title: "Demo trực tiếp",
    desc: "Đặt lịch demo 30 phút với team sales. Chúng tôi sẽ demo theo use case cụ thể của bạn.",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Mail,
    title: "Email",
    desc: "hello@aiworkforce.vn — Phản hồi trong vòng 4 giờ làm việc.",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Phone,
    title: "Hotline",
    desc: "+84 (0) 123 456 789 — Hỗ trợ 8:00–18:00 thứ 2–6",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

type FormState = {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
};

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({ name: "", email: "", company: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function update(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setError("");
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError("Vui lòng điền đầy đủ tên, email và nội dung.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/marketing-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          phone: form.phone,
          message: form.message,
          source: "contact_form",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Lỗi server: ${res.status}`);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-20 text-center border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6">
          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="text-5xl font-bold text-white mb-5"
          >
            Liên hệ với chúng tôi
          </motion.h1>
          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-slate-400 text-lg"
          >
            Có câu hỏi? Muốn demo? Hoặc cần tư vấn giải pháp phù hợp? Team chúng tôi luôn sẵn sàng.
          </motion.p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Contact options */}
            <div className="space-y-6">
              <motion.div
                initial="hidden" animate="visible" variants={fadeUp} custom={0}
              >
                <h2 className="text-2xl font-bold text-white mb-2">Cách liên hệ</h2>
                <p className="text-slate-400 text-sm">Chọn kênh phù hợp nhất với bạn</p>
              </motion.div>

              {CONTACT_OPTIONS.map(({ icon: Icon, title, desc, color }, i) => (
                <motion.div
                  key={title}
                  initial="hidden" animate="visible" variants={fadeUp} custom={(i + 1) * 0.5}
                  className={`p-5 rounded-xl border flex gap-4 ${color}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}

              <motion.div
                initial="hidden" animate="visible" variants={fadeUp} custom={2}
                className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 mt-4"
              >
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  Tại sao chọn AI Workforce?
                </h3>
                <ul className="space-y-2.5">
                  {[
                    "Setup trong 5 phút, không cần IT",
                    "Hỗ trợ tiếng Việt và tiếng Anh",
                    "Tích hợp dễ dàng với CRM hiện tại",
                    "7 ngày dùng thử miễn phí",
                  ].map(item => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Right: Form */}
            <motion.div
              initial="hidden" animate="visible" variants={fadeUp} custom={0.5}
              className="bg-white/5 border border-white/10 rounded-2xl p-8"
            >
              {success ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Đã nhận được yêu cầu!</h3>
                    <p className="text-slate-400 text-sm">
                      Chúng tôi sẽ liên hệ với bạn trong vòng 4 giờ làm việc.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-6">Gửi tin nhắn</h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Tên của bạn *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={form.name}
                            onChange={update("name")}
                            placeholder="Nguyễn Văn A"
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Email *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="email"
                            value={form.email}
                            onChange={update("email")}
                            placeholder="email@company.com"
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Công ty
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={form.company}
                            onChange={update("company")}
                            placeholder="Tên công ty"
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                          Số điện thoại
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={update("phone")}
                            placeholder="+84 xxx xxx xxx"
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Nội dung *
                      </label>
                      <textarea
                        value={form.message}
                        onChange={update("message")}
                        rows={5}
                        placeholder="Mô tả nhu cầu của bạn, hoặc câu hỏi bạn muốn hỏi..."
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm transition-colors resize-none"
                      />
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all hover:-translate-y-0.5 disabled:translate-y-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang gửi...
                        </>
                      ) : (
                        "Gửi tin nhắn"
                      )}
                    </button>

                    <p className="text-center text-xs text-slate-600">
                      Bằng cách gửi form này, bạn đồng ý để chúng tôi liên hệ lại.
                    </p>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
