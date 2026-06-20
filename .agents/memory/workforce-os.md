---
name: AI Workforce Operating System
description: Full OS layer for AI agents — kernel, scheduler, resources, policies, governance, deployments, CLI
---

# AI Workforce OS

## DB Tables (10)
- `kernel_agents` — state machine: CREATED/READY/RUNNING/PAUSED/FAILED/TERMINATED, workerNode, priority, retryCount
- `kernel_workflows` — scheduleType: immediate/cron/event, cronExpression, eventTrigger, runCount/successCount/failureCount
- `kernel_tasks` — queued→running→completed/failed, durationMs, priority
- `resource_quotas` — per-agent limits: cpuLimitMs/ramLimitMb/tokenLimit/costLimitUsd + current tracking
- `resource_usage` — time-series snapshots: cpuMs/ramMb/tokensUsed/costUsd per agent per operation
- `os_policies` — effect: allow/deny, role, resources[], actions[], conditions{}, priority, isActive
- `sandbox_sessions` — allowedTools[], allowedResources[], networkAccess, memoryNamespace, status
- `os_audit_logs` — actor/actorType/action/resource/resourceId/severity/before/after
- `os_approvals` — title/requestType/requestedBy/approvedBy/status/priority/expiresAt
- `os_deployments` — target: local/docker/vps/kubernetes, replicas, deployLog[], isHealthy

## Route Files
- `os-kernel.ts` — /api/os/kernel/agents CRUD + PATCH /:id/status, /api/os/scheduler/status + dispatch, /api/os/workflows CRUD + /:id/run, /api/os/tasks CRUD + /:id
- `os-resources.ts` — /api/os/resources/quotas CRUD, /api/os/resources/usage GET+POST, /api/os/resources/snapshot
- `os-policy.ts` — /api/os/policies CRUD + seed + evaluate, /api/os/sandbox list + launch + /:id/terminate
- `os-governance.ts` — /api/os/governance/audit GET+POST, /api/os/governance/approvals CRUD + PATCH, /api/os/deployments GET+POST + /:id/rollback, /api/os/control-plane (summary)

## Frontend
Page: `/os` — OsTab type: control-plane/kernel/scheduler/workflows/resources/sandbox/policies/governance/deployments/cli
Nav entry: "Workforce OS" with Cpu icon

## CLI
File: `./wf` (Node.js executable) at workspace root
Set WF_TOKEN env var for auth, WF_API_URL for custom endpoint (default localhost:8080)

**Why:** Agents need OS-level abstractions (lifecycle, resource isolation, policy) to be trustworthy in production.
**How to apply:** All OS tables use organizationId for tenant isolation. auditLog() helper in os-kernel.ts writes to os_audit_logs on every state change.
