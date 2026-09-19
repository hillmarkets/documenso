# Instance- and Organisation-Scoped API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `INSTANCE` and `ORGANISATION` scoped API tokens and webhooks to Documenso so a backend can manage organisations, act inside any team via `x-team-id` / `x-organisation-id` headers, and receive webhooks org-wide or instance-wide.

**Architecture:** `ApiToken` and `Webhook` gain a `scope` column and nullable `teamId` / `organisationId`. Headers are parsed in exactly one place (`resolveApiTokenScope`) and turned into a typed `ctx.scope`; the existing ~80 team-scoped procedures keep reading `ctx.teamId`. A single `enforceApiTokenScope` middleware reads raw input and rejects cross-tenant references. Webhook delivery becomes a pure tenant query (team OR org OR instance) with no user-membership filter. Upstream's commented-out OpenAPI meta on organisation/team routes is re-enabled; a curated set of admin routes gets new meta.

**Tech Stack:** TypeScript, tRPC 11 + `trpc-to-openapi`, Prisma/Postgres, Hono, Remix (React Router 7), vitest (`packages/lib`), Playwright (`packages/app-tests`), Biome.

**Spec:** `docs/superpowers/specs/2026-09-18-instance-and-org-scoped-api-design.md`

**Deviation from spec (simplification):** the spec said `organisation.create` would accept `ownerUserId` for INSTANCE tokens. `admin.organisation.create` already takes `ownerUserId` and returns `organisationId`, so INSTANCE callers use that route (exposed at `POST /admin/organisation/create`) and `organisation.create` is left untouched.

---

## File structure

**Create**
- `packages/prisma/migrations/<ts>_add_api_token_and_webhook_scope/migration.sql` — enums, columns, nullable FKs, check constraints
- `packages/lib/server-only/public-api/resolve-api-token-scope.ts` — header parsing + acting-user resolution (the *only* header reader)
- `packages/lib/server-only/public-api/resolve-api-token-scope.test.ts`
- `packages/lib/server-only/public-api/require-team-scoped-token.ts` — narrows a token to TEAM scope or throws 403 (v1, zapier, embedding)
- `packages/lib/server-only/webhooks/build-webhook-delivery-where.ts` — pure Prisma where builder for delivery
- `packages/lib/server-only/webhooks/build-webhook-delivery-where.test.ts`
- `packages/lib/server-only/webhooks/organisation/{create,find,get,edit,delete}-organisation-webhook.ts`
- `packages/lib/server-only/webhooks/instance/{create,find,get,edit,delete}-instance-webhook.ts`
- `packages/lib/server-only/public-api/organisation/{create,get,delete}-organisation-api-token(s).ts`
- `packages/lib/server-only/public-api/instance/{create,get,delete}-instance-api-token(s).ts`
- `packages/trpc/server/api-token-router/organisation/*.ts` and `instance/*.ts` (+ `.types.ts`)
- `packages/trpc/server/webhook-router/organisation/*.ts` and `instance/*.ts` (+ `.types.ts`)
- `packages/trpc/server/scope-guard.ts` — `enforceApiTokenScope` middleware
- `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.tokens.tsx`
- `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.webhooks._index.tsx`
- `apps/remix/app/routes/_authenticated+/admin+/tokens.tsx`
- `apps/remix/app/routes/_authenticated+/admin+/webhooks.tsx`
- `packages/app-tests/e2e/api/v2/scoped-tokens.spec.ts`
- `packages/app-tests/e2e/api/v2/scoped-webhooks.spec.ts`

**Modify**
- `packages/prisma/schema.prisma`
- `packages/lib/server-only/public-api/get-api-token-by-token.ts`
- `packages/trpc/server/context.ts`, `packages/trpc/server/trpc.ts`
- `packages/lib/server-only/webhooks/get-all-webhooks-by-event-trigger.ts`, `trigger/trigger-webhook.ts`, `trigger/schema.ts`, `trigger/handler.ts`, `trigger-test-webhook.ts`
- 15 files with 19 `triggerWebhook(` call sites (drop `userId`)
- `packages/lib/jobs/definitions/internal/execute-webhook.ts` + `.handler.ts` (add `teamId`/`organisationId` to payload)
- `packages/trpc/server/organisation-router/*.ts` (17) and `team-router/*.ts` (12) — uncomment meta
- `packages/trpc/server/admin-router/*` — add meta to the curated set
- `packages/trpc/server/api-token-router/router.ts`, `webhook-router/router.ts`
- `packages/trpc/server/open-api.ts` — header docs
- `packages/api/v1/middleware/authenticated.ts`, `apps/remix/server/api/download/download.ts`, `packages/lib/server-only/webhooks/zapier/validateApiToken.ts`, `packages/lib/server-only/embedding-presign/create-embedding-presign-token.ts`, `packages/trpc/server/embedding-router/create-embedding-presign-token.ts`
- `apps/remix/app/components/dialogs/token-create-dialog.tsx`, `token-delete-dialog.tsx`, `webhook-create-dialog.tsx`, `webhook-edit-dialog.tsx`, `webhook-delete-dialog.tsx` — accept a `scope` prop
- `packages/lib/utils/settings-nav.ts`, `apps/remix/app/routes/_authenticated+/admin+/_layout.tsx` — nav entries

---

### Task 0: Repo setup (fork, unshallow, remotes, deps, DB)

**Files:** none (git + environment)

- [ ] **Step 1: Create the private repo and re-point remotes**

GitHub forks of public repos cannot be private, so this is a private standalone repo
tracking upstream via a git remote. It can be flipped to public later.

```bash
cd /Users/andrewbenson/Developer/documenso
git remote rename origin upstream
git fetch --unshallow upstream
gh repo create hillmarkets/documenso --private --description "Hill Markets fork of Documenso" --source=. --remote=origin
git branch --set-upstream-to=upstream/main main
git remote -v
```
Expected: `origin` → `hillmarkets/documenso` (private), `upstream` → `documenso/documenso`; `git log --oneline | wc -l` is in the thousands.

- [ ] **Step 2: Install deps and start Postgres**

```bash
npm ci
open -a Docker   # if the daemon isn't running
npm run dx:up
npm run prisma:migrate-dev
npm run prisma:seed
```
Expected: `docker compose ... up -d` succeeds, migrations apply, seed completes.

- [ ] **Step 3: Baseline checks pass**

```bash
npm run lint
npm run test -w @documenso/lib
```
Expected: both green before we touch anything.

- [ ] **Step 4: Commit nothing yet** (spec + plan already committed on `feat/scoped-api`).

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `packages/prisma/schema.prisma:184-233` (Webhook, ApiToken), plus `Organisation` and `Team` back-relations
- Create: `packages/prisma/migrations/<ts>_add_api_token_and_webhook_scope/migration.sql`

- [ ] **Step 1: Edit schema**

Replace the `Webhook` model:

```prisma
enum WebhookScope {
  INSTANCE
  ORGANISATION
  TEAM
}

model Webhook {
  id             String                 @id @default(cuid())
  webhookUrl     String
  eventTriggers  WebhookTriggerEvents[]
  secret         String?
  enabled        Boolean                @default(true)
  scope          WebhookScope           @default(TEAM)
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @default(now()) @updatedAt
  userId         Int
  user           User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId         Int?
  team           Team?                  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  organisationId String?
  organisation   Organisation?          @relation(fields: [organisationId], references: [id], onDelete: Cascade)
  webhookCalls   WebhookCall[]

  @@index([scope, teamId])
  @@index([scope, organisationId])
}
```

Replace the `ApiToken` model:

```prisma
enum ApiTokenScope {
  INSTANCE
  ORGANISATION
  TEAM
}

model ApiToken {
  id             Int               @id @default(autoincrement())
  name           String
  token          String            @unique
  algorithm      ApiTokenAlgorithm @default(SHA512)
  scope          ApiTokenScope     @default(TEAM)
  expires        DateTime?
  createdAt      DateTime          @default(now())
  lastUsedAt     DateTime?
  userId         Int?
  user           User?             @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId         Int?
  team           Team?             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  organisationId String?
  organisation   Organisation?     @relation(fields: [organisationId], references: [id], onDelete: Cascade)
}
```

In `model Organisation { ... }` add two back-relations next to the existing `teams Team[]`:

```prisma
  apiTokens ApiToken[]
  webhooks  Webhook[]
```

(`Team` already has `apiTokens`/`webhooks` relations — no change.)

- [ ] **Step 2: Generate the migration, then append check constraints**

```bash
npm run with:env -- npx prisma migrate dev --create-only --name add_api_token_and_webhook_scope -w @documenso/prisma
```
Open the generated `migration.sql` and append:

```sql
-- Scope invariants
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_scope_check" CHECK (
  ("scope" = 'TEAM'         AND "teamId" IS NOT NULL AND "organisationId" IS NULL) OR
  ("scope" = 'ORGANISATION' AND "teamId" IS NULL     AND "organisationId" IS NOT NULL) OR
  ("scope" = 'INSTANCE'     AND "teamId" IS NULL     AND "organisationId" IS NULL AND "userId" IS NOT NULL)
);

ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_scope_check" CHECK (
  ("scope" = 'TEAM'         AND "teamId" IS NOT NULL AND "organisationId" IS NULL) OR
  ("scope" = 'ORGANISATION' AND "teamId" IS NULL     AND "organisationId" IS NOT NULL) OR
  ("scope" = 'INSTANCE'     AND "teamId" IS NULL     AND "organisationId" IS NULL)
);
```

- [ ] **Step 3: Apply + regenerate client**

```bash
npm run prisma:migrate-dev
npm run prisma:generate
```
Expected: migration applied; existing seeded rows are `TEAM` with `teamId` populated.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json 2>&1 | head -40
```
Expected: errors ONLY in `get-api-token-by-token.ts` (team possibly null), the download route, v1 middleware, webhook lib files — the files the next tasks fix. Note them.

- [ ] **Step 5: Commit**

```bash
git add packages/prisma
git commit -m "feat(prisma): add scope to ApiToken and Webhook"
```

---

### Task 2: `getApiTokenByToken` handles all three scopes

**Files:**
- Modify: `packages/lib/server-only/public-api/get-api-token-by-token.ts`

- [ ] **Step 1: Rewrite the lookup**

```ts
import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { logger } from '../../utils/logger';
import { hashString } from '../auth/hash';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';

const LAST_USED_AT_UPDATE_INTERVAL = 60_000; // 1 minute

const ORGANISATION_INCLUDE = {
  organisationClaim: true,
  owner: {
    select: { id: true, name: true, email: true, disabled: true },
  },
} as const;

type GetApiTokenByTokenOptions = {
  token: string;
  /** Defaults to false. Will assert that the API request limit is not exceeded. */
  bypassRateLimit?: boolean;
};

export const getApiTokenByToken = async ({ token, bypassRateLimit = false }: GetApiTokenByTokenOptions) => {
  const hashedToken = hashString(token);

  const apiToken = await prisma.apiToken.findFirst({
    where: { token: hashedToken },
    include: {
      team: { include: { organisation: { include: ORGANISATION_INCLUDE } } },
      organisation: { include: ORGANISATION_INCLUDE },
      user: { select: { id: true, name: true, email: true, disabled: true } },
    },
  });

  if (!apiToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Invalid token', statusCode: 401 });
  }

  // The organisation this token belongs to, if any. INSTANCE tokens have none.
  const organisation = apiToken.team?.organisation ?? apiToken.organisation ?? null;

  if (apiToken.scope !== ApiTokenScope.INSTANCE && !organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Invalid token', statusCode: 401 });
  }

  if (apiToken.user?.disabled || organisation?.owner.disabled) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'User is disabled', statusCode: 401 });
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, { message: 'Expired token', statusCode: 401 });
  }

  // INSTANCE tokens are the platform itself and are not subject to per-organisation limits.
  if (!bypassRateLimit && organisation) {
    await assertOrganisationRatesAndLimits({
      organisationId: organisation.id,
      organisationClaim: organisation.organisationClaim,
      type: 'api',
      count: 1,
    });
  }

  // Team and organisation tokens without an explicit user act as the organisation owner.
  // (Team tokens: "a silly choice from many moons ago"; organisation tokens follow the same rule.)
  const user = apiToken.user ?? organisation?.owner ?? null;

  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Invalid token', statusCode: 401 });
  }

  if (!apiToken.lastUsedAt || apiToken.lastUsedAt.getTime() + LAST_USED_AT_UPDATE_INTERVAL < Date.now()) {
    void prisma.apiToken
      .updateMany({
        where: { id: apiToken.id, lastUsedAt: apiToken.lastUsedAt },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        logger.warn({ msg: 'Failed to update API token lastUsedAt', apiTokenId: apiToken.id, err });
      });
  }

  return { ...apiToken, user, organisation };
};

export type ApiTokenWithRelations = Awaited<ReturnType<typeof getApiTokenByToken>>;
```

- [ ] **Step 2: Typecheck lib**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json 2>&1 | grep get-api-token-by-token
```
Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add packages/lib/server-only/public-api/get-api-token-by-token.ts
git commit -m "feat(api): resolve organisation and acting user for all token scopes"
```

---

### Task 3: `requireTeamScopedToken` — gate v1, download, zapier, embedding

**Files:**
- Create: `packages/lib/server-only/public-api/require-team-scoped-token.ts`
- Modify: `packages/api/v1/middleware/authenticated.ts:60-95`, `apps/remix/server/api/download/download.ts:30-48`, `packages/lib/server-only/webhooks/zapier/validateApiToken.ts`, `packages/lib/server-only/embedding-presign/create-embedding-presign-token.ts:25`, `packages/trpc/server/embedding-router/create-embedding-presign-token.ts:35`

- [ ] **Step 1: Create the helper**

```ts
import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiTokenWithRelations } from './get-api-token-by-token';

export type TeamScopedApiToken = ApiTokenWithRelations & {
  scope: typeof ApiTokenScope.TEAM;
  teamId: number;
  team: NonNullable<ApiTokenWithRelations['team']>;
};

/**
 * Narrows a token to TEAM scope. Used by surfaces that only support team tokens
 * (API v1, Zapier, embedding presign).
 */
export const requireTeamScopedToken = (
  apiToken: ApiTokenWithRelations,
  surface: string,
): TeamScopedApiToken => {
  if (apiToken.scope !== ApiTokenScope.TEAM || apiToken.teamId === null || !apiToken.team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: `${surface} only supports team-scoped tokens; use /api/v2 with an x-team-id header`,
      statusCode: 403,
    });
  }

  return apiToken as TeamScopedApiToken;
};
```

- [ ] **Step 2: Apply in v1 middleware** (`packages/api/v1/middleware/authenticated.ts`)

After `const apiToken = await getApiTokenByToken({ token });` add:

```ts
      const teamToken = requireTeamScopedToken(apiToken, 'API v1');
```
and replace the two later uses `apiToken.team` in `metadata.auditUser` and the `handler(...)` call with `teamToken.team`. Add the import.

- [ ] **Step 3: Apply in zapier + embedding**

`validateApiToken.ts`: `return requireTeamScopedToken(await getApiTokenByToken({ token, bypassRateLimit: true }), 'Zapier');`

`create-embedding-presign-token.ts` (lib): wrap `getApiTokenByToken` result with `requireTeamScopedToken(..., 'Embedding presign')`.

`embedding-router/create-embedding-presign-token.ts`: same wrap so `token.teamId` is `number`.

- [ ] **Step 4: Download route uses full scope resolution** — deferred to Task 5 (it needs `resolveApiTokenScope`). For now add `requireTeamScopedToken(apiToken, 'Download')` inside `resolveApiToken` so it compiles; Task 5 replaces it.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json && npx tsc --noEmit -p packages/api/tsconfig.json && npx tsc --noEmit -p apps/remix/tsconfig.json 2>&1 | grep -v "webhooks/" | head
```
Expected: no errors outside webhook files (Task 6).

- [ ] **Step 6: Commit**

```bash
git add -A packages/lib/server-only/public-api packages/api packages/lib/server-only/webhooks/zapier packages/lib/server-only/embedding-presign packages/trpc/server/embedding-router apps/remix/server/api/download
git commit -m "feat(api): gate v1, zapier, embedding and download to team-scoped tokens"
```

---

### Task 4: `resolveApiTokenScope` — the only header reader (TDD)

**Files:**
- Create: `packages/lib/server-only/public-api/resolve-api-token-scope.ts`
- Test: `packages/lib/server-only/public-api/resolve-api-token-scope.test.ts`

The pure part (`resolveScopeTarget`) is unit-tested; the DB part (`resolveApiTokenScope`) loads the target team/org and acting user.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveScopeTarget } from './resolve-api-token-scope';

const headers = (h: Record<string, string>) => new Headers(h);

describe('resolveScopeTarget', () => {
  it('TEAM token ignores headers and targets its own team', () => {
    const r = resolveScopeTarget(
      { scope: 'TEAM', teamId: 7, organisationId: null },
      headers({ 'x-team-id': '99', 'x-organisation-id': 'org_x' }),
    );
    expect(r).toEqual({ ok: true, kind: 'team', teamId: 7, organisationId: null });
  });

  it('ORGANISATION token with no headers targets its org only', () => {
    const r = resolveScopeTarget({ scope: 'ORGANISATION', teamId: null, organisationId: 'org_a' }, headers({}));
    expect(r).toEqual({ ok: true, kind: 'organisation', teamId: null, organisationId: 'org_a' });
  });

  it('ORGANISATION token passes x-team-id through for DB validation', () => {
    const r = resolveScopeTarget(
      { scope: 'ORGANISATION', teamId: null, organisationId: 'org_a' },
      headers({ 'x-team-id': '12' }),
    );
    expect(r).toEqual({ ok: true, kind: 'organisation', teamId: 12, organisationId: 'org_a' });
  });

  it('ORGANISATION token ignores a foreign x-organisation-id', () => {
    const r = resolveScopeTarget(
      { scope: 'ORGANISATION', teamId: null, organisationId: 'org_a' },
      headers({ 'x-organisation-id': 'org_b' }),
    );
    expect(r).toEqual({ ok: false, status: 403, message: 'Token is scoped to a different organisation' });
  });

  it('INSTANCE token with no headers has no target', () => {
    const r = resolveScopeTarget({ scope: 'INSTANCE', teamId: null, organisationId: null }, headers({}));
    expect(r).toEqual({ ok: true, kind: 'instance', teamId: null, organisationId: null });
  });

  it('INSTANCE token honours both headers', () => {
    const r = resolveScopeTarget(
      { scope: 'INSTANCE', teamId: null, organisationId: null },
      headers({ 'x-team-id': '3', 'x-organisation-id': 'org_c' }),
    );
    expect(r).toEqual({ ok: true, kind: 'instance', teamId: 3, organisationId: 'org_c' });
  });

  it('rejects a non-numeric x-team-id', () => {
    const r = resolveScopeTarget(
      { scope: 'INSTANCE', teamId: null, organisationId: null },
      headers({ 'x-team-id': 'abc' }),
    );
    expect(r).toEqual({ ok: false, status: 400, message: 'x-team-id must be a number' });
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run server-only/public-api/resolve-api-token-scope -w @documenso/lib
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiTokenWithRelations } from './get-api-token-by-token';

export const X_TEAM_ID_HEADER = 'x-team-id';
export const X_ORGANISATION_ID_HEADER = 'x-organisation-id';

export type ApiScopeKind = 'instance' | 'organisation' | 'team';

export type ApiScope = {
  kind: ApiScopeKind;
  apiTokenId: number;
  /** Resolved target team, if any. */
  teamId: number | null;
  /** Resolved target organisation, if any. */
  organisationId: string | null;
};

type ScopeTargetInput = Pick<ApiTokenWithRelations, 'scope' | 'teamId' | 'organisationId'>;

export type ScopeTargetResult =
  | { ok: true; kind: ApiScopeKind; teamId: number | null; organisationId: string | null }
  | { ok: false; status: 400 | 403; message: string };

/**
 * Pure: decide which tenant a token is targeting from its scope and the request headers.
 * Does not touch the database. Existence / membership of the target is validated by
 * `resolveApiTokenScope`.
 */
export const resolveScopeTarget = (token: ScopeTargetInput, headers: Headers): ScopeTargetResult => {
  const rawTeamId = headers.get(X_TEAM_ID_HEADER);
  const rawOrganisationId = headers.get(X_ORGANISATION_ID_HEADER);

  let headerTeamId: number | null = null;

  if (rawTeamId !== null && rawTeamId !== '') {
    const parsed = Number(rawTeamId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, status: 400, message: `${X_TEAM_ID_HEADER} must be a number` };
    }

    headerTeamId = parsed;
  }

  const headerOrganisationId = rawOrganisationId ? rawOrganisationId : null;

  switch (token.scope) {
    case ApiTokenScope.TEAM:
      return { ok: true, kind: 'team', teamId: token.teamId, organisationId: null };

    case ApiTokenScope.ORGANISATION:
      if (headerOrganisationId && headerOrganisationId !== token.organisationId) {
        return { ok: false, status: 403, message: 'Token is scoped to a different organisation' };
      }

      return { ok: true, kind: 'organisation', teamId: headerTeamId, organisationId: token.organisationId };

    case ApiTokenScope.INSTANCE:
      return { ok: true, kind: 'instance', teamId: headerTeamId, organisationId: headerOrganisationId };
  }
};

export type ResolvedApiTokenScope = {
  scope: ApiScope;
  /** The user every downstream procedure and audit log will act as. */
  user: ApiTokenWithRelations['user'];
  /** Name recorded in audit logs when the token stands in for a team/org. */
  auditName: string;
};

type ResolveApiTokenScopeOptions = {
  apiToken: ApiTokenWithRelations;
  headers: Headers;
};

/**
 * Turn a token + request headers into a typed scope and an acting user.
 * This is the ONLY place `x-team-id` / `x-organisation-id` are read.
 */
export const resolveApiTokenScope = async ({
  apiToken,
  headers,
}: ResolveApiTokenScopeOptions): Promise<ResolvedApiTokenScope> => {
  const target = resolveScopeTarget(apiToken, headers);

  if (!target.ok) {
    throw new AppError(target.status === 403 ? AppErrorCode.UNAUTHORIZED : AppErrorCode.INVALID_REQUEST, {
      message: target.message,
      statusCode: target.status,
    });
  }

  const scopeBase = { apiTokenId: apiToken.id, kind: target.kind };

  // TEAM: nothing to look up, the token already carries its team.
  if (target.kind === 'team') {
    return {
      scope: { ...scopeBase, teamId: target.teamId, organisationId: apiToken.team?.organisationId ?? null },
      user: apiToken.user,
      auditName: apiToken.team?.name ?? apiToken.name,
    };
  }

  // A team was named: validate it exists (and, for ORG tokens, belongs to the token's org).
  if (target.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: target.teamId },
      select: {
        name: true,
        organisationId: true,
        organisation: { select: { owner: { select: { id: true, name: true, email: true, disabled: true } } } },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found', statusCode: 404 });
    }

    if (target.kind === 'organisation' && team.organisationId !== target.organisationId) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Team does not belong to the organisation this token is scoped to',
        statusCode: 403,
      });
    }

    if (target.kind === 'instance' && target.organisationId && team.organisationId !== target.organisationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `${X_TEAM_ID_HEADER} and ${X_ORGANISATION_ID_HEADER} refer to different organisations`,
        statusCode: 400,
      });
    }

    return {
      scope: { ...scopeBase, teamId: target.teamId, organisationId: team.organisationId },
      user: team.organisation.owner,
      auditName: team.name,
    };
  }

  // An organisation was named (ORG token, or INSTANCE token with x-organisation-id).
  if (target.organisationId !== null) {
    const organisation =
      apiToken.organisation?.id === target.organisationId
        ? apiToken.organisation
        : await prisma.organisation.findFirst({
            where: { id: target.organisationId },
            select: { id: true, name: true, owner: { select: { id: true, name: true, email: true, disabled: true } } },
          });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found', statusCode: 404 });
    }

    return {
      scope: { ...scopeBase, teamId: null, organisationId: organisation.id },
      user: organisation.owner,
      auditName: organisation.name,
    };
  }

  // INSTANCE token with no target: act as the admin who owns the token.
  return {
    scope: { ...scopeBase, teamId: null, organisationId: null },
    user: apiToken.user,
    auditName: apiToken.name,
  };
};
```

Check `AppErrorCode.INVALID_REQUEST` exists in `packages/lib/errors/app-error.ts`; if the closest is `INVALID_BODY`, use that.

- [ ] **Step 4: Run the test**

```bash
npx vitest run server-only/public-api/resolve-api-token-scope -w @documenso/lib
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/public-api/resolve-api-token-scope.ts packages/lib/server-only/public-api/resolve-api-token-scope.test.ts
git commit -m "feat(api): add resolveApiTokenScope header resolution"
```

---

### Task 5: tRPC context + middleware use `ctx.scope`

**Files:**
- Modify: `packages/trpc/server/context.ts`, `packages/trpc/server/trpc.ts`, `apps/remix/server/api/download/download.ts`

- [ ] **Step 1: Add `scope` to the context type** (`context.ts`)

Add import `import type { ApiScope } from '@documenso/lib/server-only/public-api/resolve-api-token-scope';` and in `TrpcContext` add `scope: ApiScope | null;`. In both return objects of `createTrpcContext` add `scope: null,`.

- [ ] **Step 2: Extract a shared token branch in `trpc.ts`**

Above `authenticatedMiddleware`, add:

```ts
import { resolveApiTokenScope } from '@documenso/lib/server-only/public-api/resolve-api-token-scope';

/**
 * Paths under which a procedure does not require a target team. Everything else on
 * the v2 surface is team-scoped and needs `ctx.teamId`.
 */
const TEAM_OPTIONAL_PATH_PREFIXES = ['/organisation', '/admin', '/team'];

const isTeamOptionalPath = (openapiPath: string | undefined) =>
  openapiPath !== undefined && TEAM_OPTIONAL_PATH_PREFIXES.some((prefix) => openapiPath.startsWith(prefix));

type ApiTokenContextOptions = {
  ctx: TrpcContext;
  authorizationHeader: string;
  openapiPath: string;
  baseLogAttributes: TrpcApiLog;
};

/**
 * Shared by `authenticatedMiddleware`, `maybeAuthenticatedMiddleware` and `adminMiddleware`.
 * Validates the bearer token, resolves the tenant it targets and returns the ctx patch.
 */
const buildApiTokenContext = async ({ ctx, authorizationHeader, openapiPath, baseLogAttributes }: ApiTokenContextOptions) => {
  // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
  const [token] = authorizationHeader.split('Bearer ').filter((s) => s.length > 0);

  if (!token) {
    throw new Error('Token was not provided for authenticated middleware');
  }

  const apiToken = await getApiTokenByToken({ token });

  const { scope, user, auditName } = await resolveApiTokenScope({ apiToken, headers: ctx.req.headers });

  assertUserNotDisabled(user);

  if (scope.teamId === null && !isTeamOptionalPath(openapiPath)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'x-team-id header is required for ORGANISATION and INSTANCE tokens on this endpoint',
      statusCode: 400,
    });
  }

  const logger = ctx.logger.child({
    ...baseLogAttributes,
    auth: 'api',
    userId: user.id,
    apiTokenId: apiToken.id,
  } satisfies TrpcApiLog);

  logger.info({ position: 'trpcProcedure' });

  return {
    apiToken,
    ctxPatch: {
      ...ctx,
      logger,
      user,
      session: null,
      scope,
      // -1 matches the sentinel the session branch already uses for "no team".
      teamId: scope.teamId ?? -1,
      metadata: {
        ...ctx.metadata,
        auditUser: scope.kind === 'instance' && scope.teamId === null && scope.organisationId === null
          ? { id: user.id, email: user.email, name: user.name }
          : { id: null, email: null, name: auditName },
        auth: 'api',
      } satisfies ApiRequestMetadata,
    },
  };
};
```

Add `AppErrorCode` to the existing `AppError` import.

- [ ] **Step 3: Use it in `authenticatedMiddleware`**

Replace the whole `if (authorizationHeader && isApiV2) { ... }` block body with:

```ts
  if (authorizationHeader && isApiV2) {
    const { ctxPatch } = await buildApiTokenContext({
      ctx,
      authorizationHeader,
      openapiPath: meta?.openapi?.path ?? '',
      baseLogAttributes,
    });

    return await next({ ctx: ctxPatch });
  }
```

Do the same in `maybeAuthenticatedMiddleware`.

- [ ] **Step 4: Add the INSTANCE branch to `adminMiddleware`**

Change its signature to `async ({ ctx, next, path, meta })` and insert at the top:

```ts
  const authorizationHeader = ctx.req.headers.get('authorization');
  const isApiV2 = Boolean(meta?.openapi?.path);

  if (authorizationHeader && isApiV2) {
    const { apiToken, ctxPatch } = await buildApiTokenContext({
      ctx,
      authorizationHeader,
      openapiPath: meta?.openapi?.path ?? '',
      baseLogAttributes: {
        path,
        auth: null,
        source: ctx.metadata.source,
        trpcMiddleware: 'admin',
        unverifiedTeamId: ctx.teamId,
      },
    });

    if (apiToken.scope !== 'INSTANCE') {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'This endpoint requires an INSTANCE-scoped API token',
        statusCode: 403,
      });
    }

    return await next({ ctx: ctxPatch });
  }
```

- [ ] **Step 5: Download route uses scope resolution** (`apps/remix/server/api/download/download.ts`)

Replace the `requireTeamScopedToken` line from Task 3 with:

```ts
  const { scope, user } = await resolveApiTokenScope({ apiToken, headers });

  if (scope.teamId === null) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'x-team-id header is required for ORGANISATION and INSTANCE tokens on this endpoint',
      statusCode: 400,
    });
  }

  return { ...apiToken, user, teamId: scope.teamId };
```
`resolveApiToken` now takes `(authorizationHeader, headers: Headers)`; update its three call sites to pass `c.req.raw.headers`. Because `user` is the target org owner, the existing `buildTeamWhereQuery({ teamId: apiToken.teamId, userId: apiToken.user.id })` checks keep passing.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p packages/trpc/tsconfig.json 2>&1 | grep -v webhook | head; npx tsc --noEmit -p apps/remix/tsconfig.json 2>&1 | grep -v webhook | head
```
Expected: clean apart from webhook files.

- [ ] **Step 7: Commit**

```bash
git add packages/trpc/server/context.ts packages/trpc/server/trpc.ts apps/remix/server/api/download/download.ts
git commit -m "feat(trpc): resolve token scope into ctx.scope; allow INSTANCE tokens on admin procedures"
```

---

### Task 6: Scope guard middleware (TDD)

**Files:**
- Create: `packages/trpc/server/scope-guard.ts`
- Test: `packages/lib/server-only/public-api/check-input-against-scope.test.ts` (pure function lives in lib so vitest can run it)
- Create: `packages/lib/server-only/public-api/check-input-against-scope.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { checkInputAgainstScope } from './check-input-against-scope';

const team = { kind: 'team' as const, apiTokenId: 1, teamId: 7, organisationId: 'org_a' };
const org = { kind: 'organisation' as const, apiTokenId: 1, teamId: null, organisationId: 'org_a' };
const instance = { kind: 'instance' as const, apiTokenId: 1, teamId: null, organisationId: null };

describe('checkInputAgainstScope', () => {
  it('allows anything for instance tokens', () => {
    expect(checkInputAgainstScope(instance, { organisationId: 'org_z', teamId: 99 }, '/organisation/x')).toBeNull();
  });

  it('rejects TEAM tokens on organisation and admin paths', () => {
    expect(checkInputAgainstScope(team, {}, '/organisation/org_a')).toEqual({
      status: 403,
      message: 'This endpoint requires an ORGANISATION or INSTANCE-scoped API token',
    });
    expect(checkInputAgainstScope(team, {}, '/admin/user')).toMatchObject({ status: 403 });
  });

  it('TEAM token may only reference its own team', () => {
    expect(checkInputAgainstScope(team, { teamId: 7 }, '/team/7')).toBeNull();
    expect(checkInputAgainstScope(team, { teamId: 8 }, '/team/8')).toMatchObject({ status: 403 });
    expect(checkInputAgainstScope(team, { teamReference: '8' }, '/team/8')).toMatchObject({ status: 403 });
  });

  it('ORG token may only reference its own organisation', () => {
    expect(checkInputAgainstScope(org, { organisationId: 'org_a' }, '/organisation/org_a')).toBeNull();
    expect(checkInputAgainstScope(org, { organisationId: 'org_b' }, '/organisation/org_b')).toMatchObject({ status: 403 });
    expect(checkInputAgainstScope(org, { organisationReference: 'org_b' }, '/organisation/org_b')).toMatchObject({ status: 403 });
  });

  it('ORG token cannot call admin paths', () => {
    expect(checkInputAgainstScope(org, {}, '/admin/user/1')).toMatchObject({ status: 403 });
  });

  it('ignores non-object input', () => {
    expect(checkInputAgainstScope(org, undefined, '/organisation/x')).toBeNull();
    expect(checkInputAgainstScope(org, 'string', '/organisation/x')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run check-input-against-scope -w @documenso/lib
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure check**

```ts
import type { ApiScope } from './resolve-api-token-scope';

export type ScopeViolation = { status: 403; message: string };

const ORGANISATION_KEYS = ['organisationId', 'organisationReference'] as const;
const TEAM_KEYS = ['teamId', 'teamReference'] as const;

const readString = (input: Record<string, unknown>, key: string): string | null => {
  const value = input[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};

/**
 * Pure: given the resolved scope and a procedure's raw input, decide whether the
 * input references a tenant the token is not allowed to touch.
 *
 * Returns null when allowed. Organisation references by URL cannot be checked here
 * (we only know the org id) — those still fall through to the procedure's own
 * membership check, which the acting user (the org owner) will fail for foreign orgs
 * unless they happen to be a member. To keep that airtight, ORG tokens are compared
 * against both id and url by the caller passing `organisationUrl`.
 */
export const checkInputAgainstScope = (
  scope: ApiScope,
  rawInput: unknown,
  openapiPath: string,
  organisationUrl?: string,
): ScopeViolation | null => {
  if (scope.kind === 'instance') {
    return null;
  }

  if (openapiPath.startsWith('/admin')) {
    return { status: 403, message: 'This endpoint requires an INSTANCE-scoped API token' };
  }

  if (scope.kind === 'team' && openapiPath.startsWith('/organisation')) {
    return { status: 403, message: 'This endpoint requires an ORGANISATION or INSTANCE-scoped API token' };
  }

  if (typeof rawInput !== 'object' || rawInput === null || Array.isArray(rawInput)) {
    return null;
  }

  const input = rawInput as Record<string, unknown>;

  for (const key of ORGANISATION_KEYS) {
    const value = readString(input, key);

    if (value !== null && value !== scope.organisationId && value !== organisationUrl) {
      return { status: 403, message: 'Token is scoped to a different organisation' };
    }
  }

  if (scope.kind === 'team') {
    for (const key of TEAM_KEYS) {
      const value = readString(input, key);

      if (value !== null && value !== String(scope.teamId)) {
        return { status: 403, message: 'Token is scoped to a different team' };
      }
    }
  }

  return null;
};
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run check-input-against-scope -w @documenso/lib
```
Expected: 6 passed.

- [ ] **Step 5: Wire it as a tRPC middleware** (`packages/trpc/server/scope-guard.ts`)

```ts
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { checkInputAgainstScope } from '@documenso/lib/server-only/public-api/check-input-against-scope';
import { prisma } from '@documenso/prisma';

import { t } from './trpc-instance';

/**
 * Rejects API-token requests whose input references a tenant outside the token's scope.
 * Team references inside an ORG token's org are validated by the procedure's own
 * membership check (the acting user is the org owner).
 */
export const enforceApiTokenScope = t.middleware(async ({ ctx, next, meta, getRawInput }) => {
  if (!ctx.scope || ctx.metadata.auth !== 'api') {
    return await next();
  }

  const openapiPath = meta?.openapi?.path ?? '';

  // Organisation routes accept id OR url; look the url up once so the guard can compare both.
  const organisationUrl =
    ctx.scope.kind === 'organisation' && ctx.scope.organisationId
      ? (await prisma.organisation.findFirst({ where: { id: ctx.scope.organisationId }, select: { url: true } }))?.url
      : undefined;

  const violation = checkInputAgainstScope(ctx.scope, await getRawInput(), openapiPath, organisationUrl);

  if (violation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: violation.message, statusCode: violation.status });
  }

  return await next();
});
```

`t` is currently module-private in `trpc.ts`. Move `const t = initTRPC...create({...})` into a new file `packages/trpc/server/trpc-instance.ts` exporting `t` and `TrpcRouteMeta`, and import it from `trpc.ts` (keeps `trpc.ts` from importing `scope-guard.ts` circularly).

Then in `trpc.ts`:

```ts
export const authenticatedProcedure = t.procedure.use(authenticatedMiddleware).use(enforceApiTokenScope);
export const maybeAuthenticatedProcedure = t.procedure.use(maybeAuthenticatedMiddleware).use(enforceApiTokenScope);
export const adminProcedure = t.procedure.use(adminMiddleware);
```

- [ ] **Step 6: Typecheck + lint**

```bash
npx tsc --noEmit -p packages/trpc/tsconfig.json 2>&1 | grep -v webhook | head; npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add packages/trpc/server/trpc-instance.ts packages/trpc/server/trpc.ts packages/trpc/server/scope-guard.ts packages/lib/server-only/public-api/check-input-against-scope.ts packages/lib/server-only/public-api/check-input-against-scope.test.ts
git commit -m "feat(trpc): enforce token scope against procedure input"
```

---

### Task 7: Webhook delivery — pure tenant matching (TDD)

**Files:**
- Create: `packages/lib/server-only/webhooks/build-webhook-delivery-where.ts` + `.test.ts`
- Modify: `get-all-webhooks-by-event-trigger.ts`, `trigger/trigger-webhook.ts`, `trigger/schema.ts`, `trigger/handler.ts`, `trigger-test-webhook.ts`, `packages/lib/jobs/definitions/internal/execute-webhook.ts`, `execute-webhook.handler.ts`, and the 15 call-site files

- [ ] **Step 1: Failing test**

```ts
import { WebhookScope, WebhookTriggerEvents } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { buildWebhookDeliveryWhere } from './build-webhook-delivery-where';

describe('buildWebhookDeliveryWhere', () => {
  it('matches team, parent org and instance webhooks for the event', () => {
    expect(
      buildWebhookDeliveryWhere({ event: WebhookTriggerEvents.DOCUMENT_CREATED, teamId: 5, organisationId: 'org_a' }),
    ).toEqual({
      enabled: true,
      eventTriggers: { has: WebhookTriggerEvents.DOCUMENT_CREATED },
      OR: [
        { scope: WebhookScope.TEAM, teamId: 5 },
        { scope: WebhookScope.ORGANISATION, organisationId: 'org_a' },
        { scope: WebhookScope.INSTANCE },
      ],
    });
  });
});
```

- [ ] **Step 2: Run → FAIL (module not found)**

```bash
npx vitest run build-webhook-delivery-where -w @documenso/lib
```

- [ ] **Step 3: Implement**

```ts
import type { Prisma, WebhookTriggerEvents } from '@prisma/client';
import { WebhookScope } from '@prisma/client';

export type BuildWebhookDeliveryWhereOptions = {
  event: WebhookTriggerEvents;
  teamId: number;
  organisationId: string;
};

/**
 * An event on team T delivers to T's webhooks, T's organisation's webhooks and every
 * instance webhook. Matching is purely by tenant — authorization lives on the
 * management procedures, not here.
 */
export const buildWebhookDeliveryWhere = ({
  event,
  teamId,
  organisationId,
}: BuildWebhookDeliveryWhereOptions): Prisma.WebhookWhereInput => ({
  enabled: true,
  eventTriggers: { has: event },
  OR: [
    { scope: WebhookScope.TEAM, teamId },
    { scope: WebhookScope.ORGANISATION, organisationId },
    { scope: WebhookScope.INSTANCE },
  ],
});
```

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Rewrite `get-all-webhooks-by-event-trigger.ts`**

```ts
import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';

import { buildWebhookDeliveryWhere } from './build-webhook-delivery-where';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  teamId: number;
};

export const getAllWebhooksByEventTrigger = async ({ event, teamId }: GetAllWebhooksByEventTriggerOptions) => {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organisationId: true } });

  if (!team) {
    return [];
  }

  return prisma.webhook.findMany({
    where: buildWebhookDeliveryWhere({ event, teamId, organisationId: team.organisationId }),
  });
};
```

- [ ] **Step 6: Rewrite `trigger/trigger-webhook.ts`**

```ts
import type { WebhookTriggerEvents } from '@prisma/client';

import { jobs } from '../../../jobs/client';
import { logger } from '../../../utils/logger';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  teamId: number;
};

export const triggerWebhook = async ({ event, data, teamId }: TriggerWebhookOptions) => {
  try {
    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, teamId });

    if (registeredWebhooks.length === 0) {
      logger.debug({ msg: 'No webhooks registered for event', event, teamId });
      return;
    }

    await Promise.allSettled(
      registeredWebhooks.map(async (webhook) => {
        await jobs.triggerJob({
          name: 'internal.execute-webhook',
          payload: { event, webhookId: webhook.id, data, teamId },
        });
      }),
    );
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to trigger webhook`);
  }
};
```

- [ ] **Step 7: Schema + handler + test trigger**

`trigger/schema.ts`: remove `userId: z.number(),`.
`trigger/handler.ts`: destructure `{ event, data, teamId }` and call `getAllWebhooksByEventTrigger({ event, teamId })`; pass `teamId` in the job payload.
`trigger-test-webhook.ts`: remove `userId` from the `triggerWebhook` call (keep it for `getWebhookById`).

- [ ] **Step 8: Job payload carries tenant** (`packages/lib/jobs/definitions/internal/execute-webhook.ts`)

Add `teamId: z.number()` to `ZExecuteWebhookJobDefinition`'s payload schema. In `execute-webhook.handler.ts`, destructure `teamId`, look up `organisationId` (`prisma.team.findUnique({ where: { id: teamId }, select: { organisationId: true } })`) and add both to `payloadData`:

```ts
  const payloadData = {
    event,
    payload: data,
    createdAt: new Date().toISOString(),
    webhookEndpoint: url,
    teamId,
    organisationId: team?.organisationId ?? null,
  };
```

- [ ] **Step 9: Remove `userId` from the 19 call sites**

```bash
grep -rn "triggerWebhook(" packages/lib --include=*.ts -l | grep -v trigger-webhook.ts
```
In each `triggerWebhook({ ... userId, teamId })` object literal, delete the `userId` / `userId: ...` line. Files: `jobs/definitions/internal/{process-recipient-expired,process-signing-reminder,seal-document}.handler.ts`, `server-only/document/{cancel-document,complete-document-with-token,delete-document,resend-document,send-document,viewed-document}.ts`, `server-only/envelope/{create-envelope,duplicate-envelope,update-envelope}.ts`, `server-only/template/{create-document-from-direct-template,create-document-from-template,delete-template}.ts`.

Verify: `grep -rn -A4 "triggerWebhook({" packages/lib | grep userId` returns nothing.

- [ ] **Step 10: Typecheck + run lib tests**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json && npm run test -w @documenso/lib
```
Expected: clean; all vitest suites pass.

- [ ] **Step 11: Commit**

```bash
git add -A packages/lib
git commit -m "feat(webhooks): deliver by tenant (team, org, instance) without user membership filter"
```

---

### Task 8: Organisation- and instance-scoped token lib + procedures

**Files:**
- Create: `packages/lib/server-only/public-api/create-scoped-api-token.ts`, `get-scoped-api-tokens.ts`, `delete-scoped-api-token.ts`
- Create: `packages/trpc/server/api-token-router/organisation/{create,find,delete}-organisation-api-token.ts` + `.types.ts`
- Create: `packages/trpc/server/api-token-router/instance/{create,find,delete}-instance-api-token.ts` + `.types.ts`
- Modify: `packages/trpc/server/api-token-router/router.ts`

- [ ] **Step 1: Generic lib functions**

`create-scoped-api-token.ts`:

```ts
import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';
import { DateTime } from 'luxon';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import * as timeConstants from '../../constants/time';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { hashString } from '../auth/hash';

type Expiry = { expiresIn: string | null };

const expiresAt = ({ expiresIn }: Expiry) =>
  expiresIn ? DateTime.now().plus((timeConstants as Record<string, number>)[expiresIn]).toJSDate() : null;

const mint = () => {
  const token = `api_${alphaid(16)}`;
  return { token, hashed: hashString(token) };
};

export type CreateOrganisationApiTokenOptions = Expiry & {
  userId: number;
  organisationId: string;
  tokenName: string;
};

export const createOrganisationApiToken = async ({
  userId,
  organisationId,
  tokenName,
  expiresIn,
}: CreateOrganisationApiTokenOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to create a token for this organisation',
    });
  }

  const { token, hashed } = mint();

  const stored = await prisma.apiToken.create({
    data: { name: tokenName, token: hashed, scope: ApiTokenScope.ORGANISATION, expires: expiresAt({ expiresIn }), userId, organisationId },
  });

  return { id: stored.id, token };
};

export type CreateInstanceApiTokenOptions = Expiry & {
  /** Must be an ADMIN — the caller (adminProcedure) guarantees this. */
  userId: number;
  tokenName: string;
};

export const createInstanceApiToken = async ({ userId, tokenName, expiresIn }: CreateInstanceApiTokenOptions) => {
  const { token, hashed } = mint();

  const stored = await prisma.apiToken.create({
    data: { name: tokenName, token: hashed, scope: ApiTokenScope.INSTANCE, expires: expiresAt({ expiresIn }), userId },
  });

  return { id: stored.id, token };
};
```

`get-scoped-api-tokens.ts`:

```ts
import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { buildOrganisationWhereQuery } from '../../utils/organisations';

const TOKEN_SELECT = { id: true, name: true, createdAt: true, expires: true, lastUsedAt: true } as const;

export const getOrganisationApiTokens = async ({ userId, organisationId }: { userId: number; organisationId: string }) =>
  prisma.apiToken.findMany({
    where: {
      scope: ApiTokenScope.ORGANISATION,
      organisation: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    },
    select: TOKEN_SELECT,
    orderBy: { createdAt: 'desc' },
  });

export const getInstanceApiTokens = async () =>
  prisma.apiToken.findMany({
    where: { scope: ApiTokenScope.INSTANCE },
    select: { ...TOKEN_SELECT, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
```

`delete-scoped-api-token.ts`:

```ts
import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../utils/organisations';

export const deleteOrganisationApiToken = async ({ id, userId, organisationId }: { id: number; userId: number; organisationId: string }) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'You do not have permission to delete this token' });
  }

  await prisma.apiToken.delete({ where: { id, scope: ApiTokenScope.ORGANISATION, organisationId } });
};

export const deleteInstanceApiToken = async ({ id }: { id: number }) => {
  await prisma.apiToken.delete({ where: { id, scope: ApiTokenScope.INSTANCE } });
};
```

- [ ] **Step 2: Organisation procedures**

`organisation/create-organisation-api-token.types.ts`:

```ts
import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const createOrganisationApiTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/api-token/create',
    summary: 'Create organisation API token',
    description:
      'Create an ORGANISATION-scoped API token. Callable by organisation admins (session), ORGANISATION tokens for their own organisation, and INSTANCE tokens.',
    tags: ['Organisation API Tokens'],
  },
};

export const ZCreateOrganisationApiTokenRequestSchema = z.object({
  organisationId: z.string(),
  tokenName: ZNameSchema,
  expirationDate: z.string().nullable(),
});

export const ZCreateOrganisationApiTokenResponseSchema = z.object({ id: z.number(), token: z.string() });
```

`organisation/create-organisation-api-token.ts`:

```ts
import { createOrganisationApiToken } from '@documenso/lib/server-only/public-api/create-scoped-api-token';

import { authenticatedProcedure } from '../../trpc';
import {
  createOrganisationApiTokenMeta,
  ZCreateOrganisationApiTokenRequestSchema,
  ZCreateOrganisationApiTokenResponseSchema,
} from './create-organisation-api-token.types';

export const createOrganisationApiTokenRoute = authenticatedProcedure
  .meta(createOrganisationApiTokenMeta)
  .input(ZCreateOrganisationApiTokenRequestSchema)
  .output(ZCreateOrganisationApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, tokenName, expirationDate } = input;

    ctx.logger.info({ input: { organisationId } });

    return await createOrganisationApiToken({
      userId: ctx.user.id,
      organisationId,
      tokenName,
      expiresIn: expirationDate,
    });
  });
```

`find-organisation-api-tokens` — meta `GET /organisation/{organisationId}/api-token`, input `{ organisationId }`, output `z.array(z.object({ id, name, createdAt: z.date(), expires: z.date().nullable(), lastUsedAt: z.date().nullable() }))`, query calls `getOrganisationApiTokens({ userId: ctx.user.id, organisationId })`.

`delete-organisation-api-token` — meta `POST /organisation/{organisationId}/api-token/{id}/delete`, input `{ organisationId, id: z.number() }`, output `z.void()`, mutation calls `deleteOrganisationApiToken`.

- [ ] **Step 3: Instance procedures** (same shapes, `adminProcedure`, no `organisationId`)

- `create-instance-api-token` — `POST /admin/api-token/create`, input `{ tokenName, expirationDate }`, calls `createInstanceApiToken({ userId: ctx.user.id, ... })`. Tag `Admin API Tokens`. Description: "Create an INSTANCE-scoped API token. Requires a session admin or an INSTANCE token."
- `find-instance-api-tokens` — `GET /admin/api-token`, output adds `user: { id, name: z.string().nullable(), email }`.
- `delete-instance-api-token` — `POST /admin/api-token/{id}/delete`, input `{ id: z.number() }`.

- [ ] **Step 4: Router**

```ts
export const apiTokenRouter = router({
  create: createApiTokenRoute,
  getMany: getApiTokensRoute,
  delete: deleteApiTokenRoute,
  organisation: {
    create: createOrganisationApiTokenRoute,
    find: findOrganisationApiTokensRoute,
    delete: deleteOrganisationApiTokenRoute,
  },
  instance: {
    create: createInstanceApiTokenRoute,
    find: findInstanceApiTokensRoute,
    delete: deleteInstanceApiTokenRoute,
  },
});
```

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p packages/trpc/tsconfig.json && npm run lint
git add -A packages/lib/server-only/public-api packages/trpc/server/api-token-router
git commit -m "feat(api): organisation and instance scoped API token procedures"
```

---

### Task 9: Organisation- and instance-scoped webhook lib + procedures

**Files:**
- Create: `packages/lib/server-only/webhooks/scoped/{create,find,get,edit,delete}-scoped-webhook.ts`
- Create: `packages/trpc/server/webhook-router/organisation/*.ts` (+`.types.ts`) and `instance/*.ts` (+`.types.ts`)
- Modify: `packages/trpc/server/webhook-router/router.ts`

- [ ] **Step 1: Lib** — one file per operation, each exporting an org and an instance variant. Pattern (create):

```ts
import { prisma } from '@documenso/prisma';
import { WebhookScope, type WebhookTriggerEvents } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../../utils/organisations';

type WebhookData = {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
};

export const assertCanManageOrganisationWebhooks = async ({ userId, organisationId }: { userId: number; organisationId: string }) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    select: { id: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found' });
  }
};

export const createOrganisationWebhook = async ({ userId, organisationId, ...data }: WebhookData & { userId: number; organisationId: string }) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return prisma.webhook.create({ data: { ...data, scope: WebhookScope.ORGANISATION, userId, organisationId } });
};

export const createInstanceWebhook = async ({ userId, ...data }: WebhookData & { userId: number }) =>
  prisma.webhook.create({ data: { ...data, scope: WebhookScope.INSTANCE, userId } });
```

find: `findMany({ where: { scope: ORGANISATION, organisationId } })` after the assert; instance: `where: { scope: INSTANCE }`.
get: `findFirstOrThrow({ where: { id, scope, organisationId } })` after the assert.
edit: `update({ where: { id, scope: ORGANISATION, organisationId }, data })` after the assert; instance: `where: { id, scope: INSTANCE }`.
delete: same shape as edit with `delete`.

- [ ] **Step 2: Procedures** — mirror Task 8. Org paths: `POST /organisation/{organisationId}/webhook/create`, `GET /organisation/{organisationId}/webhook`, `GET /organisation/{organisationId}/webhook/{id}`, `POST /organisation/{organisationId}/webhook/{id}/update`, `POST /organisation/{organisationId}/webhook/{id}/delete`. Instance paths: `/admin/webhook/...` with `adminProcedure`. Inputs reuse `ZCreateWebhookRequestSchema` from `../schema` extended with `organisationId` (org) and `id` (edit/delete/get). Outputs: `WebhookSchema` from `@documenso/prisma/generated/zod/modelSchema/WebhookSchema` (array for find, `z.void()` for delete). Tags: `Organisation Webhooks`, `Admin Webhooks`.

- [ ] **Step 3: Router** — add `organisation: { create, find, get, update, delete }` and `instance: { ... }` keys to `webhookRouter`.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p packages/trpc/tsconfig.json && npm run lint
git add -A packages/lib/server-only/webhooks packages/trpc/server/webhook-router
git commit -m "feat(webhooks): organisation and instance scoped webhook procedures"
```

---

### Task 10: Re-enable upstream's OpenAPI meta on organisation + team routes

**Files:**
- Modify: 17 files in `packages/trpc/server/organisation-router/` and 12 in `team-router/` (`*.ts` and `*.types.ts`)

- [ ] **Step 1: Uncomment**

```bash
cd packages/trpc/server
for f in organisation-router/*.ts team-router/*.ts; do
  sed -i '' -E 's|^(\s*)//\s*(\.meta\()|\1\2|' "$f"
  sed -i '' -E 's|^// (export const [a-zA-Z]+Meta: TrpcOpenApiMeta = \{)|\1|; s|^//(\s+openapi: \{)|\1|; s|^//(\s+method:)|\1|; s|^//(\s+path:)|\1|; s|^//(\s+summary:)|\1|; s|^//(\s+description:)|\1|; s|^//(\s+tags:)|\1|; s|^//(\s+\},?)|\1|; s|^// \};|};|' "$f"
done
grep -rn "TrpcOpenApiMeta" organisation-router team-router | head -3
```
Then, per file, fix by hand: the type name must be `TrpcRouteMeta` imported from `'../../trpc-instance'` (add the import), and each route file must import its `xxxMeta` from its `.types.ts`. Verify by `grep -c "^\s*\.meta(" organisation-router/*.ts team-router/*.ts` = 29 and `grep -rn "^//" organisation-router/*.types.ts team-router/*.types.ts | grep -i openapi` = none.

- [ ] **Step 2: Fix path collisions and stale placeholders**

Run `npx tsx -e "import('./packages/trpc/server/open-api').then(m=>console.log(Object.keys(m.openApiDocument.paths).filter(p=>p.startsWith('/organisation')||p.startsWith('/team')).join('\n')))"` (from repo root with env loaded via `npm run with:env --`). Fix any duplicates, and fix `get-organisation.types.ts` path `/organisation/{teamReference}` → `/organisation/{organisationReference}`. Every input schema whose path has `{param}` must have that key.

- [ ] **Step 3: `team.create` returns the new team**

`create-team.types.ts`: `ZCreateTeamResponseSchema = z.object({ id: z.number(), url: z.string() })`. In `create-team.ts`, return `{ id: team.id, url: team.url }` from the created team (adjust the lib call to return it if it currently returns void — check `packages/lib/server-only/team/create-team.ts`).

- [ ] **Step 4: Typecheck, lint, smoke the OpenAPI doc**

```bash
npx tsc --noEmit -p packages/trpc/tsconfig.json && npm run lint
npm run with:env -- npx tsx -e "import('./packages/trpc/server/open-api').then(m=>console.log(Object.keys(m.openApiDocument.paths).length))"
```
Expected: count increased by 29 + Task 8/9 routes.

- [ ] **Step 5: Commit**

```bash
git add packages/trpc/server/organisation-router packages/trpc/server/team-router packages/lib/server-only/team
git commit -m "feat(api): expose organisation and team management over OpenAPI"
```

---

### Task 11: OpenAPI meta for the curated admin set

**Files:**
- Modify: `packages/trpc/server/admin-router/{get-user,create-user,update-user,delete-user,enable-user,disable-user,find-admin-organisations,get-admin-organisation,create-admin-organisation,update-admin-organisation,delete-organisation,get-admin-team,find-organisation-stats,admin-search}.ts` + `.types.ts`

- [ ] **Step 1: Add meta to each `.types.ts`** — pattern:

```ts
import type { TrpcRouteMeta } from '../trpc-instance';

export const createUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/create',
    summary: 'Create user',
    description: 'Create a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};
```

Paths: `GET /admin/user/{id}`, `POST /admin/user/create`, `POST /admin/user/{id}/update`, `POST /admin/user/{id}/delete`, `POST /admin/user/{id}/enable`, `POST /admin/user/{id}/disable`, `GET /admin/organisation` (find), `GET /admin/organisation/{organisationId}`, `POST /admin/organisation/create`, `POST /admin/organisation/{organisationId}/update`, `POST /admin/organisation/{organisationId}/delete`, `GET /admin/team/{teamId}`, `GET /admin/organisation/{organisationId}/stats`, `GET /admin/search`. Check each input schema's key names match the `{param}` names (rename the param in the path to match the schema, never the other way).

- [ ] **Step 2: `.meta(xxxMeta)` on each route**, then typecheck + lint + commit

```bash
git add packages/trpc/server/admin-router
git commit -m "feat(api): expose curated admin procedures over OpenAPI for INSTANCE tokens"
```

---

### Task 12: OpenAPI document — header documentation

**Files:**
- Modify: `packages/trpc/server/open-api.ts`

- [ ] **Step 1: Extend the description**

```ts
    description: [
      'Welcome to the Documenso v2 API.',
      '',
      'This API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.',
      '',
      '## Token scopes',
      '',
      '- **TEAM** tokens act inside one team. Headers are ignored.',
      '- **ORGANISATION** tokens act inside one organisation. Pass `x-team-id: <id>` to call team-scoped endpoints for a team in that organisation.',
      '- **INSTANCE** tokens act anywhere. Pass `x-team-id` and/or `x-organisation-id` to target a tenant. Only INSTANCE tokens (or session admins) may call `/admin/*` endpoints.',
      '',
      'Team-scoped endpoints return `400` when an ORGANISATION or INSTANCE token omits `x-team-id`. Cross-tenant references return `403`.',
    ].join('\n'),
```

- [ ] **Step 2: Commit**

```bash
git add packages/trpc/server/open-api.ts
git commit -m "docs(api): document token scopes and tenant headers in OpenAPI"
```

---

### Task 13: Playwright — scoped token matrix

**Files:**
- Create: `packages/app-tests/e2e/api/v2/scoped-tokens.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  createInstanceApiToken,
  createOrganisationApiToken,
} from '@documenso/lib/server-only/public-api/create-scoped-api-token';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

const baseUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`;

test.describe.configure({ mode: 'parallel' });

test.describe('Scoped API tokens', () => {
  test('matrix: team / org / instance tokens across endpoint classes', async ({ request }) => {
    const { user: owner, team, organisation } = await seedTeam();
    const { team: foreignTeam, organisation: foreignOrg } = await seedTeam();
    const { user: admin } = await seedUser({ isAdmin: true });

    const teamToken = (await createApiToken({ userId: owner.id, teamId: team.id, tokenName: 't', expiresIn: null })).token;
    const orgToken = (await createOrganisationApiToken({ userId: owner.id, organisationId: organisation.id, tokenName: 'o', expiresIn: null })).token;
    const instanceToken = (await createInstanceApiToken({ userId: admin.id, tokenName: 'i', expiresIn: null })).token;

    const get = (path: string, token: string, headers: Record<string, string> = {}) =>
      request.get(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}`, ...headers } });

    // Team endpoint (document/find)
    expect((await get('/document', teamToken)).status()).toBe(200);
    expect((await get('/document', orgToken)).status()).toBe(400); // no x-team-id
    expect((await get('/document', orgToken, { 'x-team-id': String(team.id) })).status()).toBe(200);
    expect((await get('/document', orgToken, { 'x-team-id': String(foreignTeam.id) })).status()).toBe(403);
    expect((await get('/document', instanceToken)).status()).toBe(400);
    expect((await get('/document', instanceToken, { 'x-team-id': String(foreignTeam.id) })).status()).toBe(200);

    // Org endpoint (organisation/get)
    expect((await get(`/organisation/${organisation.id}`, teamToken)).status()).toBe(403);
    expect((await get(`/organisation/${organisation.id}`, orgToken)).status()).toBe(200);
    expect((await get(`/organisation/${foreignOrg.id}`, orgToken)).status()).toBe(403);
    expect((await get(`/organisation/${foreignOrg.id}`, instanceToken, { 'x-organisation-id': foreignOrg.id })).status()).toBe(200);

    // Admin endpoint
    expect((await get(`/admin/user/${owner.id}`, teamToken)).status()).toBe(403);
    expect((await get(`/admin/user/${owner.id}`, orgToken)).status()).toBe(403);
    expect((await get(`/admin/user/${owner.id}`, instanceToken)).status()).toBe(200);

    // v1 rejects non-team tokens
    expect((await request.get(`${NEXT_PUBLIC_WEBAPP_URL()}/api/v1/documents`, { headers: { Authorization: `Bearer ${orgToken}` } })).status()).toBe(403);
  });

  test('instance token creates org → team → document', async ({ request }) => {
    const { user: admin } = await seedUser({ isAdmin: true });
    const { user: ownerToBe } = await seedUser();
    const token = (await createInstanceApiToken({ userId: admin.id, tokenName: 'i', expiresIn: null })).token;
    const auth = { Authorization: `Bearer ${token}` };

    const orgRes = await request.post(`${baseUrl}/admin/organisation/create`, {
      headers: auth,
      data: { ownerUserId: ownerToBe.id, data: { name: 'Acme' } },
    });
    expect(orgRes.status()).toBe(200);
    const { organisationId } = await orgRes.json();

    const teamRes = await request.post(`${baseUrl}/team/create`, {
      headers: { ...auth, 'x-organisation-id': organisationId },
      data: { organisationId, teamName: 'Sales', teamUrl: `sales-${Date.now()}`, inheritMembers: true },
    });
    expect(teamRes.status()).toBe(200);
    const { id: teamId } = await teamRes.json();

    const docRes = await request.get(`${baseUrl}/document`, { headers: { ...auth, 'x-team-id': String(teamId) } });
    expect(docRes.status()).toBe(200);
  });
});
```

- [ ] **Step 2: Run**

```bash
npm run build -w @documenso/remix && E2E_TEST_PATH=e2e/api/v2/scoped-tokens.spec.ts npm run test:e2e -w @documenso/app-tests
```
Expected: 2 passed. If a status differs, the *test* documents the spec — fix the code.

- [ ] **Step 3: Commit**

```bash
git add packages/app-tests/e2e/api/v2/scoped-tokens.spec.ts
git commit -m "test(api): scoped token access matrix"
```

---

### Task 14: Playwright — webhook fan-out

**Files:**
- Create: `packages/app-tests/e2e/api/v2/scoped-webhooks.spec.ts`

- [ ] **Step 1: Write the test** (uses `buildWebhookDeliveryWhere` through the real lookup — no HTTP receiver needed)

```ts
import { getAllWebhooksByEventTrigger } from '@documenso/lib/server-only/webhooks/get-all-webhooks-by-event-trigger';
import { createInstanceWebhook, createOrganisationWebhook } from '@documenso/lib/server-only/webhooks/scoped/create-scoped-webhook';
import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { WebhookTriggerEvents } from '@prisma/client';
import { expect, test } from '@playwright/test';

test('event on a team reaches team, org and instance webhooks but not a foreign team', async () => {
  const { user: owner, team, organisation } = await seedTeam();
  const { user: foreignOwner, team: foreignTeam } = await seedTeam();
  const { user: admin } = await seedUser({ isAdmin: true });

  const base = { webhookUrl: 'https://example.com/hook', eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED], secret: null, enabled: true };

  const teamHook = await createWebhook({ ...base, userId: owner.id, teamId: team.id });
  const orgHook = await createOrganisationWebhook({ ...base, userId: owner.id, organisationId: organisation.id });
  const instanceHook = await createInstanceWebhook({ ...base, userId: admin.id });
  const foreignHook = await createWebhook({ ...base, userId: foreignOwner.id, teamId: foreignTeam.id });

  const ids = (await getAllWebhooksByEventTrigger({ event: WebhookTriggerEvents.DOCUMENT_CREATED, teamId: team.id })).map((w) => w.id);

  expect(ids).toEqual(expect.arrayContaining([teamHook.id, orgHook.id, instanceHook.id]));
  expect(ids).not.toContain(foreignHook.id);
});
```

- [ ] **Step 2: Run, commit**

```bash
E2E_TEST_PATH=e2e/api/v2/scoped-webhooks.spec.ts npm run test:e2e -w @documenso/app-tests
git add packages/app-tests/e2e/api/v2/scoped-webhooks.spec.ts
git commit -m "test(webhooks): tenant fan-out"
```

---

### Task 15: UI — scope-aware dialogs

**Files:**
- Modify: `apps/remix/app/components/dialogs/token-create-dialog.tsx`, `token-delete-dialog.tsx`, `webhook-create-dialog.tsx`, `webhook-edit-dialog.tsx`, `webhook-delete-dialog.tsx`

- [ ] **Step 1: Define the scope prop type** in a new `apps/remix/app/components/dialogs/scoped-dialog-props.ts`:

```ts
export type DialogScope =
  | { kind: 'team' }
  | { kind: 'organisation'; organisationId: string }
  | { kind: 'instance' };
```

- [ ] **Step 2: `token-create-dialog.tsx`** — add `scope?: DialogScope` prop (default `{ kind: 'team' }`). Replace `useCurrentTeam()` with `useOptionalCurrentTeam()`. Set up all three mutations and pick in `onSubmit`:

```ts
  const createTeamToken = trpc.apiToken.create.useMutation();
  const createOrgToken = trpc.apiToken.organisation.create.useMutation();
  const createInstanceToken = trpc.apiToken.instance.create.useMutation();

  const onSubmit = async ({ tokenName, expirationDate }: TCreateTokenFormSchema) => {
    const expiration = expirationDate === NEVER_EXPIRE ? null : expirationDate;

    try {
      const { token } = await match(scope)
        .with({ kind: 'team' }, () => {
          if (!team) throw new Error('No team in context');
          return createTeamToken.mutateAsync({ teamId: team.id, tokenName, expirationDate: expiration });
        })
        .with({ kind: 'organisation' }, ({ organisationId }) =>
          createOrgToken.mutateAsync({ organisationId, tokenName, expirationDate: expiration }),
        )
        .with({ kind: 'instance' }, () => createInstanceToken.mutateAsync({ tokenName, expirationDate: expiration }))
        .exhaustive();

      setCreatedToken(token);
```

In the "token created" view add, when `scope.kind !== 'team'`:

```tsx
  <p className="text-muted-foreground mt-2 text-xs">
    <Trans>
      Send <code>x-team-id: &lt;teamId&gt;</code> to call team endpoints with this token
      {scope.kind === 'instance' ? <> and <code>x-organisation-id</code> to target an organisation</> : null}.
    </Trans>
  </p>
```

- [ ] **Step 3: `token-delete-dialog.tsx`** — same `scope` prop; pick between `trpc.apiToken.delete` (`{ id, teamId }`), `trpc.apiToken.organisation.delete` (`{ id, organisationId }`), `trpc.apiToken.instance.delete` (`{ id }`).

- [ ] **Step 4: `webhook-create-dialog.tsx`, `webhook-edit-dialog.tsx`, `webhook-delete-dialog.tsx`** — same pattern: `scope` prop, `useOptionalCurrentTeam`, three mutations picked with `match(scope)`. The org variants add `organisationId` to the input; instance variants omit it. On success, invalidate the matching `find`/`getTeamWebhooks` query via `trpc.useUtils()`.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npx tsc --noEmit -p apps/remix/tsconfig.json && npm run lint
git add apps/remix/app/components/dialogs
git commit -m "feat(ui): token and webhook dialogs accept a scope"
```

---

### Task 16: UI — org settings pages + nav

**Files:**
- Create: `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.tokens.tsx`, `o.$orgUrl.settings.webhooks._index.tsx`
- Modify: `packages/lib/utils/settings-nav.ts:140-160`

- [ ] **Step 1: Tokens page** — copy `t.$teamUrl+/settings.tokens.tsx`, then:
  - `const organisation = useCurrentOrganisation();` (from `@documenso/lib/client-only/providers/organisation`) instead of team.
  - `isUnauthorized = !canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole)` (helper in `@documenso/lib/utils/organisations`).
  - Query: `trpc.apiToken.organisation.find.useQuery({ organisationId: organisation.id }, { enabled: !isUnauthorized })`.
  - `<TokenCreateDialog scope={{ kind: 'organisation', organisationId: organisation.id }} />` and `<TokenDeleteDialog scope={...} token={row.original} />`.
  - Subtitle: `Create and manage organisation-wide API tokens. Pass an x-team-id header to act inside a team.`

- [ ] **Step 2: Webhooks page** — copy `t.$teamUrl+/settings.webhooks._index.tsx`; query `trpc.webhook.organisation.find.useQuery({ organisationId })`; links point to `/o/${organisation.url}/settings/webhooks` (no per-id page — edit via dialog); pass `scope` into the three dialogs.

- [ ] **Step 3: Nav** — in `settings-nav.ts` after the `groups` entry add:

```ts
          {
            key: 'tokens',
            path: `/o/${organisation.url}/settings/tokens`,
            label: msg`API Tokens`,
            icon: BracesIcon,
          },
          {
            key: 'webhooks',
            path: `/o/${organisation.url}/settings/webhooks`,
            label: msg`Webhooks`,
            icon: WebhookIcon,
          },
```

- [ ] **Step 4: Run the app and click through**

```bash
npm run dev
```
Open `/o/<orgUrl>/settings/tokens`, create an org token, delete it; same for webhooks.

- [ ] **Step 5: Commit**

```bash
git add apps/remix/app/routes/_authenticated+/o.\$orgUrl.settings.tokens.tsx "apps/remix/app/routes/_authenticated+/o.\$orgUrl.settings.webhooks._index.tsx" packages/lib/utils/settings-nav.ts
git commit -m "feat(ui): organisation API tokens and webhooks settings pages"
```

---

### Task 17: UI — admin pages + nav

**Files:**
- Create: `apps/remix/app/routes/_authenticated+/admin+/tokens.tsx`, `admin+/webhooks.tsx`
- Modify: `apps/remix/app/routes/_authenticated+/admin+/_layout.tsx:134-144`

- [ ] **Step 1: Pages** — copy the org pages from Task 16; queries `trpc.apiToken.instance.find.useQuery()` / `trpc.webhook.instance.find.useQuery()`; `scope={{ kind: 'instance' }}`; no unauthorized branch (admin layout already gates). Token table adds a `Created by` column showing `row.original.user.email`.

- [ ] **Step 2: Nav** — after the Email Transports button add two buttons following the same markup for `/admin/tokens` (`BracesIcon`, `API Tokens`) and `/admin/webhooks` (`WebhookIcon`, `Webhooks`).

- [ ] **Step 3: Click through in dev, commit**

```bash
git add "apps/remix/app/routes/_authenticated+/admin+/tokens.tsx" "apps/remix/app/routes/_authenticated+/admin+/webhooks.tsx" "apps/remix/app/routes/_authenticated+/admin+/_layout.tsx"
git commit -m "feat(ui): admin instance API tokens and webhooks pages"
```

---

### Task 18: Translations, full verification, PR

- [ ] **Step 1: Extract translations**

```bash
npm run translate:extract   # check package.json for the exact script name
npm run translate:compile
git add packages/lib/translations
git commit -m "chore(i18n): extract new strings"
```

- [ ] **Step 2: Full checks**

```bash
npm run lint
npm run test -w @documenso/lib
npm run build -w @documenso/remix
E2E_TEST_PATH=e2e/api npm run test:e2e -w @documenso/app-tests
```
Expected: all green. The pre-existing v1/v2 API tests must still pass — they exercise TEAM tokens end to end (migration compatibility).

- [ ] **Step 3: Push and open PR against the fork's `main`**

```bash
git push -u origin feat/scoped-api
gh pr create --repo hillmarkets/documenso --base main --title "feat: instance- and organisation-scoped API tokens and webhooks" --body-file docs/superpowers/specs/2026-09-18-instance-and-org-scoped-api-design.md
```
