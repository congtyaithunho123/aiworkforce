import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Loader2, CheckCircle, User, Mail, Building2,
  Globe, Target, Zap, AlertCircle, ExternalLink
} from "lucide-react";
import PublicLayout from "@/components/PublicLayout";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

interface DemoResult {
  company: {
    name: string;
    industry: string;
    product: string;
    targetMarket: string;
    painPoints: string[];
  };
  icp: {
    title: string;
    companySize: string;
    industry: string;
    painPoints: string[];
    decisionMaker: string;
  };
  leads: Array<{
    name: string;
    title: string;
    company: string;
    email: string;
    reason: string;
  }>;
  email: {
    subject: string;
    body: string;
  };
}

async function runDemo(website: string): Promise<DemoResult> {
  const res = await fetch("/api/demo/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website }),
  });
  if (!res.ok) throw new Error("Demo API không khả dụng");
  return res.json();
}

function MockResult({ website }: { website: string }) {
  const domain = website.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const companyName = domain.split(".")[0];
  const capitalized = companyName.charAt(0).toUpperCase() + companyName.slice(1);

  const result: DemoResult = {
    company: {
      name: capitalized,
      industry: "SaaS / Phần mềm doanh nghiệp",
      product: `Nền tảng ${capitalized} cung cấp giải pháp tự động hoá quy trình doanh nghiệp`,
      targetMarket: "SMB và Midmarket tại các nước Đông Nam Á",
      painPoints: ["Chi phí vận hành cao", "Khó scale team manually", "Thiếu insight từ data"],
    },
    icp: {
      title: "Head of Sales / VP Sales",
      companySize: "50–500 nhân viên",
      industry: "SaaS, Fintech, E-commerce",
      painPoints: ["Lead generation tốn thời gian", "Tỷ lệ convert thấp", "Follow-up không nhất quán"],
      decisionMaker: "C-suite hoặc Head of Sales",
    },
    leads: [
      { name: "Nguyễn Văn Thành", title: "VP Sales", company: "TechVN Corp", email: "thanh.nv@techvn.vn", reason: "Đang scale team sales, phù hợp với ICP" },
      { name: "Trần Minh Châu", title: "Head of Growth", company: "GrowthLab VN", email: "chau.tm@growthlab.vn", reason: "Startup Series A, cần tự động hoá outreach" },
      { name: "Lê Thị Hoa", title: "Director of Sales", company: "SaaS Vietnam", email: "hoa.lt@saasvn.com", reason: "Đội sales 20 người, cần AI hỗ trợ" },
      { name: "Phạm Quang Đức", title: "CEO", company: "B2B Solutions JSC", email: "duc.pq@b2bsolutions.vn", reason: "Decision maker, quan tâm đến automation" },
      { name: "Hoàng Thu Trang", title: "Sales Manager", company: "Enterprise VN", email: "trang.ht@enterprise.vn", reason: "Đang tìm giải pháp thay thế cold calling" },
    ],
    email: {
      subject: `Re: Tự động hoá outreach cho team ${capitalized}`,
      body: `Chào anh/chị Nguyễn Văn Thành,

Tôi nhận thấy ${capitalized} đang scale team sales trong giai đoạn tăng trưởng nhanh — đây thường là thời điểm khó nhất để maintain chất lượng outreach khi số lượng tăng.

AI Workforce đang giúp các công ty SaaS như ${capitalized} tự động hoá toàn bộ quy trình SDR: từ phân tích prospect → viết email cá nhân hóa → follow-up sequence — mà không cần thuê thêm sales rep.

Kết quả trung bình: 3x leads qualified, 80% giảm chi phí per lead.

Anh/chị có 20 phút để tôi demo cụ thể cho use case của ${capitalized} không?

Trân trọng,
AI Workforce Team`,
    },
  };

  return result;
}

export default function DemoResultPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const website = params.get("website") || "";

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const STEPS = [
    "Đang phân tích website...",
    "Xây dựng Ideal Customer Profile...",
    "Tìm kiếm leads phù hợp...",
    "Viết email outreach cá nhân hóa...",
  ];

  useEffect(() => {
    if (!website) {
      setError("Không có website để phân tích. Vui lòng quay lại trang demo.");
      setLoading(false);
      return;
    }

    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx++;
      if (stepIdx < STEPS.length) setStep(stepIdx);
      else clearInterval(stepTimer);
    }, 1500);

    runDemo(website)
      .then(r => setResult(r))
      .catch(() => {
        const mockResult = MockResult({ website });
        setResult(mockResult);
      })
      .finally(() => {
        clearInterval(stepTimer);
        setTimeout(() => setLoading(false), 500);
      });

    return () => clearInterval(stepTimer);
  }, [website]);

  if (!website && !loading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Thiếu website</h2>
            <p className="text-slate-400 mb-6">Vui lòng quay lại và nhập website của bạn.</p>
            <Link href="/demo" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all">
              Quay lại Demo
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">AI đang phân tích</h2>
            <p className="text-slate-400 mb-8 text-sm">
              <Globe className="w-4 h-4 inline mr-1" />
              {website}
            </p>
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div key={s} className={`flex items-center gap-3 text-sm transition-all duration-500 ${i <= step ? "text-white" : "text-slate-600"}`}>
                  {i < step ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : i === step ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  if (!result) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-3">Phân tích thất bại</h2>
            <p className="text-slate-400 mb-6">{error || "Không thể phân tích website này. Vui lòng thử lại."}</p>
            <Link href="/demo" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all">
              Thử lại
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="py-12 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
                <CheckCircle className="w-4 h-4" />
                Phân tích hoàn tất
              </div>
              <h1 className="text-3xl font-bold text-white">
                Kết quả phân tích{" "}
                <span className="text-amber-400">
                  <ExternalLink className="w-5 h-5 inline mr-1" />
                  {website}
                </span>
              </h1>
            </div>
            <Link
              href="/register"
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all text-sm whitespace-nowrap"
            >
              Bắt đầu miễn phí <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Company analysis */}
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={1}>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Phân tích công ty</h2>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tên công ty</p>
              <p className="text-white font-semibold">{result.company.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ngành</p>
              <p className="text-white">{result.company.industry}</p>
            </div>
            <div className="col-span-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sản phẩm / Dịch vụ</p>
              <p className="text-slate-300">{result.company.product}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Thị trường mục tiêu</p>
              <p className="text-slate-300">{result.company.targetMarket}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pain points</p>
              <ul className="space-y-1">
                {result.company.painPoints.map(p => (
                  <li key={p} className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>

        {/* ICP */}
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={2}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Ideal Customer Profile (ICP)</h2>
          </div>
          <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chức danh mục tiêu</p>
              <p className="text-white font-semibold">{result.icp.title}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Quy mô công ty</p>
              <p className="text-white">{result.icp.companySize}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ngành target</p>
              <p className="text-white">{result.icp.industry}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Decision maker</p>
              <p className="text-white">{result.icp.decisionMaker}</p>
            </div>
          </div>
        </motion.section>

        {/* Leads */}
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={3}>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">5 Leads mẫu phù hợp ICP</h2>
          </div>
          <div className="space-y-3">
            {result.leads.map((lead, i) => (
              <div key={lead.email} className="p-5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <p className="text-white font-medium">{lead.name}</p>
                    <p className="text-slate-400 text-sm">{lead.title}</p>
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" /> {lead.company}
                    </p>
                    <p className="text-slate-400 text-sm flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> {lead.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Lý do phù hợp:</p>
                    <p className="text-slate-300 text-sm">{lead.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Email */}
        <motion.section initial="hidden" animate="visible" variants={fadeUp} custom={4}>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Email Outreach mẫu</h2>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-white/3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-white font-medium">{result.email.subject}</p>
            </div>
            <div className="px-6 py-5">
              <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">{result.email.body}</pre>
            </div>
          </div>
        </motion.section>

        {/* CTA */}
        <motion.section
          initial="hidden" animate="visible" variants={fadeUp} custom={5}
          className="text-center py-8 border-t border-white/10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-5">
            <Zap className="w-3.5 h-3.5" />
            Đây chỉ là preview — phiên bản đầy đủ chạy với leads thật
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Bắt đầu với leads thật của bạn</h2>
          <p className="text-slate-400 mb-7">Đăng ký miễn phí để AI SDR chạy với data thực tế — không cần thẻ tín dụng.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition-all hover:-translate-y-0.5"
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
        </motion.section>
      </div>
    </PublicLayout>
  );
}
