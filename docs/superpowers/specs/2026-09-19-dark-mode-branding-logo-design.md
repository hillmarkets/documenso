# Dark-Mode Branding Logo

**Date:** 2026-09-19
**Status:** Approved, not yet implemented
**Base:** fork `main` at `46a01a5` (upstream v2.18.0 + scoped API + enterprise removal)

## Problem

Custom branding accepts one logo. The app's theme follows the viewer (a
`remix-themes` cookie, or the system preference for logged-out recipients), so
a logo drawn for a light background disappears on the dark theme and vice
versa. Recipients on dark system settings open a signing page with an invisible
logo.

Emails have the same problem in a weaker form: mail clients apply their own
dark-mode transforms, which we cannot detect server-side.

## Goals

1. Let an organisation or team upload an optional second logo for dark mode.
2. Show the right logo on every in-app surface, with no flash and no JavaScript.
3. Change nothing for organisations that do not upload a dark logo.
4. Make emails legible under client-side dark mode, best effort.

## Non-goals

- Exposing the dark logo over the public API (`brandingLogo` is not exposed
  either).
- Forcing a theme on recipient pages.
- Favicon, PDF or signing-certificate rendering — none use the branding logo.
- A dark variant for email; see "Emails".

## Semantics

The dark logo is optional and secondary. The **effective dark logo** is
`brandingLogoDark || brandingLogo`. The two logos are independent uploads with
independent clear actions: clearing one never clears the other.

## Design

### 1. Schema and inheritance

Add `brandingLogoDark` next to `brandingLogo` on both settings models, stored in
the same `JSON.stringify({ type, data })` file-reference format:

| Model | Column | Meaning |
|---|---|---|
| `OrganisationGlobalSettings` | `brandingLogoDark String @default("")` | `""` = none |
| `TeamGlobalSettings` | `brandingLogoDark String?` | `null` = inherit from organisation |

One additive migration: two `ADD COLUMN`s, no backfill. Existing rows get `""`
and `NULL`.

`packages/lib/server-only/team/get-team-settings.ts` copies `brandingLogoDark`
from the organisation inside the existing `brandingEnabled === null` inherit
block. The default-settings tables in `packages/lib/utils/organisations.ts` and
`packages/lib/utils/teams.ts` gain the field (`""` and `null` respectively).

### 2. Serving

Extend the two existing loaders rather than adding routes:

- `GET /api/branding/logo/team/:teamId?variant=dark`
- `GET /api/branding/logo/organisation/:orgId?variant=dark`

| `variant` | Served |
|---|---|
| `dark` | `brandingLogoDark` if set, else `brandingLogo` |
| absent or any other value | `brandingLogo` (unchanged) |

The ETag is computed from the file reference actually served, so a fallback
dark response and the light response share an ETag and cache together.
`Cache-Control` is unchanged.

### 3. Upload

Extend the existing `updateBrandingLogo` mutations (organisation and team) in
place. Request schema gains:

- `brandingLogoDark`: optional image file (`zfdBrandingImageFile()`), optimised
  by the existing `buildBrandingLogoData`.
- `clearBrandingLogo`, `clearBrandingLogoDark`: optional booleans. Needed
  because multipart cannot distinguish "not touched" from "remove".

Today the mutation treats an absent `brandingLogo` as "clear". That cannot
survive a second logo in the same request (a dark-only upload would wipe the
light logo), so the mutation moves to explicit clears. Write rules, each logo
independent:

| Input | Write |
|---|---|
| `brandingLogo` file present | `brandingLogo` = new reference |
| `clearBrandingLogo = true` | `brandingLogo` = `""` |
| `brandingLogoDark` file present | `brandingLogoDark` = new reference |
| `clearBrandingLogoDark = true` | `brandingLogoDark` = `""` |
| a logo's file absent and its clear flag absent | that column untouched |

The only callers are the two settings routes, which are updated in the same
change to send `clearBrandingLogo=true` where they previously sent an empty
form. The custom-branding entitlement check applies to setting either logo;
clearing is always allowed.

### 4. In-app rendering

New component `apps/remix/app/components/general/branding-logo-image.tsx`:

```tsx
<BrandingLogoImage scope="team" | "organisation" id={...} alt={...} className={...} />
```

It renders two `<img>` elements for the same URL, one with `?variant=dark`:

- light: `className="… dark:hidden"`
- dark: `className="… hidden dark:block"`

The swap is driven by the `dark` class that `remix-themes` already sets on
`<html>`, so it is correct for logged-out recipients, has no theme flash and
needs no JavaScript. Both requests are ETag-cached; with no dark logo the second
request serves the light file, so the page degrades to today's behaviour.

Call sites that switch to the component:

- `components/general/document-signing/document-signing-page-view-v1.tsx`
- `components/general/envelope-signing/envelope-signer-header.tsx`
- `components/general/envelope-editor/envelope-editor-header.tsx`
- `components/forms/branding-preferences-form.tsx` (saved-logo preview)

The `alt` text and sizing classes at each call site are preserved.

### 5. Settings form

In `branding-preferences-form.tsx` the "Branding Logo" tile becomes two tiles,
side by side from `md:` and stacked below:

- **Logo** — unchanged.
- **Dark mode logo** *(optional)* — same upload/preview/clear controls. The
  preview tile is rendered on a dark surface (`bg-zinc-900`) so the result is
  visible regardless of the editor's current theme. Helper text: "Shown instead
  of the logo when the viewer's theme is dark. Leave empty to reuse the logo."

Form schema gains `brandingLogoDark: File | null | undefined` with the same
tri-state as `brandingLogo` (`File` = upload, `null` = clear, `undefined` =
untouched). The submit handler in both settings routes maps `null` to the
matching `clear…` flag and calls the mutation once when either logo changed. Both tiles use `InheritableField`; "Reset to
defaults" clears both; `isResetToDefaultsVisible` also considers
`brandingLogoDark`.

### 6. Emails

`packages/email/template-components/template-branding-logo.tsx` wraps the
custom-branding `<Img>` in a white plate — an inline-styled container
(`background: #ffffff; padding: 8px 12px; border-radius: 6px; display:
inline-block`) — so client-side dark-mode inversion leaves a legible logo.
The default Documenso-logo path and the branding-URL link wrapper are
unchanged. No dark image is used in email.

### 7. Error handling

- Invalid dark image → same `AppError(INVALID_BODY, "The branding logo must be a
  valid image file.")` as the light path.
- Serving a dark variant whose stored file is missing falls through to the
  existing 404 branch; it does not silently fall back to light, so a broken
  upload is visible.
- Unknown `variant` values are treated as absent.

### 8. Tests

- **vitest**
  - `get-team-settings`: team with `brandingEnabled === null` inherits
    `brandingLogoDark`; team with its own settings does not.
  - Serving loader matrix: dark set → dark reference; dark unset → light
    reference with the light ETag; no variant → light; unknown variant → light.
- **E2E** (`packages/app-tests/e2e`)
  - Extend `branding-logo-upload.spec.ts`: upload a dark logo; with the theme
    cookie set to dark the visible `<img>` is the `?variant=dark` URL and it
    serves the dark bytes; with light theme the light URL is visible; clearing
    the dark logo makes `?variant=dark` serve the light bytes again.
  - Extend `signing-branding.spec.ts`: recipient signing page in dark theme
    shows the dark logo.
- `npx tsc --noEmit` for `lib`, `trpc`, `remix`; Biome; lingui catalog
  extraction for the new strings.

## Implementation notes

- Keep every change additive so upstream merges stay cheap: no renames of
  `brandingLogo`, no new routes, no new tRPC procedures.
- The migration lands under `packages/prisma/migrations/` with the usual
  timestamped name and is forward-only, like all Documenso migrations. It is
  safe to run against production without a maintenance window.
