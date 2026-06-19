import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";
import { Building2, Globe, Users, Rocket, ChevronRight, ChevronLeft, Check } from "lucide-react";

const INDUSTRIES = [
  { id: "ecommerce", label: "Thương mại điện tử", icon: "🛒" },
  { id: "saas", label: "SaaS / Phần mềm", icon: "💻" },
  { id: "realestate", label: "Bất động sản", icon: "🏢" },
  { id: "education", label: "Giáo dục", icon: "📚" },
  { id: "finance", label: "Tài chính / Ngân hàng", icon: "💰" },
  { id: "healthcare", label: "Y tế / Sức khoẻ", icon: "🏥" },
  { id: "retail", label: "Bán lẻ", icon: "🏪" },
  { id: "agency", label: "Agency / Tư vấn", icon: "🎯" },
  { id: "manufacturing", label: "Sản xuất", icon: "🏭" },
  { id: "other", label: "Khác", icon: "✨" },
];

const AI_TEAMS = [
  {
    id: "sales",
    label: "AI Sales Team",
    description: "Tìm kiếm lead, gửi email, theo dõi phản hồi tự động",
    icon: "⚡",
    agents: ["Lead Research Agent", "Outreach Agent", "Follow-up Agent", "CRM Agent"],
  },
  {
    id: "marketing",
    label: "AI Marketing Team",
    description: "Nghiên cứu thị trường, tạo content, đăng bài tự động",
    icon: "📣",
    agents: ["Research Agent", "Content Agent", "Image Agent", "Scheduler Agent"],
  },
  {
    id: "both",
    label: "Sales + Marketing",
    description: "Kết hợp cả hai team — tối đa hiệu quả tăng trưởng",
    icon: "🚀",
    agents: ["Toàn bộ Sales + Marketing Agents"],
  },
];

const STEPS = [
  { label: "Ngành nghề", icon: Building2 },
  { label: "Website", icon: Globe },
  { label: "AI Team", icon: Users },
  { label: "Hoàn tất", icon: Rocket },
];

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [aiTeam, setAiTeam] = useState("");

  const saveMutation = useMutation({
    mutationFn: (data: { step: number; industry?: string; website?: string; aiTeam?: string; completed?: boolean }) =>
      apiFetch("/api/onboarding/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/onboarding/step", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 4, industry, website, aiTeam, completed: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate("/dashboard");
    },
  });

  const goNext = () => {
    const nextStep = step + 1;
    saveMutation.mutate({ step: nextStep, industry, website, aiTeam });
    setStep(nextStep);
  };

  const canNext =
    (step === 0 && !!industry) ||
    (step === 1 && website.length > 3) ||
    (step === 2 && !!aiTeam);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-3">
            <span className="text-2xl">🤖</span>
          </div>
          <h1 className="text-xl font-bold text-white">Thiết lập AI Workforce</h1>
          <p className="text-slate-400 text-sm mt-1">Chỉ mất 2 phút để bắt đầu</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-1 rounded-full transition-all ${i <= step ? "bg-amber-500" : "bg-white/10"}`} />
              <span className={`text-xs ${i === step ? "text-amber-400" : i < step ? "text-emerald-400" : "text-slate-600"}`}>
                {i < step ? "✓" : s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-64">

          {/* Step 0: Industry */}
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Bạn hoạt động trong ngành nào?</h2>
              <p className="text-slate-400 text-sm mb-5">Giúp AI hiểu context kinh doanh của bạn tốt hơn</p>
              <div className="grid grid-cols-2 gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => setIndustry(ind.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                      industry === ind.id
                        ? "border-amber-500/60 bg-amber-500/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-lg">{ind.icon}</span>
                    <span className="text-sm font-medium">{ind.label}</span>
                    {industry === ind.id && <Check className="w-4 h-4 text-amber-400 ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Website */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Website công ty của bạn là gì?</h2>
              <p className="text-slate-400 text-sm mb-5">AI sẽ đọc website để hiểu sản phẩm/dịch vụ của bạn</p>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 text-sm"
              />
              <p className="text-xs text-slate-500 mt-2">Không bắt buộc có HTTPS — nhập domain là đủ</p>
            </div>
          )}

          {/* Step 2: AI Team */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-white mb-1">Bạn cần AI Team nào?</h2>
              <p className="text-slate-400 text-sm mb-5">Bạn có thể thay đổi sau trong phần Cài đặt</p>
              <div className="space-y-3">
                {AI_TEAMS.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setAiTeam(team.id)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      aiTeam === team.id
                        ? "border-amber-500/60 bg-amber-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl mt-0.5">{team.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{team.label}</p>
                        {aiTeam === team.id && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{team.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {team.agents.map((a) => (
                          <span key={a} className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Sẵn sàng khởi động!</h2>
              <p className="text-slate-400 text-sm mb-6">Workspace của bạn đã được cấu hình. Click bên dưới để vào Dashboard.</p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Ngành: <span className="text-white">{INDUSTRIES.find(i => i.id === industry)?.label ?? industry}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">Website: <span className="text-white">{website || "Chưa nhập"}</span></span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-300">AI Team: <span className="text-white">{AI_TEAMS.find(t => t.id === aiTeam)?.label ?? aiTeam}</span></span>
                </div>
              </div>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {completeMutation.isPending ? "Đang tạo workspace..." : "Vào Dashboard →"}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${
                step === 0 ? "text-slate-700 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              disabled={step === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Quay lại
            </button>
            <button
              onClick={goNext}
              disabled={!canNext || saveMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === 2 ? "Xem lại" : "Tiếp theo"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
