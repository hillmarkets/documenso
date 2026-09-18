# Instance- and Organisation-Scoped API

**Date:** 2026-09-18
**Status:** Implemented on `feat/scoped-api` (see "Implementation notes" at the end)
**Base:** documenso v2.18.0 (`e658cc5`)

## Problem

Documenso's API is team-scoped only. `ApiToken.teamId` and `Webhook.teamId` are
non-nullable, every v2 procedure resolves `ctx.teamId` from the token, and
`adminMiddleware` is session-only. There is no way for a backend service to:

- act across all teams and organisations on a self-hosted instance,
- create, update, or delete organisations programmatically,
- receive webhooks for events across an organisation or the whole instance.

## Goals

1. **Instance-scoped API tokens** that can do everything, including organisation
   lifecycle, user management, and acting inside any team.
2. **Organisation-scoped API tokens** that span all teams within one organisation.
3. **Organisation-level and instance-level webhooks.**
4. Keep divergence from upstream small enough that pulling upstream stays cheap.

## Non-goals

- Path-based tenant routing (`/organisations/{id}/teams/{id}/...`) for existing
  endpoints. Tenant targeting uses headers; see "Decision: headers" below.
- Exposing every admin procedure over HTTP. A curated subset only.
- Env-var master keys or a bootstrap key. Tokens are DB-managed.
- Changes to the team-scoped API's behaviour or signatures.

## Decision: headers for tenant targeting

Tenant targeting for existing team-scoped endpoints is done with `x-team-id`
and `x-organisation-id` request headers (the Stripe Connect `Stripe-Account`
pattern). Rationale:

- The v2 API is generated from tRPC routers by `trpc-to-openapi`, one fixed
  path per procedure. Path-based tenancy would require a parallel hand-written
  router layer for ~80 procedures that must be kept in sync with upstream.
- Actor (who the caller is) and target (which tenant) are orthogonal; headers
  keep every route signature tenant-agnostic.
- Headers are resolved in exactly one place (the auth middleware) into a typed
  `ctx.scope`. If path-based routing is wanted later, it is an additive change
  to how `ctx.scope` is populated, not a rewrite.

New instance/org-only endpoints that have no upstream equivalent use
conventional REST paths since there is nothing to diverge from.

## 1. Data model

```prisma
enum ApiTokenScope {
  INSTANCE
  ORGANISATION
  TEAM
}

model ApiToken {
  id             Int            @id @default(autoincrement())
  name           String
  token          String         @unique
  algorithm      ApiTokenAlgorithm @default(SHA512)
  scope          ApiTokenScope  @default(TEAM)
  expires        DateTime?
  createdAt      DateTime       @default(now())
  lastUsedAt     DateTime?
  userId         Int?
  user           User?          @relation(...)
  teamId         Int?           // set iff scope = TEAM
  team           Team?          @relation(...)
  organisationId String?        // set iff scope = ORGANISATION
  organisation   Organisation?  @relation(...)
}

enum WebhookScope {
  INSTANCE
  ORGANISATION
  TEAM
}

model Webhook {
  ...
  scope          WebhookScope   @default(TEAM)
  userId         Int            // creator, audit only; not used for delivery
  teamId         Int?           // set iff scope = TEAM
  organisationId String?        // set iff scope = ORGANISATION
}
```

**Invariants** (enforced in the create procedures and by a DB check constraint):

| scope        | teamId | organisationId | userId   |
|--------------|--------|----------------|----------|
| TEAM         | set    | null           | optional |
| ORGANISATION | null   | set            | optional |
| INSTANCE     | null   | null           | required (an `ADMIN` user) |

Migration: add columns with defaults; every existing row becomes `TEAM` with no
data change. `teamId` is made nullable; the existing FK and cascade remain.

**Acting user.** `ctx.user` is always a real `User` row; every procedure and audit
log depends on it.

| Token scope  | Target                    | `ctx.user`                          |
|--------------|---------------------------|-------------------------------------|
| TEAM         | token's team              | token user, else team's org owner (unchanged) |
| ORGANISATION | token's org / a team in it| org owner                           |
| INSTANCE     | a team or org (via header)| **target** org's owner              |
| INSTANCE     | instance-level operation  | the admin who owns the token        |

Using the target org's owner guarantees `buildTeamWhereQuery` membership checks
pass without touching them. The INSTANCE token's `userId` also gates validity:
disabling that admin invalidates their instance tokens.

**Rate limits.** TEAM and ORGANISATION tokens are limited by their org's claim
(`assertOrganisationRatesAndLimits`, unchanged). INSTANCE tokens bypass org
rate limits.

## 2. Scope resolution

`getApiTokenByToken` is updated to handle all three shapes (it currently
dereferences `apiToken.team.organisation` unconditionally) and returns the
token with its scope and related org/team.

`authenticatedMiddleware` (and a new INSTANCE branch in `adminMiddleware`)
builds one typed object and is the **only** code that reads the headers:

```ts
type ApiScope = {
  kind: 'instance' | 'organisation' | 'team';
  teamId: number | null;          // resolved target team
  organisationId: string | null;  // resolved target org
  apiTokenId: number;
};
```

Resolution rules:

| Token        | `x-organisation-id`            | `x-team-id`                                   |
|--------------|--------------------------------|-----------------------------------------------|
| TEAM         | ignored                        | ignored; `teamId` = token's team              |
| ORGANISATION | ignored; = token's org         | optional; must belong to token's org else 403 |
| INSTANCE     | optional                       | optional; if set, `organisationId` derived from the team |

`ctx.teamId` is populated from `ctx.scope.teamId`, so the ~80 existing
team-scoped procedures need no changes. A procedure that requires a team and
receives `null` fails with 400 before touching the DB (helper
`requireTeamScope(ctx)`, applied via a shared middleware on team-scoped
routers rather than per-procedure).

`packages/api/v1` is gated to TEAM tokens only; other scopes receive 403.

## 3. Webhook fan-out

**Matching is separated from authorization.**

Delivery (`getAllWebhooksByEventTrigger`) becomes a pure tenant query with no
`userId`:

```
event on team T delivers to:
  webhooks WHERE enabled AND event ∈ eventTriggers AND (
    (scope = TEAM         AND teamId = T.id)
 OR (scope = ORGANISATION AND organisationId = T.organisationId)
 OR (scope = INSTANCE)
  )
```

Each matched webhook fires its own `internal.execute-webhook` job (unchanged).
`userId` is removed from `triggerWebhook`, its zod schema
(`packages/lib/server-only/webhooks/trigger/schema.ts`), and all 19 call sites.

Payloads gain top-level `teamId` and `organisationId` so org/instance
receivers can attribute the event.

Authorization lives on the management procedures only:

| Webhook scope | Who may create/update/delete                      |
|---------------|---------------------------------------------------|
| TEAM          | team admin/manager (unchanged), ORG token, INSTANCE token |
| ORGANISATION  | org admin/owner (session), ORG token, INSTANCE token |
| INSTANCE      | session `ADMIN` user, INSTANCE token              |

"No matching webhooks" is a normal outcome, logged at debug, never an error.

## 4. API surface (`/api/v2`)

### A. Existing team-scoped endpoints (~80)

Unchanged signatures. Newly callable by ORGANISATION tokens (with `x-team-id`)
and INSTANCE tokens (with `x-team-id`).

### B. Organisation and team management (29 routes)

Upstream wrote OpenAPI meta for 17 organisation and 12 team routes but left it
commented out (`// .meta(...)`, `//   openapi: {`). Re-enable it, using the
paths upstream chose (`/organisation/{organisationId}`, `/team/{teamId}`, ...).

Access: session users with the appropriate org/team role (unchanged logic),
ORGANISATION tokens for their own org, INSTANCE tokens for any org.

`organisation.create` via INSTANCE token requires an explicit owner:
`ownerUserId` or `ownerEmail` (user created if absent). Billing/checkout
branches are skipped when `IS_BILLING_ENABLED()` is false.

### C. Instance-level endpoints (INSTANCE tokens and session admins)

A curated subset of the admin router, exposed with new OpenAPI meta:

- `admin.users.find | get | create | disable | enable | delete`
- `admin.organisations.find | get`
- `admin.tokens.create | list | revoke` — mint ORGANISATION and INSTANCE tokens
- `admin.webhooks.create | list | update | delete` — INSTANCE webhooks
- `admin.stats`

Deliberately **not** exposed (remain session-only): document surgery
(`deleteDocument`, `findUnsealedDocuments`, audit-log download), Stripe and
subscription-claim management, email-domain registration.

### D. Organisation-level token and webhook management

- `organisation.tokens.create | list | revoke`
- `organisation.webhooks.create | list | get | update | delete`

Access: org admin/owner (session), ORGANISATION token, INSTANCE token.

### Documentation

Every endpoint's OpenAPI description states which token scopes may call it and
whether `x-team-id` / `x-organisation-id` is required.

## 5. UI

Copies of the existing team pages, pointed at the new procedures:

- `/o/{orgUrl}/settings/tokens` and `/o/{orgUrl}/settings/webhooks` — org
  admins/owners. Source: `t.$teamUrl+/settings.tokens.tsx`,
  `t.$teamUrl+/settings.webhooks.*`.
- `/admin/tokens` and `/admin/webhooks` — INSTANCE scope, admin layout.
- Token-create dialogs show the scope and, for org/instance tokens, a one-line
  hint about the `x-team-id` / `x-organisation-id` headers.

Existing team pages are untouched.

## 6. Error handling

| Condition                                                   | Response |
|-------------------------------------------------------------|----------|
| Unknown, expired, or disabled-user token                    | 401 (unchanged) |
| Token scope cannot reach target (ORG token → foreign team; TEAM token → org endpoint; non-INSTANCE → admin endpoint) | 403, message names the required scope |
| Team-scoped endpoint, ORG/INSTANCE token, no `x-team-id`    | 400 `x-team-id header is required for ORGANISATION and INSTANCE tokens on this endpoint` |
| `x-team-id` / `x-organisation-id` not found                 | 404 |
| v1 with non-TEAM token                                       | 403 `API v1 only supports team-scoped tokens; use /api/v2` |
| Webhook delivery finds no matches                            | not an error |

## 7. Testing

**Unit (vitest):**
- Scope resolution table: (token scope × header combination) → `ctx.scope` or
  expected error code.
- Webhook matching query across team / org / instance webhooks and a foreign
  team.
- Token create invariant: exactly one FK shape per scope.

**Integration (Playwright, `packages/app-tests`):**
- Seed one token per scope. For each, call a team endpoint, an org endpoint,
  and an admin endpoint; assert status per the §6 matrix.
- End-to-end: INSTANCE token creates org → creates team → creates document;
  org webhook and instance webhook each receive `DOCUMENT_CREATED`; a team
  webhook on an unrelated team does not.
- Migration: seeded TEAM tokens and webhooks behave identically post-migration.

## 8. Repo setup (first implementation step)

The working copy is a `--depth 1` clone with `origin` pointing at upstream.
Before any code:

1. Fork `documenso/documenso` to the user's GitHub account.
2. `git fetch --unshallow`.
3. `origin` → the fork; `upstream` → `documenso/documenso`.
4. Work on a feature branch off `main`.

## Files most affected

- `packages/prisma/schema.prisma` + migration
- `packages/lib/server-only/public-api/get-api-token-by-token.ts`
- `packages/trpc/server/trpc.ts` (`authenticatedMiddleware`, `adminMiddleware`)
- `packages/trpc/server/context.ts`
- `packages/lib/server-only/webhooks/get-all-webhooks-by-event-trigger.ts`
- `packages/lib/server-only/webhooks/trigger/*` and 19 `triggerWebhook` call sites
- `packages/trpc/server/{organisation,team}-router/*` (re-enable meta)
- `packages/trpc/server/{admin,webhook,api-token}-router/*` (new meta, scope checks)
- `packages/api/v1/middleware/authenticated.ts` (TEAM-only gate)
- `apps/remix/app/routes/_authenticated+/o+/...` and `admin+/...` (new pages)

## Implementation notes

Decisions made while implementing that refine the sections above.

- **`organisation.create` is untouched.** INSTANCE callers create organisations
  through `POST /admin/organisation/create` (`admin.organisation.create`), which
  already takes `ownerUserId` and returns `organisationId`.
- **TEAM tokens are rejected from `/team/*` as well as `/organisation/*` and
  `/admin/*`.** TEAM tokens are for document work inside one team; tenant
  management is reserved for ORGANISATION and INSTANCE tokens.
- **Scope guard coverage.** `enforceApiTokenScope` checks the primary tenant keys
  in every input (`organisationId`, `organisationReference`, `teamId`,
  `teamReference`, `transferTeamId`). For ORGANISATION tokens, every team named
  in the input is verified against the database to belong to the organisation.
  Secondary references (`organisationGroupId`, `memberIds`, `invitationId`, …)
  rely on the procedure's own membership check, which the acting user (the
  organisation owner) fails for foreign tenants. **Consequence:** if one user
  owns several organisations, an ORGANISATION token for one of them could reach
  the others' groups/members through those secondary keys. Use a distinct owner
  per organisation when minting them from the instance API.
- **`update-organisation-group` and `update-team-group` stay session-only.**
  Their input is a bare group `id` that cannot be tied to a tenant by the guard.
- **Error codes.** The OpenAPI error handler maps HTTP status from
  `AppErrorCode`, not `statusCode`, so scope violations use
  `AppErrorCode.FORBIDDEN` (403) and missing headers use `INVALID_REQUEST`
  (400).
- **`team.create` now returns `{ id, url }`** instead of `void` so API callers
  can chain into the new team.
- **`/admin/organisation/stats` became `/admin/organisation-stats`** to avoid
  colliding with `/admin/organisation/{organisationId}`.
- **Webhook job payload** carries `teamId`; the delivered body gains top-level
  `teamId` and `organisationId`.
- **Repo:** GitHub forks of public repos cannot be private, so
  `hillmarkets/documenso` is a private standalone repo with `upstream` pointing
  at `documenso/documenso`. It can be made public later.
