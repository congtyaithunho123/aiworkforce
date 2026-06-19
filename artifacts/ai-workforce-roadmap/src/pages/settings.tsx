import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Settings, Key, Plus, Trash2, Eye, EyeOff, CheckCircle2, Shield } from "lucide-react";
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
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("Default");
  const [showKey, setShowKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"api-keys" | "audit">("api-keys");

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

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
          <Settings className="w-6 h-6" /> Cài đặt
        </h1>
        <p className="text-slate-400 mt-1 text-sm">Quản lý API keys và nhật ký hệ thống</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {(["api-keys", "audit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab === "api-keys" ? "API Keys" : "Audit Log"}
          </button>
        ))}
      </div>

      {/* API Keys tab */}
      {activeTab === "api-keys" && (
        <div className="space-y-4">
          {/* Info box */}
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

      {/* Audit Log tab */}
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
