---
name: Auth + Multi-tenant Foundation
description: JWT auth system and multi-tenant row-level isolation across all routes
---

## Auth Architecture

**Approach**: JWT (access token, 15m) + refresh token (UUID, 7 days, stored in DB as `refresh_tokens`)

**JWT Secret**: Must be set as `JWT_SECRET` env var. Throws on startup if missing.

**Packages**: `bcryptjs` + `jsonwebtoken` in `@workspace/api-server`

**Why not sessions**: Stateless JWTs make horizontal scaling simpler; refresh tokens give revocation capability.

**Middleware location**: `artifacts/api-server/src/middleware/authenticate.ts`
- Applied globally in `routes/index.ts` AFTER `healthRouter` and `authRouter`
- `/api/healthz` (health) and `/api/auth/*` are public

**Express type augmentation**: `artifacts/api-server/src/types/express.d.ts`
- Uses `declare global { namespace Express { interface Request { user? } } }`
- NOT `import "express"` + module augmentation — that form doesn't work with this tsconfig

## DB Tables Added

- `users`: organizationId FK, email unique, passwordHash, role (owner/admin/member)
- `refresh_tokens`: userId FK, token (unique), expiresAt, revokedAt
- `password_reset_tokens`: userId FK, token (unique), expiresAt, usedAt

## Tenant Isolation

- `sales_companies` and `marketing_projects` both got `organizationId` column added
- All routes now use `req.user!.organizationId` — no query param orgId accepted
- Registration flow: creates org first, then user with role=owner

## Frontend Auth

- `artifacts/ai-workforce-roadmap/src/lib/auth-client.ts` — fetch wrapper with auto-refresh
- `artifacts/ai-workforce-roadmap/src/context/AuthContext.tsx` — React context with login/register/logout
- `artifacts/ai-workforce-roadmap/src/components/ProtectedRoute.tsx` — uses useEffect+setLocation (NOT render-time setLocation, which causes React setState-in-render error)
- Login/register/forgot-password pages in `src/pages/`
- Tokens stored in localStorage

## How to Apply

- Any new route added must access `req.user!.organizationId` for tenant isolation
- Public routes (no auth needed) must be mounted BEFORE `router.use(authenticate)` in `routes/index.ts`
- The forgot-password flow returns `debug_token` in non-production for ease of testing (no email setup)
