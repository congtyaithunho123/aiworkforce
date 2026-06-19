import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, ArrowRight, Users, BarChart3, Mail, Target,
  CheckCircle, Star, TrendingUp, Globe, Shield, Clock
} from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.1 } }),
};

const FEATURES = [
  {
    icon: Zap,
    title: "AI SDR Tự Động",
    desc: "Phân tích ICP, tìm kiếm leads, viết email cá nhân hóa và theo dõi phản hồi — hoàn toàn tự động.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Target,
    title: "AI Marketing",
    desc: "Nghiên cứu thị trường, tạo keywords SEO, viết content và tối ưu chiến dịch liên tục.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: BarChart3,
    title: "Workflow Automation",
    desc: "Kết nối các tác vụ thành quy trình tự động — từ research đến outreach đến CRM.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: Globe,
    title: "Multi-Agent Platform",
    desc: "Triển khai nhiều AI agents phối hợp nhau như một đội nhân viên thực sự.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
];

const STATS = [
  { value: "10×", label: "Năng suất sales tăng" },
  { value: "80%", label: "Chi phí tiết kiệm" },
  { value: "24/7", label: "Hoạt động không ngừng" },
  { value: "<5 phút", label: "Thời gian setup" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Nhập website công ty target",
    desc: "AI phân tích ngành, sản phẩm, đối thủ và xác định ICP (Ideal Customer Profile).",
  },
  {
    step: "02",
    title: "AI tạo danh sách leads",
    desc: "Tự động tìm kiếm và tạo danh sách leads phù hợp với ICP đã xác định.",
  },
  {
    step: "03",
    title: "Gửi email cá nhân hóa",
    desc: "Viết và gửi email outreach cá nhân hóa theo từng lead, theo dõi và follow-up tự động.",
  },
];

const TESTIMONIALS = [
  {
    name: "Nguyễn Minh Tuấn",
    role: "CEO, TechVN Startup",
    text: "AI SDR giúp chúng tôi tăng số leads qualified lên 3x chỉ sau 2 tuần. Không cần thuê thêm sales rep.",
    rating: 5,
  },
  {
    name: "Trần Thu Hà",
    role: "Head of Sales, GrowthCo",
    text: "Email tự động cá nhân hóa có tỷ lệ reply cao hơn email viết tay trước đây của team tôi.",
    rating: 5,
  },
  {
    name: "Phạm Quốc Bảo",
    role: "Founder, B2B SaaS",
    text: "Setup xong trong 5 phút, AI SDR bắt đầu làm việc ngay lập tức. Tiết kiệm 40 giờ/tuần.",
    rating: 5,
  },
];

export default function LandingHome() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Đội ngũ Sales AI hoạt động 24/7
            </span>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
          >
            Thuê đội ngũ{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              AI làm sales
            </span>{" "}
            cho bạn
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            AI Workforce tự động phân tích thị trường, tìm kiếm leads, viết email cá nhân hóa
            và theo dõi deal — không cần thuê thêm nhân viên sales.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/demo"
              className="flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-lg transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5"
            >
              Dùng thử AI SDR <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-8 py-4 border border-white/20 text-white hover:bg-white/5 rounded-xl text-lg transition-all font-medium"
            >
              Xem bảng giá
            </Link>
          </motion.div>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={4}
            className="mt-5 text-sm text-slate-500"
          >
            Miễn phí 7 ngày · Không cần thẻ tín dụng · Setup trong 5 phút
          </motion.p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ value, label }, i) => (
              <motion.div
                key={label}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                className="text-center"
              >
                <p className="text-4xl font-bold text-amber-400 mb-1">{value}</p>
                <p className="text-sm text-slate-400">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold text-white mb-4">Mọi thứ bạn cần để tăng trưởng</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Một nền tảng duy nhất thay thế cả đội sales, marketing và operations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }, i) => (
              <motion.div
                key={title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}
                className={`p-6 rounded-2xl border ${bg} flex gap-5`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/features" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Xem tất cả tính năng <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white/2 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold text-white mb-4">Hoạt động như thế nào?</h2>
            <p className="text-slate-400 text-lg">Ba bước đơn giản để AI SDR bắt đầu làm việc cho bạn</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <motion.div
                key={step}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}
                className="relative text-center"
              >
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-2/3 w-full h-px bg-gradient-to-r from-amber-500/30 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
                  <span className="text-2xl font-bold text-amber-400">{step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5"
            >
              Thử ngay miễn phí <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-14"
          >
            <h2 className="text-4xl font-bold text-white mb-4">Khách hàng nói gì?</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text, rating }, i) => (
              <motion.div
                key={name}
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.5}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-4"
              >
                <div className="flex gap-1">
                  {Array.from({ length: rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">"{text}"</p>
                <div>
                  <p className="text-white font-semibold text-sm">{name}</p>
                  <p className="text-slate-500 text-xs">{role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-16 border-y border-white/10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
            {[
              { icon: Shield, label: "Bảo mật dữ liệu tuyệt đối" },
              { icon: Clock, label: "Uptime 99.9%" },
              { icon: Users, label: "500+ doanh nghiệp tin dùng" },
              { icon: TrendingUp, label: "10M+ emails đã gửi" },
              { icon: Mail, label: "Hỗ trợ 24/7" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-slate-600" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Bắt đầu với AI SDR{" "}
              <span className="text-amber-400">hoàn toàn miễn phí</span>
            </h2>
            <p className="text-slate-400 text-lg mb-10">
              7 ngày trial đầy đủ tính năng. Không cần thẻ tín dụng.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/demo"
                className="flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-lg transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5"
              >
                Dùng thử AI SDR <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white hover:bg-white/5 rounded-xl text-lg transition-all font-medium"
              >
                Liên hệ tư vấn
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-slate-500">
              {["✓ Miễn phí 7 ngày", "✓ Không cần thẻ tín dụng", "✓ Huỷ bất kỳ lúc nào"].map(t => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
