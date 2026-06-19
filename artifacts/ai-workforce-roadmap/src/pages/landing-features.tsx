import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, Target, BarChart3, GitMerge, Mail, Search, Users,
  Brain, Shield, Clock, ArrowRight, CheckCircle, Star,
  TrendingUp, FileText, Globe, Database
} from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08 } }),
};

const SDR_FEATURES = [
  { icon: Search, title: "Phân tích Website & ICP", desc: "AI đọc website công ty, xác định ngành, sản phẩm, pain points và tạo Ideal Customer Profile tự động." },
  { icon: Users, title: "Tạo Lead Lists", desc: "Tự động tạo danh sách leads phù hợp ICP với thông tin đầy đủ: tên, chức danh, email, công ty." },
  { icon: Mail, title: "Email Cá Nhân Hóa", desc: "Viết email outreach độc đáo cho từng lead, dựa trên context của họ. Không dùng template cứng nhắc." },
  { icon: TrendingUp, title: "Follow-up Tự Động", desc: "Lên lịch follow-up sequence thông minh, điều chỉnh tone dựa trên phản hồi của prospect." },
  { icon: BarChart3, title: "Analytics & Reporting", desc: "Dashboard real-time theo dõi open rate, reply rate, meetings booked và ROI của toàn bộ campaign." },
  { icon: Database, title: "CRM Integration", desc: "Đồng bộ tự động với CRM, cập nhật deal stage và ghi chú activity sau mỗi tương tác." },
];

const MARKETING_FEATURES = [
  { icon: Globe, title: "Market Research AI", desc: "Phân tích thị trường, theo dõi xu hướng và tổng hợp competitor insights tự động." },
  { icon: FileText, title: "Content Generation", desc: "Tạo blog posts, landing pages, social posts SEO-optimized theo đúng tone of voice của brand." },
  { icon: Target, title: "Keyword Research", desc: "Tìm kiếm và phân tích keywords, phân loại theo intent và độ khó, gợi ý chiến lược content." },
  { icon: Star, title: "SEO Optimization", desc: "Tự động tối ưu nội dung, meta tags, internal linking để tăng organic traffic." },
];

const WORKFLOW_FEATURES = [
  { icon: GitMerge, title: "Visual Workflow Builder", desc: "Kéo thả để tạo quy trình tự động kết nối các AI agents và tác vụ." },
  { icon: Brain, title: "Multi-Agent Coordination", desc: "Nhiều AI agents phối hợp nhau hoàn thành workflow phức tạp như một đội thực sự." },
  { icon: Clock, title: "Scheduled Execution", desc: "Lên lịch chạy workflow tự động theo thời gian hoặc trigger từ sự kiện." },
  { icon: Shield, title: "Approval Gates", desc: "Thêm điểm kiểm duyệt con người vào workflow khi cần review trước khi tiếp tục." },
];

function FeatureSection({
  badge, title, desc, features, color, ctaText, ctaHref
}: {
  badge: string;
  title: string;
  desc: string;
  features: { icon: React.ElementType; title: string; desc: string }[];
  color: string;
  ctaText: string;
  ctaHref: string;
}) {
  return (
    <section className="py-20 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="mb-12"
        >
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border mb-4 ${color}`}>
            {badge}
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-slate-400 text-lg max-w-2xl">{desc}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {features.map(({ icon: Icon, title: t, desc: d }, i) => (
            <motion.div
              key={t}
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
            >
              <Icon className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="font-semibold text-white mb-1.5">{t}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{d}</p>
            </motion.div>
          ))}
        </div>

        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 font-medium text-sm transition-colors"
        >
          {ctaText} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}

const COMPARE = [
  { feature: "AI SDR tự động", starter: true, growth: true, enterprise: true },
  { feature: "AI Marketing", starter: false, growth: true, enterprise: true },
  { feature: "Workflow Automation", starter: false, growth: true, enterprise: true },
  { feature: "Unlimited Agents", starter: false, growth: false, enterprise: true },
  { feature: "Custom AI Models", starter: false, growth: false, enterprise: true },
  { feature: "API Access", starter: false, growth: true, enterprise: true },
  { feature: "Priority Support", starter: false, growth: false, enterprise: true },
];

export default function FeaturesPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-24 text-center border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border border-amber-500/30 text-amber-400 bg-amber-500/10 mb-5">
              Tất cả tính năng
            </span>
          </motion.div>
          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Mọi thứ bạn cần để{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              tăng trưởng nhanh hơn
            </span>
          </motion.h1>
          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="text-xl text-slate-400 mb-10"
          >
            Ba bộ tính năng mạnh mẽ: AI SDR, AI Marketing và Workflow Automation — tất cả trên một nền tảng.
          </motion.p>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5"
            >
              Dùng thử AI SDR miễn phí <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <FeatureSection
        badge="AI SDR"
        title="Sales Development Representative hoạt động 24/7"
        desc="Thay thế hoàn toàn SDR truyền thống với AI có thể xử lý hàng trăm prospects cùng lúc mà không mệt mỏi."
        features={SDR_FEATURES}
        color="text-amber-400 bg-amber-500/10 border-amber-500/30"
        ctaText="Xem demo AI SDR"
        ctaHref="/demo"
      />

      <FeatureSection
        badge="AI Marketing"
        title="Marketing Content & SEO tự động"
        desc="Đội marketing AI tạo content, nghiên cứu thị trường và tối ưu SEO không ngừng nghỉ."
        features={MARKETING_FEATURES}
        color="text-blue-400 bg-blue-500/10 border-blue-500/30"
        ctaText="Bắt đầu miễn phí"
        ctaHref="/register"
      />

      <FeatureSection
        badge="Workflow Automation"
        title="Tự động hoá quy trình phức tạp"
        desc="Kết nối AI agents thành pipeline hoàn chỉnh, từ research → outreach → follow-up → CRM."
        features={WORKFLOW_FEATURES}
        color="text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
        ctaText="Xem workflow templates"
        ctaHref="/register"
      />

      {/* Comparison table */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">So sánh các gói</h2>
            <p className="text-slate-400">Tính năng có sẵn theo từng gói dịch vụ</p>
          </motion.div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-slate-400 font-medium text-sm">Tính năng</th>
                  {["Starter", "Growth", "Enterprise"].map(p => (
                    <th key={p} className="text-center py-4 px-4 text-white font-semibold text-sm">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map(({ feature, starter, growth, enterprise }, i) => (
                  <tr key={feature} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/2" : ""}`}>
                    <td className="py-3.5 px-4 text-slate-300 text-sm">{feature}</td>
                    {[starter, growth, enterprise].map((has, j) => (
                      <td key={j} className="text-center py-3.5 px-4">
                        {has
                          ? <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
                          : <span className="text-slate-700 text-lg mx-auto block text-center">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5"
            >
              Xem bảng giá đầy đủ <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
