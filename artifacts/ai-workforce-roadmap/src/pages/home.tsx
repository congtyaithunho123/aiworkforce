import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Cpu, Layers, Workflow, Database, Shield, Zap, Server, Code, Globe, User, Users, GitMerge, Building2, MonitorSmartphone } from "lucide-react";
import heroBg from "@/assets/hero-bg.png";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const phases = [
  {
    phase: "Giai đoạn 1",
    title: "AI Employee đơn lẻ",
    duration: "0–6 tháng",
    points: [
      "Chỉ xây 1 nhân viên AI giải quyết 1 vấn đề đau đớn",
      "Ví dụ: AI Sales (tìm khách hàng, thu thập email, gửi email cá nhân hóa, theo dõi phản hồi, đặt lịch hẹn) hoặc AI Marketing (nghiên cứu thị trường, viết content, tạo hình ảnh, đăng bài tự động)",
      "Mục tiêu: 10–50 khách hàng trả tiền đầu tiên"
    ],
    icon: User
  },
  {
    phase: "Giai đoạn 2",
    title: "AI Team",
    duration: "6–12 tháng",
    points: [
      "Tạo đội nhân viên AI (AI Sales Team: SDR Agent, Lead Research Agent, CRM Agent, Follow-up Agent, Analytics Agent)",
      "Luồng: Research → Outreach → Follow-up → Meeting → CRM",
      "Khách hàng thuê \"đội sales AI\" thay vì \"chatbot\""
    ],
    icon: Users
  },
  {
    phase: "Giai đoạn 3",
    title: "Multi-Agent Operating System",
    duration: "1–2 năm",
    points: [
      "Agent Registry (Marketing Manager, Sales Manager, Recruiter, Accountant, Customer Support)",
      "Shared Memory (toàn bộ agent dùng chung bộ nhớ)",
      "Task Router (tự phân việc)"
    ],
    icon: GitMerge
  },
  {
    phase: "Giai đoạn 4",
    title: "AI Department",
    duration: "2–4 năm",
    points: [
      "Phòng Marketing: SEO/Facebook/TikTok/Email/Content Agent",
      "Phòng Sales: Lead/Outreach/Negotiation Agent",
      "Phòng HR: CV Screening/Interview/Onboarding Agent",
      "Phòng Kế Toán: Invoice/Expense/Tax Agent"
    ],
    icon: Building2
  },
  {
    phase: "Giai đoạn 5",
    title: "AI Workforce Platform",
    duration: "4–6 năm",
    points: [
      "Giống \"AWS của nhân viên AI\" — thêm/xóa/đào tạo nhân viên AI",
      "Thu tiền theo tháng, nhiệm vụ, số agent"
    ],
    icon: Server
  },
  {
    phase: "Giai đoạn 6",
    title: "AI Workforce Marketplace",
    duration: "5–8 năm",
    points: [
      "Cho bên thứ ba tạo nhân viên AI (giống Apple App Store / Google Play)",
      "Thu 20–30% phí giao dịch"
    ],
    icon: Globe
  }
];

export default function Home() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="min-h-screen bg-black text-slate-300 font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black z-10" />
          <img src={heroBg} alt="Hero Background" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>
        
        <div className="relative z-20 max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-medium tracking-wide mb-6">
              <Zap className="w-4 h-4" />
              <span>Strategic Compass 2026–2032</span>
            </motion.div>
            <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
              AI Workforce <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600">Roadmap</span>
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-12">
              Một doanh nghiệp có thể thuê 10–100 nhân viên AI thay vì phải tuyển 10–100 người.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Path Section */}
      <section className="py-20 bg-black/50 border-b border-white/5 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-4 text-lg md:text-xl font-medium text-slate-300"
          >
            <span>1 AI Sales</span>
            <ChevronRight className="text-amber-500 w-5 h-5" />
            <span>Đội Sales AI</span>
            <ChevronRight className="text-amber-500 w-5 h-5" />
            <span>Workforce</span>
            <ChevronRight className="text-amber-500 w-5 h-5" />
            <span>Marketplace</span>
            <ChevronRight className="text-amber-500 w-5 h-5" />
            <span className="text-amber-400">Hệ điều hành</span>
          </motion.div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-32 relative">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Lộ trình triển khai</h2>
            <div className="w-20 h-1 bg-amber-500" />
          </motion.div>

          <div className="relative border-l border-white/10 ml-4 md:ml-8 space-y-20">
            {phases.map((phase, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative pl-8 md:pl-16"
              >
                <div className="absolute -left-6 md:-left-8 top-0 w-12 h-12 md:w-16 md:h-16 rounded-full bg-black border border-white/10 flex items-center justify-center text-amber-500">
                  <phase.icon className="w-5 h-5 md:w-8 md:h-8" />
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 hover:border-amber-500/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="text-amber-500 font-mono text-sm tracking-widest mb-1">{phase.phase}</div>
                      <h3 className="text-2xl font-bold text-white">{phase.title}</h3>
                    </div>
                    <div className="px-4 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm font-medium whitespace-nowrap">
                      {phase.duration}
                    </div>
                  </div>
                  
                  <ul className="space-y-3">
                    {phase.points.map((point, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2.5 shrink-0" />
                        <span className="text-slate-400 leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-32 bg-zinc-950/50 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Kiến trúc hệ thống</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Sơ đồ tổ chức nhân sự AI trong tương lai</p>
          </motion.div>

          <div className="flex flex-col items-center justify-center max-w-4xl mx-auto space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-64 py-4 px-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center shadow-[0_0_30px_rgba(245,158,11,0.1)]"
            >
              <h4 className="font-bold text-amber-400">CEO AI</h4>
            </motion.div>
            
            <div className="w-0.5 h-8 bg-gradient-to-b from-amber-500/30 to-white/20" />
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-wrap justify-center gap-4 w-full"
            >
              {['Marketing Manager', 'Sales Manager', 'HR Manager'].map((manager, i) => (
                <div key={i} className="flex-1 min-w-[200px] py-4 px-6 rounded-xl bg-white/5 border border-white/10 text-center">
                  <h4 className="font-medium text-white">{manager}</h4>
                </div>
              ))}
            </motion.div>

            <div className="w-0.5 h-8 bg-white/20" />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full py-4 px-6 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center"
            >
              <h4 className="font-medium text-blue-400">Their Agents</h4>
            </motion.div>

            <div className="w-0.5 h-8 bg-white/20" />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full py-4 px-6 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center"
            >
              <h4 className="font-medium text-purple-400">Shared Memory Layer</h4>
            </motion.div>

            <div className="w-0.5 h-8 bg-white/20" />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full py-4 px-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"
            >
              <h4 className="font-medium text-emerald-400">Workflow / Task Router</h4>
            </motion.div>

            <div className="w-0.5 h-8 bg-white/20" />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="w-full py-4 px-6 rounded-xl bg-zinc-800 border border-zinc-700 text-center"
            >
              <h4 className="font-medium text-zinc-300">LLM + Tools Layer</h4>
            </motion.div>

            <div className="w-0.5 h-8 bg-white/20" />

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-wrap justify-center gap-2 w-full text-sm"
            >
              {['CRM', 'ERP', 'Email', 'WhatsApp', 'Ads'].map((tool, i) => (
                <div key={i} className="py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                  {tool}
                </div>
              ))}
            </motion.div>

          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-32 relative">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Technology Stack</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Bắt buộc", items: ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "Linux"], icon: Code, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
              { title: "AI", items: ["OpenAI API", "Claude API", "Gemini API", "MCP", "RAG", "Vector Database"], icon: Cpu, color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
              { title: "Agent", items: ["LangGraph", "CrewAI", "AutoGen", "n8n"], icon: Workflow, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
              { title: "Scale", items: ["Kubernetes", "Kafka", "Ray", "Temporal"], icon: Layers, color: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" }
            ].map((stack, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10"
              >
                <div className={`w-12 h-12 rounded-xl ${stack.bg} ${stack.border} border flex items-center justify-center mb-6`}>
                  <stack.icon className={`w-6 h-6 ${stack.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">{stack.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {stack.items.map((item, i) => (
                    <span key={i} className="px-3 py-1 rounded-md bg-white/5 border border-white/5 text-sm text-slate-300">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Callout Section */}
      <section className="py-24 bg-amber-500/5 border-t border-b border-amber-500/20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-6">
              <Globe className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ý tưởng Việt Nam</h2>
            <p className="text-xl text-slate-300 leading-relaxed">
              Cơ hội vàng cho các SME Việt Nam tận dụng lực lượng lao động AI để tối ưu hóa chi phí, tăng trưởng theo cấp số nhân và sẵn sàng cạnh tranh trên thị trường toàn cầu.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-slate-500 text-sm border-t border-white/10 bg-black">
        <p>© 2026-2032 AI Workforce Vision. Xây dựng tương lai.</p>
      </footer>
    </div>
  );
}
