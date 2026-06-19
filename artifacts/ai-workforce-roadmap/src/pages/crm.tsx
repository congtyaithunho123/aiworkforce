import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, DollarSign, Calendar, ArrowRight, X, Briefcase } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  createdAt: string;
}

interface Deal {
  id: number;
  customerId: number;
  title: string;
  stage: string;
  value: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  customer?: Customer;
}

interface Pipeline {
  lead: Deal[];
  demo: Deal[];
  trial: Deal[];
  paid: Deal[];
}

const STAGES = [
  { key: "lead", label: "Lead", color: "border-slate-500", bg: "bg-slate-500/10", dot: "bg-slate-400" },
  { key: "demo", label: "Demo", color: "border-blue-500", bg: "bg-blue-500/10", dot: "bg-blue-400" },
  { key: "trial", label: "Trial", color: "border-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  { key: "paid", label: "Paid ✓", color: "border-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
];

function DealCard({ deal, onMoveStage }: { deal: Deal; onMoveStage: (id: number, stage: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const stageIndex = STAGES.findIndex((s) => s.key === deal.stage);
  const nextStage = STAGES[stageIndex + 1];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-zinc-900 border border-white/10 rounded-xl p-3 space-y-2 cursor-grab hover:border-white/20 transition-all ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-tight">{deal.title}</p>
        {deal.value > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-mono flex-shrink-0">
            <DollarSign className="w-3 h-3" />
            {deal.value.toLocaleString()}
          </span>
        )}
      </div>
      {deal.customer && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {deal.customer.name}
          {deal.customer.company && ` · ${deal.customer.company}`}
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(deal.createdAt).toLocaleDateString("vi-VN")}
        </p>
        {nextStage && (
          <button
            onClick={() => onMoveStage(deal.id, nextStage.key)}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {nextStage.label} <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Customer) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("website");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/crm/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || undefined, company: company || undefined, source }),
      }),
    onSuccess: (customer: Customer) => {
      toast({ title: "Đã thêm khách hàng!" });
      onCreated(customer);
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Thêm khách hàng mới</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tên *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@company.com" type="email"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Công ty</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Tên công ty"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Nguồn</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50">
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="demo">Demo</option>
              <option value="outbound">Outbound</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || mutation.isPending}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? "Đang lưu..." : "Thêm khách hàng"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Huỷ</button>
        </div>
      </motion.div>
    </div>
  );
}

function AddDealModal({ customers, onClose, onCreated }: { customers: Customer[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 0);
  const [value, setValue] = useState("");
  const [stage, setStage] = useState("lead");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, customerId: Number(customerId), value: Number(value) || 0, stage }),
      }),
    onSuccess: () => {
      toast({ title: "Đã thêm deal!" });
      onCreated();
    },
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Thêm deal mới</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Tiêu đề *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Enterprise Plan - Q3"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Khách hàng *</label>
            <select value={customerId} onChange={e => setCustomerId(Number(e.target.value))}
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50">
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Giá trị (USD/tháng)</label>
              <input value={value} onChange={e => setValue(e.target.value)} placeholder="0" type="number" min="0"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Stage</label>
              <select value={stage} onChange={e => setStage(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={!title || !customerId || mutation.isPending}
            className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? "Đang lưu..." : "Thêm deal"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">Huỷ</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function CRMPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);

  const { data: pipelineData, isLoading } = useQuery<{ pipeline: Pipeline; customers: Customer[] }>({
    queryKey: ["crm-pipeline"],
    queryFn: () => apiFetch("/api/crm/pipeline"),
    refetchInterval: 30000,
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      apiFetch(`/api/crm/deals/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-pipeline"] }),
    onError: (e: Error) => toast({ title: "Lỗi", description: e.message, variant: "destructive" }),
  });

  const pipeline = pipelineData?.pipeline ?? { lead: [], demo: [], trial: [], paid: [] };
  const customers = pipelineData?.customers ?? [];

  const totalDeals = Object.values(pipeline).flat().length;
  const totalValue = pipeline.paid.reduce((sum, d) => sum + d.value, 0);
  const pipelineValue = Object.values(pipeline).flat().reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="min-h-screen bg-black text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Briefcase className="w-6 h-6" /> CRM Pipeline
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Theo dõi pipeline sales từ Lead đến Paid</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCustomer(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Khách hàng
          </button>
          <button
            onClick={() => {
              if (customers.length === 0) {
                toast({ title: "Cần thêm khách hàng trước!", description: "Tạo khách hàng trước rồi mới thêm deal." });
                return;
              }
              setShowAddDeal(true);
            }}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Deal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng deals", value: totalDeals, icon: "📋" },
          { label: "Pipeline value", value: `$${pipelineValue.toLocaleString()}`, icon: "💰" },
          { label: "Đã chốt (MRR)", value: `$${totalValue.toLocaleString()}/tháng`, icon: "✅" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="text-xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="text-slate-500 text-sm animate-pulse py-20 text-center">Đang tải pipeline...</div>
      ) : (
        <div className="grid grid-cols-4 gap-4 min-h-[500px]">
          {STAGES.map((stage) => {
            const deals = pipeline[stage.key as keyof Pipeline] ?? [];
            return (
              <div key={stage.key} className={`rounded-2xl border ${stage.color} ${stage.bg} p-3 flex flex-col gap-3`}>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
                    <span className="text-sm font-semibold text-white">{stage.label}</span>
                  </div>
                  <span className="text-xs text-slate-500 bg-white/5 rounded-full px-2 py-0.5">{deals.length}</span>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <AnimatePresence>
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onMoveStage={(id, nextStage) => moveStageMutation.mutate({ id, stage: nextStage })}
                      />
                    ))}
                  </AnimatePresence>
                  {deals.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-slate-700 text-xs text-center py-8">
                      Chưa có deal
                    </div>
                  )}
                </div>

                {stage.key === "lead" && (
                  <button
                    onClick={() => {
                      if (customers.length === 0) {
                        toast({ title: "Cần thêm khách hàng trước!" });
                        return;
                      }
                      setShowAddDeal(true);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-600 hover:text-slate-400 border border-dashed border-white/10 hover:border-white/20 rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm deal
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
            setShowAddCustomer(false);
          }}
        />
      )}
      {showAddDeal && customers.length > 0 && (
        <AddDealModal
          customers={customers}
          onClose={() => setShowAddDeal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
            setShowAddDeal(false);
          }}
        />
      )}
    </div>
  );
}
