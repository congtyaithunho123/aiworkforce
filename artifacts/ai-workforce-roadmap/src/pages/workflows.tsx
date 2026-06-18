import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow, Play, Plus, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Loader2, Clock, Zap, DollarSign, BarChart3,
  ArrowRight, Bot, Layers, Eye, RefreshCw, GitMerge,
  Terminal, ChevronRight
} from "lucide-react";

import { apiFetch } from "@/lib/api";

type WorkflowItem = {
  id: number;
  organizationId: number;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type WorkflowStep = {
  id: number;
  workflowId: number;
  order: number;
  agentId: number;
  agentName?: string;
  agentRole?: string;
  name: string;
  instruction: string;
  createdAt: string;
};

type WorkflowDetail = WorkflowItem & { steps: WorkflowStep[] };

type StepLog = {
  id: number;
  stepName: string;
  agentName?: string;
  stepOrder: number;
  status: string;
  input: string;
  output?: string;
  errorMessage?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
};

type WorkflowRun = {
  id: number;
  workflowId: number;
  status: string;
  input: string;
  finalOutput?: string;
  errorMessage?: string;
  totalTokens: number;
  totalCost: number;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
  stepLogs: StepLog[];
};

type Agent = {
  id: number;
  name: string;
  role: string;
  organizationId: number;
};

type Organization = {
  id: number;
  name: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    running:   { color: "text-blue-400 bg-blue-500/10 border-blue-500/30",    label: "Đang chạy" },
    completed: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "Hoàn thành" },
    failed:    { color: "text-red-400 bg-red-500/10 border-red-500/30",       label: "Thất bại" },
    active:    { color: "text-amber-400 bg-amber-500/10 border-amber-500/30", label: "Hoạt động" },
    pending:   { color: "text-slate-400 bg-slate-500/10 border-slate-500/30", label: "Chờ" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      {status === "running" && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
      {cfg.label}
    </span>
  );
}

function fmtMs(ms?: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtCost(cost?: number | null) {
  if (!cost) return "$0.000";
  return `$${cost.toFixed(4)}`;
}

function StepTimeline({ steps, stepLogs }: { steps: WorkflowStep[]; stepLogs?: StepLog[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => {
        const log = stepLogs?.find(l => l.stepOrder === step.order);
        const dotColor = !log
          ? "bg-slate-700"
          : log.status === "completed"
          ? "bg-emerald-500"
          : log.status === "failed"
          ? "bg-red-500"
          : "bg-blue-500 animate-pulse";
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} title={step.name} />
            {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700" />}
          </div>
        );
      })}
    </div>
  );
}

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [expandedStepLog, setExpandedStepLog] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState({ name: "", description: "", organizationId: "" });
  const [stepForm, setStepForm] = useState({ agentId: "", name: "", instruction: "", order: "0" });
  const [runInput, setRunInput] = useState("");
  const [usePlanner, setUsePlanner] = useState(true);

  const { data: orgs = [] } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: () => apiFetch("/api/organizations"),
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => apiFetch("/api/agents"),
  });

  const { data: workflows = [], isLoading: loadingWorkflows } = useQuery<WorkflowItem[]>({
    queryKey: ["workflows"],
    queryFn: () => apiFetch("/api/workflows"),
  });

  const { data: executions = [], isLoading: loadingExecs } = useQuery<WorkflowRun[]>({
    queryKey: ["workflow-executions", selectedWorkflow?.id],
    queryFn: () => apiFetch(`/api/workflows/${selectedWorkflow!.id}/executions`),
    enabled: !!selectedWorkflow,
    refetchInterval: selectedRun?.status === "running" ? 2000 : false,
  });

  const createMutation = useMutation({
    mutationFn: (body: { organizationId: number; name: string; description?: string }) =>
      apiFetch<WorkflowItem>("/api/workflows", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflows"] });
      setShowCreate(false);
      setCreateForm({ name: "", description: "", organizationId: "" });
    },
  });

  const addStepMutation = useMutation({
    mutationFn: (body: { agentId: number; name: string; instruction: string; order: number }) =>
      apiFetch<WorkflowStep>(`/api/workflows/${selectedWorkflow!.id}/steps`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      const detail = await apiFetch<WorkflowDetail>(`/api/workflows/${selectedWorkflow!.id}`);
      setSelectedWorkflow(detail);
      setShowAddStep(false);
      setStepForm({ agentId: "", name: "", instruction: "", order: "0" });
    },
  });

  const runMutation = useMutation({
    mutationFn: (body: { input: string; usePlanner: boolean }) =>
      apiFetch<WorkflowRun & { plannerOutput?: unknown }>(`/api/workflows/${selectedWorkflow!.id}/run`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["workflow-executions", selectedWorkflow!.id] });
      setSelectedRun(data);
      setShowRun(false);
      setRunInput("");
    },
  });

  async function selectWorkflow(wf: WorkflowItem) {
    const detail = await apiFetch<WorkflowDetail>(`/api/workflows/${wf.id}`);
    setSelectedWorkflow(detail);
    setSelectedRun(null);
  }

  return (
    <div className="min-h-screen bg-black text-slate-300 font-sans">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitMerge className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-white">Multi-Agent Workflows</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo Workflow
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Workflow List */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Workflows</h2>
            <span className="ml-auto text-xs text-slate-600">{workflows.length}</span>
          </div>

          {loadingWorkflows ? (
            <div className="flex items-center justify-center py-12 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Đang tải...
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <Workflow className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Chưa có workflow nào</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-amber-500 text-sm hover:text-amber-400 transition-colors"
              >
                + Tạo workflow đầu tiên
              </button>
            </div>
          ) : (
            workflows.map((wf) => (
              <motion.button
                key={wf.id}
                onClick={() => selectWorkflow(wf)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedWorkflow?.id === wf.id
                    ? "bg-amber-500/10 border-amber-500/40 text-white"
                    : "bg-white/5 border-white/10 hover:border-amber-500/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-medium text-sm">{wf.name}</span>
                  <StatusBadge status={wf.status} />
                </div>
                {wf.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{wf.description}</p>
                )}
                <div className="mt-2 text-xs text-slate-600">
                  #{wf.id} · {new Date(wf.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </motion.button>
            ))
          )}
        </div>

        {/* Right: Workflow Detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedWorkflow ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-600">
              <Workflow className="w-12 h-12 mb-4 opacity-20" />
              <p>Chọn một workflow để xem chi tiết</p>
            </div>
          ) : (
            <>
              {/* Workflow Header */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">{selectedWorkflow.name}</h2>
                    {selectedWorkflow.description && (
                      <p className="text-slate-400 text-sm">{selectedWorkflow.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedWorkflow.status} />
                    <button
                      onClick={() => setShowRun(true)}
                      disabled={runMutation.isPending || selectedWorkflow.steps.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {runMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Chạy
                    </button>
                  </div>
                </div>

                {/* Steps Pipeline */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Pipeline ({selectedWorkflow.steps.length} bước)
                    </span>
                    <button
                      onClick={() => setShowAddStep(true)}
                      className="ml-auto flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Thêm bước
                    </button>
                  </div>

                  {selectedWorkflow.steps.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-slate-600 text-sm">
                      Chưa có bước nào. Thêm agents để tạo pipeline.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center">
                      {selectedWorkflow.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-2">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                            <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                              <span className="text-amber-500 text-xs font-bold">{step.order + 1}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white leading-tight">{step.name}</div>
                              <div className="text-xs text-slate-500">{step.agentName ?? `Agent #${step.agentId}`}</div>
                            </div>
                          </div>
                          {i < selectedWorkflow.steps.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-slate-700 shrink-0" />
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-slate-700 shrink-0" />
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <Bot className="w-4 h-4 text-purple-400" />
                          <div>
                            <div className="text-sm font-medium text-purple-300">Reviewer</div>
                            <div className="text-xs text-slate-500">Auto</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Execution History */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    Lịch sử thực thi
                  </h3>
                  <button
                    onClick={() => qc.invalidateQueries({ queryKey: ["workflow-executions", selectedWorkflow.id] })}
                    className="ml-auto text-slate-600 hover:text-slate-400 transition-colors"
                    title="Làm mới"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {loadingExecs ? (
                  <div className="flex items-center justify-center py-8 text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Đang tải...
                  </div>
                ) : executions.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    Chưa có lần thực thi nào. Nhấn "Chạy" để bắt đầu.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {executions.map((run) => (
                      <ExecutionCard
                        key={run.id}
                        run={run}
                        steps={selectedWorkflow.steps}
                        isSelected={selectedRun?.id === run.id}
                        onSelect={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}
                        expandedStepLog={expandedStepLog}
                        onToggleStepLog={(id) => setExpandedStepLog(expandedStepLog === id ? null : id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Workflow Modal */}
      <AnimatePresence>
        {showCreate && (
          <Modal title="Tạo Workflow mới" onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Tổ chức *</label>
                <select
                  value={createForm.organizationId}
                  onChange={(e) => setCreateForm(f => ({ ...f, organizationId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Chọn tổ chức...</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Tên workflow *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Sales + Marketing Pipeline"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Mô tả</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mô tả mục đích workflow này..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              {createMutation.isError && (
                <p className="text-red-400 text-xs">{(createMutation.error as Error).message}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (!createForm.name || !createForm.organizationId) return;
                    createMutation.mutate({
                      organizationId: parseInt(createForm.organizationId, 10),
                      name: createForm.name,
                      description: createForm.description || undefined,
                    });
                  }}
                  disabled={createMutation.isPending || !createForm.name || !createForm.organizationId}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Tạo"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Add Step Modal */}
      <AnimatePresence>
        {showAddStep && selectedWorkflow && (
          <Modal title={`Thêm bước — ${selectedWorkflow.name}`} onClose={() => setShowAddStep(false)}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Agent *</label>
                <select
                  value={stepForm.agentId}
                  onChange={(e) => {
                    const agent = agents.find(a => a.id === parseInt(e.target.value, 10));
                    setStepForm(f => ({ ...f, agentId: e.target.value, name: agent?.role ?? f.name }));
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Chọn agent...</option>
                  {agents
                    .filter(a => a.organizationId === selectedWorkflow.organizationId)
                    .map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Tên bước *</label>
                <input
                  value={stepForm.name}
                  onChange={(e) => setStepForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Sales Analysis"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Instruction *</label>
                <textarea
                  value={stepForm.instruction}
                  onChange={(e) => setStepForm(f => ({ ...f, instruction: e.target.value }))}
                  placeholder="Mô tả chi tiết nhiệm vụ agent cần thực hiện trong bước này..."
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Thứ tự</label>
                <input
                  type="number"
                  value={stepForm.order}
                  onChange={(e) => setStepForm(f => ({ ...f, order: e.target.value }))}
                  min="0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
              {addStepMutation.isError && (
                <p className="text-red-400 text-xs">{(addStepMutation.error as Error).message}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddStep(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (!stepForm.agentId || !stepForm.name || !stepForm.instruction) return;
                    addStepMutation.mutate({
                      agentId: parseInt(stepForm.agentId, 10),
                      name: stepForm.name,
                      instruction: stepForm.instruction,
                      order: parseInt(stepForm.order, 10),
                    });
                  }}
                  disabled={addStepMutation.isPending || !stepForm.agentId || !stepForm.name || !stepForm.instruction}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                >
                  {addStepMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Thêm"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Run Workflow Modal */}
      <AnimatePresence>
        {showRun && selectedWorkflow && (
          <Modal title={`Chạy — ${selectedWorkflow.name}`} onClose={() => setShowRun(false)}>
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    Pipeline sẽ chạy tuần tự qua {selectedWorkflow.steps.length} bước → Reviewer Agent tự động tổng hợp.
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Yêu cầu *</label>
                <textarea
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  placeholder="Nhập yêu cầu cụ thể bạn muốn đội agent xử lý..."
                  rows={5}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setUsePlanner(!usePlanner)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${usePlanner ? "bg-amber-500" : "bg-white/10"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${usePlanner ? "left-5" : "left-0.5"}`} />
                </div>
                <span className="text-sm text-slate-300">Sử dụng Planner Agent phân tích trước</span>
              </label>

              {runMutation.isError && (
                <p className="text-red-400 text-xs">{(runMutation.error as Error).message}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowRun(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-slate-400 text-sm hover:border-white/20 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => runInput && runMutation.mutate({ input: runInput, usePlanner })}
                  disabled={runMutation.isPending || !runInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                >
                  {runMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang chạy...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Chạy ngay
                    </>
                  )}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExecutionCard({
  run,
  steps,
  isSelected,
  onSelect,
  expandedStepLog,
  onToggleStepLog,
}: {
  run: WorkflowRun;
  steps: WorkflowStep[];
  isSelected: boolean;
  onSelect: () => void;
  expandedStepLog: number | null;
  onToggleStepLog: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        isSelected ? "border-amber-500/40 bg-amber-500/5" : "border-white/10 bg-white/5"
      }`}
    >
      <button onClick={onSelect} className="w-full text-left p-4">
        <div className="flex items-start gap-4">
          <div className="mt-0.5">
            {run.status === "completed" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : run.status === "failed" ? (
              <XCircle className="w-5 h-5 text-red-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-white">Run #{run.id}</span>
              <StatusBadge status={run.status} />
              <span className="ml-auto text-xs text-slate-600">
                {new Date(run.startedAt).toLocaleString("vi-VN")}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mb-2">{run.input}</p>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtMs(run.durationMs)}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {run.totalTokens.toLocaleString()} tokens
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {fmtCost(run.totalCost)}
              </span>
            </div>
            <div className="mt-2">
              <StepTimeline steps={steps} stepLogs={run.stepLogs} />
            </div>
          </div>
          <div className="shrink-0">
            {isSelected ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">
              {/* Step Logs */}
              {run.stepLogs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chi tiết từng bước</span>
                  </div>
                  <div className="space-y-2">
                    {run.stepLogs.map((log) => (
                      <StepLogCard
                        key={log.id}
                        log={log}
                        isExpanded={expandedStepLog === log.id}
                        onToggle={() => onToggleStepLog(log.id)}
                      />
                    ))}
                    {/* Reviewer step */}
                    {run.finalOutput && (
                      <ReviewerResultCard
                        output={run.finalOutput}
                        isExpanded={expandedStepLog === -1}
                        onToggle={() => onToggleStepLog(-1)}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {run.errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <strong>Lỗi:</strong> {run.errorMessage}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StepLogCard({
  log,
  isExpanded,
  onToggle,
}: {
  log: StepLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30">
      <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0">
          <span className="text-xs text-slate-500">{log.stepOrder + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{log.stepName}</span>
            <StatusBadge status={log.status} />
          </div>
          <div className="text-xs text-slate-600">
            {log.agentName ?? `Agent #${log.agentId}`} · {fmtMs(log.durationMs)} · {log.totalTokens} tokens · {fmtCost(log.estimatedCost)}
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-white/5 pt-3 space-y-2">
              <LogSection label="Input" content={log.input} />
              {log.output && <LogSection label="Output" content={log.output} highlight />}
              {log.errorMessage && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {log.errorMessage}
                </div>
              )}
              <div className="flex gap-4 text-xs text-slate-600 pt-1">
                <span>Prompt: {log.promptTokens}</span>
                <span>Completion: {log.completionTokens}</span>
                <span>Total: {log.totalTokens}</span>
                <span>Cost: {fmtCost(log.estimatedCost)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReviewerResultCard({
  output,
  isExpanded,
  onToggle,
}: {
  output: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5">
      <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-center gap-3">
        <Bot className="w-4 h-4 text-purple-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-purple-300">Reviewer Agent — Báo cáo cuối</span>
            <span className="px-2 py-0.5 rounded-full border border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs">Auto</span>
          </div>
        </div>
        <Eye className="w-3.5 h-3.5 text-slate-600 shrink-0" />
        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-purple-500/10 pt-3">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
                {output}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LogSection({ label, content, highlight }: { label: string; content: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-600 font-medium mb-1">{label}</div>
      <pre className={`text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto p-2 rounded bg-black/30 ${highlight ? "text-emerald-300" : "text-slate-400"}`}>
        {content}
      </pre>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <h3 className="text-lg font-bold text-white mb-5">{title}</h3>
        {children}
      </motion.div>
    </motion.div>
  );
}
