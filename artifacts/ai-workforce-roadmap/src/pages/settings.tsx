import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Settings, Key, Plus, Trash2, Eye, EyeOff, CheckCircle2, Shield, Gift, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ProviderKey {
  id: number;
  provider: string;
  label: string;
  keyPreview: string;
  isActive: boolean;
  createdAt: string;
}

interface AuditLog {
  id: number;
  actorType: string;
  action: string;
  resource: string | null;
  resourceId?: number;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ReferralStats {
  code: string | null;
  referralLink: string | null;
  referredCount: number;
  trialDaysAdded: number;
  createdAt?: string;
}

type Tab = "api-keys" | "referral" | "audit";

function ReferralTab() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch } = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: () => apiFetch("/api/referral/stats"),
  });

  const generateMutation = useMutation({
    mutationFn: () => apiFetch("/api/referral/my-code"),
    onSuccess: () => refetch(),
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const handleCopy = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Đã copy link!" });
    });
  };

  if (isLoading) {
    return <div className="text-slate-500 text-sm animate-pulse py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/70">
        <p className="font-medium text-amber-400 mb-1">🎁 Chương trình Referral</p>
        Mỗi người bạn invite thành công đăng ký sẽ giúp cả 2 nhận thêm{" "}
        <span className="text-amber-400 font-semibold">+7 ngày trial</span>. Không giới hạn số lần!
      </div>

      {data?.code ? (
        <>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Link mời của bạn</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-amber-400 break-all">
                {data.referralLink}
              </div>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl transition-colors text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Đã copy" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Code: <span className="font-mono text-slate-300">{data.code}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-white">{data.referredCount}</div>
              <div className="text-xs text-slate-500 mt-1">Người đã invite thành công</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-400">+{data.trialDaysAdded}</div>
              <div className="text-xs text-slate-500 mt-1">Ngày trial bạn đã nhận</div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">Cách thức hoạt động</p>
            <div className="space-y-2">
              {[
                { step: "1", text: "Chia sẻ link mời của bạn với bạn bè / đồng nghiệp" },
                { step: "2", text: "Họ đăng ký qua link → nhận ngay 7 ngày trial bonus" },
                { step: "3", text: "Bạn cũng nhận +7 ngày trial. Win-win!" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                    {step}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-4">
          <Gift className="w-10 h-10 text-amber-400/40 mx-auto" />
          <div>
            <p className="text-slate-300 font-medium">Tạo link mời của bạn</p>
            <p className="text-slate-500 text-sm mt-1">Bắt đầu invite và nhận thêm ngày trial miễn phí</p>
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl disabled:opacity-40 transition-colors"
          >
            {generateMutation.isPending ? "Đang tạo..." : "Tạo link mời"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("Default");
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("api-keys");

  const { data: keys = [], isLoading } = useQuery<ProviderKey[]>({
    queryKey: ["provider-keys"],
    queryFn: () => apiFetch("/api/provider-keys"),
  });

  const { data: audit } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs"],
    queryFn: () => apiFetch("/api/audit-logs?limit=50"),
    enabled: activeTab === "audit",
  });

  const createMutation = useMutation({
    mutationFn: () => apiFetch("/api/provider-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai", label, apiKey }),
    }),
    onSuccess: () => {
      toast({ title: "API Key đã được lưu!" });
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
      setShowForm(false);
      setApiKey("");
      setLabel("Default");
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/provider-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Đã xoá API Key" });
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
    },
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: "api-keys", label: "API Keys" },
    { key: "referral", label: "🎁 Referral" },
    { key: "audit", label: "Audit Log" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Settings className="w-6 h-6" /> Cài đặt
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Quản lý API keys, referral và nhật ký hệ thống</p>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "api-keys" && (
        <div className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200/70">
            <p className="font-medium text-amber-400 mb-1">Cách hoạt động</p>
            Nếu bạn nhập API Key riêng, hệ thống sẽ dùng key đó cho tất cả AI agents trong tổ chức của bạn.
            Nếu không, hệ thống sẽ dùng API Key mặc định (có giới hạn theo gói).
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" /> OpenAI API Keys
            </h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm Key
            </button>
          </div>

          {showForm && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tên gợi nhớ</label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="Ví dụ: Production Key"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">OpenAI API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!apiKey || createMutation.isPending}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                >
                  {createMutation.isPending ? "Đang lưu..." : "Lưu"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
                  Huỷ
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-slate-500 text-sm animate-pulse">Đang tải...</div>
          ) : keys.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Chưa có API Key nào. Hệ thống đang dùng key mặc định.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${key.isActive ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{key.label}</p>
                      <p className="text-xs text-slate-500 font-mono">{key.keyPreview}</p>
                    </div>
                    {key.isActive && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{new Date(key.createdAt).toLocaleDateString("vi-VN")}</span>
                    <button
                      onClick={() => deleteMutation.mutate(key.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "referral" && <ReferralTab />}

      {activeTab === "audit" && (
        <div className="space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" /> Audit Log — 50 hành động gần nhất
          </h2>
          {!audit ? (
            <div className="text-slate-500 text-sm animate-pulse">Đang tải...</div>
          ) : audit.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Chưa có hành động nào được ghi lại.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {audit.map((log) => (
                <div key={log.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    log.actorType === "user" ? "bg-blue-400" :
                    log.actorType === "agent" ? "bg-amber-400" : "bg-slate-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-amber-400">{log.action}</span>
                      {log.resource && (
                        <span className="text-xs text-slate-500">→ {log.resource} #{log.resourceId}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(log.createdAt).toLocaleString("vi-VN")}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
