import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { Mail, Calendar, CheckCircle, Clock, Eye } from "lucide-react";
import { useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } }),
};

const SEQUENCE_DAYS = [
  { key: "day0", label: "Day 0", title: "Welcome Email", desc: "Gửi ngay khi đăng ký", color: "emerald", icon: "🎉" },
  { key: "day1", label: "Day 1", title: "Giới thiệu AI SDR", desc: "Hướng dẫn sử dụng", color: "blue", icon: "💡" },
  { key: "day3", label: "Day 3", title: "Case Study", desc: "Câu chuyện thành công", color: "purple", icon: "📈" },
  { key: "day7", label: "Day 7", title: "Upgrade Reminder", desc: "Nhắc nhở nâng cấp", color: "amber", icon: "⏰" },
];

interface EmailPreview {
  day: string;
  subject: string;
  body: string;
  description: string;
}

function PreviewModal({ day, onClose }: { day: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<EmailPreview>({
    queryKey: ["email-preview", day],
    queryFn: () => apiFetch(`/api/email-automation/preview/${day}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Preview Email Template
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">✕</button>
        </div>

        {isLoading ? (
          <div className="text-slate-500 text-sm animate-pulse py-8 text-center">Đang tải...</div>
        ) : data ? (
          <div className="space-y-4">
            <div className="bg-black/50 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Subject</p>
              <p className="text-white font-medium">{data.subject}</p>
            </div>
            <div className="bg-black/50 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-2">Body</p>
              <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{data.body}</pre>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

export default function EmailAutomationPage() {
  const [previewDay, setPreviewDay] = useState<string | null>(null);

  const colorMap: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue:    "border-blue-500/30 bg-blue-500/5",
    purple:  "border-purple-500/30 bg-purple-500/5",
    amber:   "border-amber-500/30 bg-amber-500/5",
  };

  const dotMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    blue:    "bg-blue-400",
    purple:  "bg-purple-400",
    amber:   "bg-amber-400",
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Mail className="w-6 h-6 text-amber-400" /> Email Automation
        </h1>
        <p className="text-slate-400 text-sm mt-1">Chuỗi email tự động nuôi dưỡng khách hàng từ đăng ký đến trả phí</p>
      </div>

      {/* Sequence overview */}
      <div className="relative">
        <div className="absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-emerald-500/30 via-amber-500/30 to-transparent hidden md:block" />
        <div className="space-y-4">
          {SEQUENCE_DAYS.map(({ key, label, title, desc, color, icon }, i) => (
            <motion.div
              key={key}
              initial="hidden" animate="visible" variants={fadeUp} custom={i}
              className={`relative border rounded-2xl p-5 ml-0 md:ml-0 ${colorMap[color]}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-black/30`}>
                    {icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${dotMap[color]} text-black`}>
                        {label}
                      </span>
                      <h3 className="text-white font-semibold">{title}</h3>
                    </div>
                    <p className="text-slate-400 text-sm">{desc}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs text-slate-500">Tự động kích hoạt khi người dùng đăng ký</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewDay(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp}
        className="bg-white/3 border border-white/10 rounded-2xl p-6"
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" /> Cách hoạt động
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <div>
                <p className="text-white font-medium">Người dùng đăng ký tài khoản</p>
                <p className="text-slate-400 text-xs mt-0.5">Trigger tự động khi register thành công</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <div>
                <p className="text-white font-medium">Day 0: Welcome Email gửi ngay</p>
                <p className="text-slate-400 text-xs mt-0.5">Chào mừng và hướng dẫn bắt đầu</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">3</div>
              <div>
                <p className="text-white font-medium">Day 1, 3: Nurture emails</p>
                <p className="text-slate-400 text-xs mt-0.5">Hướng dẫn + case study thuyết phục</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">4</div>
              <div>
                <p className="text-white font-medium">Day 7: Upgrade Reminder</p>
                <p className="text-slate-400 text-xs mt-0.5">Nhắc nhở convert trước khi hết trial</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Status note */}
      <motion.div
        initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl"
      >
        <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-300 font-medium">Tích hợp email provider</p>
          <p className="text-xs text-slate-400 mt-1">
            Để gửi email thực tế, kết nối SendGrid hoặc Resend qua Settings → Integrations.
            Hiện tại hệ thống lưu log và preview templates đầy đủ.
          </p>
        </div>
      </motion.div>

      {previewDay && <PreviewModal day={previewDay} onClose={() => setPreviewDay(null)} />}
    </div>
  );
}
