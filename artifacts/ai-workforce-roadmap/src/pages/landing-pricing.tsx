import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, Zap, ArrowRight, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08 } }),
};

const PLANS = [
  {
    name: "Starter",
    monthlyPrice: 49,
    annualPrice: 39,
    desc: "Dành cho cá nhân và startup muốn thử AI SDR",
    highlight: false,
    features: [
      "5 AI Agents",
      "500 Tasks/tháng",
      "AI SDR cơ bản",
      "10 Workflows",
      "Email support",
      "Dashboard analytics",
      "1 thành viên team",
    ],
    cta: "Bắt đầu miễn phí",
    href: "/register",
  },
  {
    name: "Growth",
    monthlyPrice: 149,
    annualPrice: 119,
    desc: "Dành cho team sales đang scale nhanh",
    highlight: true,
    badge: "Phổ biến nhất",
    features: [
      "20 AI Agents",
      "5.000 Tasks/tháng",
      "AI SDR đầy đủ tính năng",
      "AI Marketing",
      "Unlimited Workflows",
      "API Access",
      "Priority support",
      "5 thành viên team",
      "Custom agent prompts",
    ],
    cta: "Dùng thử 7 ngày",
    href: "/register",
  },
  {
    name: "Enterprise",
    monthlyPrice: 499,
    annualPrice: 399,
    desc: "Dành cho doanh nghiệp cần giải pháp toàn diện",
    highlight: false,
    features: [
      "Unlimited AI Agents",
      "Unlimited Tasks",
      "Tất cả tính năng Growth",
      "Custom AI Models",
      "Dedicated support",
      "SLA 99.9% uptime",
      "Unlimited thành viên",
      "On-premise option",
      "Training & onboarding",
    ],
    cta: "Liên hệ sales",
    href: "/contact",
  },
];

const FAQS = [
  {
    q: "Tôi có thể dùng thử miễn phí không?",
    a: "Có! Tất cả các gói đều có 7 ngày dùng thử miễn phí với đầy đủ tính năng. Không cần thẻ tín dụng."
  },
  {
    q: "Task là gì? Được tính như thế nào?",
    a: "Mỗi lần AI agent thực hiện một tác vụ (phân tích website, tạo lead, viết email, v.v.) là 1 task. Dashboard sẽ hiển thị số task đã dùng trong tháng."
  },
  {
    q: "Tôi có thể upgrade hoặc downgrade bất kỳ lúc nào không?",
    a: "Có, bạn có thể thay đổi gói bất kỳ lúc nào. Khi upgrade, bạn chỉ trả phần chênh lệch cho phần còn lại của tháng."
  },
  {
    q: "AI SDR có hoạt động với tiếng Việt không?",
    a: "Có, AI Workforce hỗ trợ đầy đủ tiếng Việt và tiếng Anh. AI sẽ tự điều chỉnh ngôn ngữ phù hợp với từng prospect."
  },
  {
    q: "Dữ liệu của tôi có được bảo mật không?",
    a: "Tuyệt đối. Dữ liệu của bạn được mã hóa và lưu trữ an toàn trên server của chúng tôi. Chúng tôi không bao giờ chia sẻ dữ liệu với bên thứ ba."
  },
  {
    q: "Gói Enterprise có gì khác biệt?",
    a: "Enterprise bao gồm custom AI models, dedicated support, SLA guarantee, và khả năng deploy on-premise nếu cần. Liên hệ team sales để được tư vấn."
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="text-white font-medium text-sm pr-4">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-white/5 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-20 text-center border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6">
          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
            className="text-5xl font-bold text-white mb-5"
          >
            Giá minh bạch,{" "}
            <span className="text-amber-400">không phí ẩn</span>
          </motion.h1>
          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-slate-400 text-lg mb-8"
          >
            Bắt đầu miễn phí 7 ngày. Nâng cấp khi bạn sẵn sàng.
          </motion.p>

          {/* Annual toggle */}
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-2 py-1.5"
          >
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${!annual ? "bg-amber-500 text-black" : "text-slate-400 hover:text-white"}`}
            >
              Hàng tháng
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${annual ? "bg-amber-500 text-black" : "text-slate-400 hover:text-white"}`}
            >
              Hàng năm
              <span className="ml-1.5 text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map(({ name, monthlyPrice, annualPrice, desc, highlight, badge, features, cta, href }, i) => (
              <motion.div
                key={name}
                initial="hidden" animate="visible" variants={fadeUp} custom={i * 0.5}
                className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
                  highlight
                    ? "border-amber-500/50 bg-amber-500/5 shadow-xl shadow-amber-500/10"
                    : "border-white/10 bg-white/3"
                }`}
              >
                {highlight && badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-amber-500 text-black text-xs font-bold rounded-full whitespace-nowrap">
                      {badge}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className={`w-4 h-4 ${highlight ? "text-amber-400" : "text-slate-500"}`} />
                    <span className="font-bold text-white text-lg">{name}</span>
                  </div>
                  <p className="text-slate-400 text-sm">{desc}</p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold text-white">
                      ${annual ? annualPrice : monthlyPrice}
                    </span>
                    <span className="text-slate-400 text-sm">/tháng</span>
                  </div>
                  {annual && (
                    <p className="text-xs text-emerald-400 mt-1">
                      Tiết kiệm ${(monthlyPrice - annualPrice) * 12}/năm
                    </p>
                  )}
                </div>

                <Link
                  href={href}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold text-center transition-all hover:-translate-y-0.5 ${
                    highlight
                      ? "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"
                      : "border border-white/20 text-white hover:bg-white/5"
                  }`}
                >
                  {cta}
                </Link>

                <ul className="space-y-3 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-300 text-sm">{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-slate-500 text-sm mt-6 flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Tất cả các gói đều bao gồm 7 ngày dùng thử miễn phí. Không cần thẻ tín dụng.
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 border-t border-white/10">
        <div className="max-w-2xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-10"
          >
            <h2 className="text-3xl font-bold text-white mb-3">Câu hỏi thường gặp</h2>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.3}
              >
                <FAQItem q={faq.q} a={faq.a} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-white mb-5">Còn phân vân? Thử trước đã tính sau</h2>
          <p className="text-slate-400 mb-8">Demo ngay bây giờ, không cần đăng ký tài khoản.</p>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5"
          >
            Dùng thử AI SDR miễn phí <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
