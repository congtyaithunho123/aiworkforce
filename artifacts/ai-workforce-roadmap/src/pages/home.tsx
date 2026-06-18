import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, Cpu, Layers, Workflow, Database, Zap,
  Server, Code, Globe, User, Users, GitMerge, Building2,
  MonitorSmartphone, CheckSquare, Square, ChevronDown,
  ChevronUp, StickyNote, BarChart3, Target
} from "lucide-react";
import heroBg from "@/assets/hero-bg.png";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

type ChecklistItem = { id: string; label: string };
type Phase = {
  phase: string;
  title: string;
  duration: string;
  points: string[];
  icon: React.ElementType;
  checklist: ChecklistItem[];
};

const phases: Phase[] = [
  {
    phase: "Giai đoạn 1",
    title: "AI Employee đơn lẻ",
    duration: "0–6 tháng",
    points: [
      "Chỉ xây 1 nhân viên AI giải quyết 1 vấn đề đau đớn",
      "Ví dụ: AI Sales (tìm khách hàng, thu thập email, gửi email cá nhân hóa, theo dõi phản hồi, đặt lịch hẹn) hoặc AI Marketing",
      "Mục tiêu: 10–50 khách hàng trả tiền đầu tiên"
    ],
    icon: User,
    checklist: [
      { id: "p1-1", label: "Chọn được 1 vấn đề kinh doanh cụ thể" },
      { id: "p1-2", label: "Thiết lập môi trường dev (Python, FastAPI, n8n)" },
      { id: "p1-3", label: "Kết nối LLM API (OpenAI / Claude / Gemini)" },
      { id: "p1-4", label: "Xây dựng AI Agent đầu tiên" },
      { id: "p1-5", label: "Kết nối PostgreSQL + Vector DB (Qdrant)" },
      { id: "p1-6", label: "Test với dữ liệu thực tế" },
      { id: "p1-7", label: "Có 10 khách hàng trả tiền đầu tiên" },
    ]
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
    icon: Users,
    checklist: [
      { id: "p2-1", label: "Thiết kế kiến trúc multi-agent" },
      { id: "p2-2", label: "Xây SDR Agent" },
      { id: "p2-3", label: "Xây Lead Research Agent" },
      { id: "p2-4", label: "Xây CRM Agent" },
      { id: "p2-5", label: "Xây Follow-up Agent" },
      { id: "p2-6", label: "Xây Analytics Agent" },
      { id: "p2-7", label: "Kết nối luồng đầu-cuối hoàn chỉnh" },
    ]
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
    icon: GitMerge,
    checklist: [
      { id: "p3-1", label: "Xây Agent Registry (danh sách + metadata)" },
      { id: "p3-2", label: "Triển khai Shared Memory layer (Qdrant / Redis)" },
      { id: "p3-3", label: "Xây Task Router tự động phân việc" },
      { id: "p3-4", label: "Test scenario phức tạp (nhiều agent phối hợp)" },
      { id: "p3-5", label: "Onboard 5+ doanh nghiệp thực tế" },
    ]
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
    icon: Building2,
    checklist: [
      { id: "p4-1", label: "Xây đầy đủ Phòng Marketing (5 agents)" },
      { id: "p4-2", label: "Xây đầy đủ Phòng Sales (3 agents)" },
      { id: "p4-3", label: "Xây đầy đủ Phòng HR (3 agents)" },
      { id: "p4-4", label: "Xây đầy đủ Phòng Kế Toán (3 agents)" },
      { id: "p4-5", label: "Dashboard quản lý đa phòng ban" },
      { id: "p4-6", label: "Đạt 50+ doanh nghiệp trả tiền" },
    ]
  },
  {
    phase: "Giai đoạn 5",
    title: "AI Workforce Platform",
    duration: "4–6 năm",
    points: [
      "Giống \"AWS của nhân viên AI\" — thêm/xóa/đào tạo nhân viên AI",
      "Thu tiền theo tháng, nhiệm vụ, số agent"
    ],
    icon: Server,
    checklist: [
      { id: "p5-1", label: "Xây nền tảng SaaS multi-tenant" },
      { id: "p5-2", label: "Tích hợp billing (tháng / task / per-agent)" },
      { id: "p5-3", label: "Onboarding flow tự phục vụ" },
      { id: "p5-4", label: "Hệ thống đào tạo agent tùy chỉnh" },
      { id: "p5-5", label: "Đạt 100+ doanh nghiệp trả tiền" },
    ]
  },
  {
    phase: "Giai đoạn 6",
    title: "AI Workforce Marketplace",
    duration: "5–8 năm",
    points: [
      "Cho bên thứ ba tạo nhân viên AI (giống Apple App Store / Google Play)",
      "Thu 20–30% phí giao dịch"
    ],
    icon: Globe,
    checklist: [
      { id: "p6-1", label: "Xây SDK cho third-party developers" },
      { id: "p6-2", label: "Xây hệ thống review & rating" },
      { id: "p6-3", label: "Tích hợp payment split 70/30" },
      { id: "p6-4", label: "Launch marketplace public beta" },
      { id: "p6-5", label: "Có 10+ third-party agents được bán" },
    ]
  }
];

type ProgressState = {
  checked: Record<string, boolean>;
  notes: Record<string, string>;
};

const STORAGE_KEY = "ai-workforce-progress-v1";

function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { checked: {}, notes: {} };
}

function saveProgress(state: ProgressState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function phaseProgress(phaseItems: ChecklistItem[], checked: Record<string, boolean>) {
  const total = phaseItems.length;
  const done = phaseItems.filter(i => checked[i.id]).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function overallProgress(checked: Record<string, boolean>) {
  const allItems = phases.flatMap(p => p.checklist);
  const total = allItems.length;
  const done = allItems.filter(i => checked[i.id]).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function phaseStatusColor(pct: number) {
  if (pct === 0) return "text-slate-500";
  if (pct < 50) return "text-blue-400";
  if (pct < 100) return "text-amber-400";
  return "text-emerald-400";
}

function phaseBarColor(pct: number) {
  if (pct === 0) return "bg-slate-700";
  if (pct < 50) return "bg-blue-500";
  if (pct < 100) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function Home() {
  const [progress, setProgress] = useState<ProgressState>({ checked: {}, notes: {} });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [notesOpen, setNotesOpen] = useState<Record<number, boolean>>({});
  const notesTimeout = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    document.documentElement.classList.add('dark');
    setProgress(loadProgress());
  }, []);

  function toggleCheck(id: string) {
    setProgress(prev => {
      const next = { ...prev, checked: { ...prev.checked, [id]: !prev.checked[id] } };
      saveProgress(next);
      return next;
    });
  }

  function setNote(phaseIdx: number, value: string) {
    const key = `phase-${phaseIdx}`;
    clearTimeout(notesTimeout.current[phaseIdx]);
    setProgress(prev => {
      const next = { ...prev, notes: { ...prev.notes, [key]: value } };
      notesTimeout.current[phaseIdx] = setTimeout(() => saveProgress(next), 400);
      return next;
    });
  }

  function toggleExpand(idx: number) {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function toggleNotes(idx: number) {
    setNotesOpen(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  const overall = overallProgress(progress.checked);

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
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
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

            {/* Overall progress pill */}
            <motion.div variants={fadeInUp} className="inline-flex flex-col items-center gap-3 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Target className="w-4 h-4 text-amber-500" />
                <span>Tiến độ tổng thể</span>
                <span className="font-bold text-white">{overall.done}/{overall.total} mục tiêu</span>
                <span className={`font-bold text-lg ${phaseStatusColor(overall.pct)}`}>{overall.pct}%</span>
              </div>
              <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${phaseBarColor(overall.pct)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${overall.pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
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

      {/* Progress Dashboard */}
      <section className="py-20 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6 text-amber-500" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">Tổng quan tiến độ</h2>
            </div>
            <div className="w-16 h-1 bg-amber-500" />
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {phases.map((ph, idx) => {
              const { done, total, pct } = phaseProgress(ph.checklist, progress.checked);
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.07 }}
                  data-testid={`progress-card-${idx}`}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3"
                >
                  <div className="text-xs text-slate-500 font-mono tracking-wider">{ph.phase}</div>
                  <div className={`text-2xl font-bold ${phaseStatusColor(pct)}`}>{pct}%</div>
                  <div className="text-xs text-slate-500">{done}/{total} xong</div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${phaseBarColor(pct)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.07 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline + Tracker Section */}
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
            {phases.map((phase, idx) => {
              const { done, total, pct } = phaseProgress(phase.checklist, progress.checked);
              const isExpanded = expanded[idx] ?? false;
              const isNotesOpen = notesOpen[idx] ?? false;
              const noteKey = `phase-${idx}`;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative pl-8 md:pl-16"
                  data-testid={`phase-card-${idx}`}
                >
                  <div className="absolute -left-6 md:-left-8 top-0 w-12 h-12 md:w-16 md:h-16 rounded-full bg-black border border-white/10 flex items-center justify-center text-amber-500">
                    <phase.icon className="w-5 h-5 md:w-8 md:h-8" />
                  </div>

                  <div className={`bg-white/5 border rounded-2xl p-6 md:p-8 transition-colors ${pct === 100 ? "border-emerald-500/40" : "border-white/10 hover:border-amber-500/30"}`}>
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-amber-500 font-mono text-sm tracking-widest mb-1">{phase.phase}</div>
                        <h3 className="text-2xl font-bold text-white">{phase.title}</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        {pct === 100 && (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                            Hoàn thành
                          </span>
                        )}
                        <div className="px-4 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm font-medium whitespace-nowrap">
                          {phase.duration}
                        </div>
                      </div>
                    </div>

                    {/* Phase progress bar */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full transition-all duration-500 ${phaseBarColor(pct)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${phaseStatusColor(pct)}`}>{pct}%</span>
                      <span className="text-xs text-slate-500">{done}/{total}</span>
                    </div>

                    {/* Description points */}
                    <ul className="space-y-3 mb-6">
                      {phase.points.map((point, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2.5 shrink-0" />
                          <span className="text-slate-400 leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Tracker toggle */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        data-testid={`toggle-checklist-${idx}`}
                        onClick={() => toggleExpand(idx)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        <CheckSquare className="w-4 h-4 text-amber-500" />
                        Checklist ({done}/{total})
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        data-testid={`toggle-notes-${idx}`}
                        onClick={() => toggleNotes(idx)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/30 text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        <StickyNote className="w-4 h-4 text-amber-500" />
                        Ghi chú
                        {progress.notes[noteKey] ? <span className="w-2 h-2 rounded-full bg-amber-500" /> : null}
                        {isNotesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Checklist panel */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          key="checklist"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-5 pt-5 border-t border-white/10 space-y-3">
                            {phase.checklist.map(item => {
                              const checked = !!progress.checked[item.id];
                              return (
                                <button
                                  key={item.id}
                                  data-testid={`check-item-${item.id}`}
                                  onClick={() => toggleCheck(item.id)}
                                  className="w-full flex items-center gap-3 text-left group"
                                >
                                  {checked ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-600 group-hover:text-amber-500 transition-colors shrink-0" />
                                  )}
                                  <span className={`text-sm leading-relaxed transition-colors ${checked ? "line-through text-slate-600" : "text-slate-300 group-hover:text-white"}`}>
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Notes panel */}
                    <AnimatePresence>
                      {isNotesOpen && (
                        <motion.div
                          key="notes"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-5 pt-5 border-t border-white/10">
                            <label className="block text-xs text-slate-500 mb-2 font-medium tracking-wide uppercase">
                              Ghi chú cho {phase.phase}
                            </label>
                            <textarea
                              data-testid={`notes-${idx}`}
                              value={progress.notes[noteKey] ?? ""}
                              onChange={e => setNote(idx, e.target.value)}
                              placeholder="Viết ghi chú, quyết định, hoặc bài học ở đây..."
                              rows={4}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
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
