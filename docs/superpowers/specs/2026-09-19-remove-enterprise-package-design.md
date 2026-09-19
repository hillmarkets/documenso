# Remove the Enterprise (Commercial License) package

**Date:** 2026-09-19
**Status:** Implemented on `chore/remove-enterprise`

## Why

`packages/ee` is licensed under the Documenso Commercial License, not AGPL. The
fork will be open-sourced; an AGPL-only tree removes any ambiguity and any
risk of running commercially licensed code in production without a subscription.

## Scope

Delete `packages/ee` entirely and every feature that depends on it:

| Feature | Consumers | Outcome |
|---|---|---|
| Stripe billing | 14 | Deleted. `IS_BILLING_ENABLED()` branches removed. Billing UI, admin Stripe/subscription routes, Stripe webhook route, seat sync job removed. |
| Limits (`getServerLimits`, `useLimits`) | 19 | **Rewritten fresh** in `packages/lib` (the license forbids copying). Self-host semantics: unlimited documents / recipients / direct templates; `maximumEnvelopeItemCount` still read from the organisation claim. Client provider no longer fetches; `/api/limits` removed. |
| Email domains | 5 | Deleted with org + admin settings pages and the hourly sync job. |
| CSC / TSP cloud signing | 8 | Deleted. Local certificate signing is the only signing transport. |
| SSO portal / account linking | 1 | Deleted with the org SSO settings page and OIDC portal routes. |
| `enterprise-router` (tRPC) | 11 files | Deleted. |

Out of scope: "Document Action Reauthentication" and "Embed authoring" are listed
in `packages/ee/FEATURES` but implemented in AGPL code; they stay. Whether to
remove them is a licensing question for Hill's counsel, not this change.

## Non-goals

- Keeping any billing/subscription concept. Organisations keep an
  `organisationClaim` (AGPL schema) because feature flags and
  `envelopeItemCount` live there; admin claim management stays.
- Preserving upstream-merge ease for the touched files — this change accepts
  ongoing conflicts in ~40 consumer files as the price of a clean tree.

## Verification

Typecheck (lib, trpc, remix), Biome, vitest, Remix build, full API e2e suite.
e2e specs that exercised removed features are deleted alongside them.

## Implementation notes

- **`IS_BILLING_ENABLED()` and `IS_INSTANCE_CSC_MODE()` are hard-wired to
  `false`** rather than deleted. They guard ~50 dead branches in upstream code;
  leaving those branches in place keeps the diff against upstream small, and the
  functions cost nothing.
- **AES/QES signature levels** remain in the schema (`Envelope.signatureLevel`
  is free text) but `sendDocument`, the seal job and recipient completion reject
  them with `NOT_SETUP`. The editor never offers them because CSC mode is off.
- **`OrganisationEmail` / `Subscription` / `SubscriptionClaim` models stay** in
  the Prisma schema (AGPL). Organisation emails can no longer be created (the
  routes lived in the enterprise router); existing rows are inert.
- **The AGPL Stripe client** (`packages/lib/server-only/stripe`) and the
  `stripe` npm dependency were removed too: with billing gone they only served
  to confuse.
- **Limits** were rewritten from scratch in `packages/lib/types/limits.ts`,
  `server-only/limits/get-server-limits.ts` and
  `client-only/providers/limits.tsx`. The client provider no longer fetches
  `/api/limits` (route removed); it reads `envelopeItemCount` from the
  organisation claim, which is now included in the session organisation shape.
- **`organisation.create`** now returns `{ paymentRequired: false, organisationId }`;
  `priceId` input removed.
- **CI:** the Crowdin translation workflows were removed (no token in the fork)
  and the Remix typecheck script sets a 6 GB heap; the additional OpenAPI routes
  from the scoped-API change pushed `tsc` past the runner's default.
- **Tests:** two `delete-account` e2e cases that asserted Stripe cancellation
  jobs were removed. The `license/enterprise-feature-restrictions` spec is AGPL
  admin-claims UI and stays.
