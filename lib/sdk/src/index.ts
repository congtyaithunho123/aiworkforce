/**
 * AI Workforce Cloud Runtime — TypeScript SDK v1.0.0
 *
 * Allows third-party developers to integrate with the AI Workforce platform:
 * Agent Bus, Global Registry, Capability Router, Shared Memory, Events, Monitoring, Federation.
 *
 * Usage:
 *   import { WorkforceSDK } from "@workspace/sdk";
 *   const sdk = new WorkforceSDK({ apiKey: "...", baseUrl: "https://..." });
 */

export interface WorkforceSDKConfig {
  /** API key (JWT access token from /api/auth/login, or federation API key) */
  apiKey: string;
  /** Base URL of the AI Workforce API server */
  baseUrl?: string;
}

// ─── Payload types ────────────────────────────────────────────────────────────

export type MessageType = "task" | "query" | "result" | "event" | "broadcast";
export type MemoryScope = "personal" | "team" | "department" | "organization";
export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface AgentMessage {
  id: number;
  fromAgentId: number | null;
  toAgentId: number | null;
  messageType: MessageType;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export interface RegistryAgent {
  id: number;
  name: string;
  version: string;
  capabilities: string[];
  description?: string;
  model: string;
  status: string;
  reputationScore: number;
  totalExecutions: number;
  successRate: number;
  qualityScore: number;
  humanFeedbackScore: number;
  tags: string[];
}

export interface RouteResult {
  routed: boolean;
  agent?: RegistryAgent;
  matchedCapabilities?: string[];
  score?: number;
  reason?: string;
  alternatives?: RegistryAgent[];
}

export interface MemoryEntry {
  id: number;
  scope: MemoryScope;
  key: string;
  value: unknown;
  contentType: string;
  expiresAt?: string;
  createdAt: string;
}

export interface WorkforceEvent {
  id: number;
  eventType: string;
  severity: EventSeverity;
  sourceType: string;
  sourceId?: number;
  payload: Record<string, unknown>;
  message?: string;
  createdAt: string;
}

export interface MonitoringSnapshot {
  timestamp: string;
  agents: {
    total: number;
    registered: number;
    active: number;
    avgReputation: number;
    avgSuccessRate: number;
    totalExecutions: number;
  };
  messages: {
    total: number;
    pending: number;
    done: number;
    failed: number;
    last24h: number;
    lastHour: number;
  };
  memory: { total: number; personal: number; team: number; department: number; organization: number };
  events: { total: number; last24h: number; lastHour: number; errors: number };
  workflows: { running: number; completed: number; failed: number; total: number };
  executions: { total: number; today: number; avgDurationMs: number; totalCostUsd: number };
}

// ─── Sub-clients ───────────────────────────────────────────────────────────────

class WorkforceBusClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Send a message from one agent to another via the communication bus */
  async send(opts: {
    fromAgentId?: number;
    toAgentId: number;
    messageType?: MessageType;
    payload?: Record<string, unknown>;
  }): Promise<{ message: AgentMessage }> {
    return this.http.post("/api/workforce/bus/send", opts);
  }

  /** List messages in the bus queue */
  async list(opts: { agentId?: number; status?: string; limit?: number } = {}): Promise<{ messages: AgentMessage[] }> {
    const params = new URLSearchParams();
    if (opts.agentId) params.set("agentId", String(opts.agentId));
    if (opts.status) params.set("status", opts.status);
    if (opts.limit) params.set("limit", String(opts.limit));
    return this.http.get(`/api/workforce/bus/messages?${params}`);
  }

  /** Update message status */
  async updateStatus(
    messageId: number,
    status: "pending" | "delivered" | "processing" | "done" | "failed",
  ): Promise<{ message: AgentMessage }> {
    return this.http.patch(`/api/workforce/bus/messages/${messageId}/status`, { status });
  }

  /** Get message bus statistics */
  async stats(): Promise<{ stats: Record<string, number> }> {
    return this.http.get("/api/workforce/bus/stats");
  }
}

class WorkforceRegistryClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Register a new agent into the Global Registry */
  async register(opts: {
    name: string;
    version?: string;
    capabilities?: string[];
    description?: string;
    model?: string;
    tags?: string[];
    endpoint?: string;
  }): Promise<{ agent: RegistryAgent }> {
    return this.http.post("/api/workforce/registry", opts);
  }

  /** Search agents by capability or keyword */
  async search(opts: {
    capability?: string;
    search?: string;
    status?: string;
  } = {}): Promise<{ agents: RegistryAgent[] }> {
    const params = new URLSearchParams();
    if (opts.capability) params.set("capability", opts.capability);
    if (opts.search) params.set("search", opts.search);
    if (opts.status) params.set("status", opts.status);
    return this.http.get(`/api/workforce/registry?${params}`);
  }

  /** Get agent by ID */
  async get(id: number): Promise<{ agent: RegistryAgent }> {
    return this.http.get(`/api/workforce/registry/${id}`);
  }

  /** Update agent reputation after execution */
  async updateReputation(
    id: number,
    opts: {
      success?: boolean;
      failed?: boolean;
      qualityScore?: number;
      humanFeedbackScore?: number;
    },
  ): Promise<{ agent: RegistryAgent }> {
    return this.http.patch(`/api/workforce/registry/${id}/reputation`, opts);
  }
}

class WorkforceRouterClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /**
   * Automatically route a task to the best matching agent based on capabilities.
   * @example
   *   await sdk.router.route("Find logistics leads in HCMC");
   *   // → { routed: true, agent: { name: "sdr-lead-hunter", ... } }
   */
  async route(
    task: string,
    context: Record<string, unknown> = {},
  ): Promise<RouteResult> {
    return this.http.post("/api/workforce/route", { task, context });
  }
}

class WorkforceMemoryClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Write to shared memory at any scope level */
  async write(
    scope: MemoryScope,
    key: string,
    value: unknown,
    opts: { scopeId?: number; contentType?: string; ttlSeconds?: number } = {},
  ): Promise<{ memory: MemoryEntry }> {
    return this.http.post("/api/workforce/memory", {
      scope, key, value, ...opts,
    });
  }

  /** Read from shared memory */
  async read(opts: { scope?: MemoryScope; key?: string } = {}): Promise<{ memories: MemoryEntry[] }> {
    const params = new URLSearchParams();
    if (opts.scope) params.set("scope", opts.scope);
    if (opts.key) params.set("key", opts.key);
    return this.http.get(`/api/workforce/memory?${params}`);
  }

  /** Delete a memory entry */
  async delete(id: number): Promise<{ ok: boolean }> {
    return this.http.delete(`/api/workforce/memory/${id}`);
  }
}

class WorkforceEventsClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Emit a workforce event */
  async emit(
    eventType: string,
    payload: Record<string, unknown> = {},
    opts: {
      severity?: EventSeverity;
      sourceType?: string;
      sourceId?: number;
      message?: string;
      correlationId?: string;
    } = {},
  ): Promise<{ event: WorkforceEvent }> {
    return this.http.post("/api/workforce/events", { eventType, payload, ...opts });
  }

  /** List workforce events */
  async list(opts: {
    eventType?: string;
    severity?: EventSeverity;
    limit?: number;
  } = {}): Promise<{ events: WorkforceEvent[] }> {
    const params = new URLSearchParams();
    if (opts.eventType) params.set("eventType", opts.eventType);
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.limit) params.set("limit", String(opts.limit));
    return this.http.get(`/api/workforce/events?${params}`);
  }

  /** Get event statistics */
  async stats(): Promise<{ stats: Record<string, number>; recentByType: Array<{ eventType: string; count: number }> }> {
    return this.http.get("/api/workforce/events/stats");
  }
}

class WorkforceMonitoringClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Get full monitoring snapshot */
  async snapshot(): Promise<{ snapshot: MonitoringSnapshot; recentEvents: WorkforceEvent[]; topAgents: RegistryAgent[] }> {
    return this.http.get("/api/workforce/monitoring");
  }

  /** Check system health */
  async health(): Promise<{ status: string; uptime: number; memoryMb: number }> {
    return this.http.get("/api/workforce/monitoring/health");
  }
}

class WorkforceGraphClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Get full Org → Dept → Team → Agent hierarchy */
  async getGraph(): Promise<{
    graph: {
      organization: { id: number; name: string };
      departments: Array<{
        id: number; name: string;
        agents: Array<{ id: number; name: string }>;
        teams: Array<{ id: number; name: string; agents: Array<{ id: number; name: string }> }>;
      }>;
      stats: { totalDepartments: number; totalTeams: number; totalAgents: number };
    };
  }> {
    return this.http.get("/api/workforce/graph");
  }

  /** Get all relationships for a specific agent */
  async getAgentGraph(agentId: number): Promise<{
    agent: { id: number; name: string };
    teams: Array<{ id: number; name: string }>;
    departments: Array<{ id: number; name: string }>;
  }> {
    return this.http.get(`/api/workforce/graph/agent/${agentId}`);
  }

  /** Create a team in a department */
  async createTeam(opts: {
    departmentId: number;
    name: string;
    description?: string;
    leadAgentId?: number;
  }): Promise<{ team: { id: number; name: string } }> {
    return this.http.post("/api/workforce/teams", opts);
  }
}

class WorkforceFederationClient {
  constructor(private readonly http: WorkforceHTTP) {}

  /** Request a federation link with another organization */
  async link(opts: {
    providerOrganizationId: number;
    sharedCapabilities?: string[];
    sharedAgentIds?: number[];
    sharedWorkflowIds?: number[];
  }): Promise<{ agreement: { id: number; status: string; apiKey: string } }> {
    return this.http.post("/api/workforce/federation/link", opts);
  }

  /** List all federation agreements */
  async list(): Promise<{ agreements: Array<{ id: number; status: string; isActive: boolean }> }> {
    return this.http.get("/api/workforce/federation");
  }

  /** Approve an incoming federation request */
  async approve(agreementId: number): Promise<{ agreement: { id: number; status: string } }> {
    return this.http.patch(`/api/workforce/federation/${agreementId}/approve`, {});
  }

  /** Revoke a federation agreement */
  async revoke(agreementId: number): Promise<{ agreement: { id: number; status: string } }> {
    return this.http.patch(`/api/workforce/federation/${agreementId}/revoke`, {});
  }

  /** Get shared agents & workflows from a federation link */
  async getShared(agreementId: number): Promise<{
    sharedAgents: Array<{ id: number; name: string }>;
    sharedWorkflows: Array<{ id: number; name: string }>;
  }> {
    return this.http.get(`/api/workforce/federation/${agreementId}/shared`);
  }
}

// ─── HTTP helper ───────────────────────────────────────────────────────────────

class WorkforceHTTP {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: WorkforceSDKConfig) {
    this.baseUrl = (config.baseUrl ?? "").replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(`[WorkforceSDK] ${method} ${path} → ${res.status}: ${JSON.stringify(err)}`);
    }
    return res.json() as Promise<T>;
  }

  get<T>(path: string): Promise<T> { return this.request<T>("GET", path); }
  post<T>(path: string, body: unknown): Promise<T> { return this.request<T>("POST", path, body); }
  patch<T>(path: string, body: unknown): Promise<T> { return this.request<T>("PATCH", path, body); }
  delete<T>(path: string): Promise<T> { return this.request<T>("DELETE", path); }
}

// ─── Main SDK class ────────────────────────────────────────────────────────────

/**
 * AI Workforce Cloud Runtime SDK
 *
 * @example
 * ```typescript
 * import { WorkforceSDK } from "@workspace/sdk";
 *
 * const sdk = new WorkforceSDK({
 *   apiKey: "your-jwt-token",
 *   baseUrl: "https://your-workforce.replit.app",
 * });
 *
 * // Register an agent
 * await sdk.registry.register({ name: "email-agent", capabilities: ["email", "copywriting"] });
 *
 * // Route a task automatically
 * const { agent } = await sdk.router.route("Write a follow-up email");
 *
 * // Send message via bus
 * await sdk.bus.send({ fromAgentId: 1, toAgentId: agent.id, messageType: "task", payload: { task: "..." } });
 *
 * // Write shared memory
 * await sdk.memory.write("organization", "icp", "logistics companies in HCMC");
 *
 * // Get monitoring snapshot
 * const { snapshot } = await sdk.monitoring.snapshot();
 * console.log(`Active agents: ${snapshot.agents.active}`);
 * ```
 */
export class WorkforceSDK {
  readonly bus: WorkforceBusClient;
  readonly registry: WorkforceRegistryClient;
  readonly router: WorkforceRouterClient;
  readonly memory: WorkforceMemoryClient;
  readonly events: WorkforceEventsClient;
  readonly monitoring: WorkforceMonitoringClient;
  readonly graph: WorkforceGraphClient;
  readonly federation: WorkforceFederationClient;

  constructor(config: WorkforceSDKConfig) {
    const http = new WorkforceHTTP(config);
    this.bus = new WorkforceBusClient(http);
    this.registry = new WorkforceRegistryClient(http);
    this.router = new WorkforceRouterClient(http);
    this.memory = new WorkforceMemoryClient(http);
    this.events = new WorkforceEventsClient(http);
    this.monitoring = new WorkforceMonitoringClient(http);
    this.graph = new WorkforceGraphClient(http);
    this.federation = new WorkforceFederationClient(http);
  }
}

export default WorkforceSDK;
