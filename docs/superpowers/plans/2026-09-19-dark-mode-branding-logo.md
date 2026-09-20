# Dark-Mode Branding Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organisation or team upload an optional second branding logo that is shown when the viewer's theme is dark, falling back to the existing logo everywhere it is not set.

**Architecture:** One additive column `brandingLogoDark` on both settings models, inherited team ← organisation exactly like `brandingLogo`. The two existing `/api/branding/logo/*` loaders learn a `?variant=dark` query that falls back to the light logo. A `BrandingLogoImage` component renders both `<img>`s and lets Tailwind's `dark:` variant (driven by the `dark` class `remix-themes` puts on `<html>`) pick one — no JS, no flash. The upload mutations gain a second file and explicit clear flags. Emails keep the light logo on a white plate.

**Tech Stack:** Prisma/Postgres, tRPC + `zod-form-data`, React Router v7 (Remix) + Tailwind, react-hook-form, Lingui, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-dark-mode-branding-logo-design.md`

**Conventions (from AGENTS.md):** `type` over `interface`; functional components; no 1-line `if`; `AppError` for thrown errors; `<Trans>` / `t\`\`` for strings; do not run `npm run build`; type-check with `npx tsc --noEmit -p <pkg>`.

---

## File map

| File | Change |
|---|---|
| `packages/prisma/schema.prisma` | add `brandingLogoDark` to `OrganisationGlobalSettings`, `TeamGlobalSettings` |
| `packages/prisma/migrations/<ts>_add_branding_logo_dark/migration.sql` | new, additive |
| `packages/lib/utils/organisations.ts` | default `brandingLogoDark: ''` |
| `packages/lib/utils/teams.ts` | default `brandingLogoDark: null` |
| `packages/lib/server-only/team/get-team-settings.ts` | inherit `brandingLogoDark` |
| `packages/lib/server-only/branding/resolve-branding-logo.ts` | **new** — pure variant/fallback resolver |
| `packages/lib/server-only/branding/resolve-branding-logo.test.ts` | **new** — vitest |
| `apps/remix/app/routes/api+/branding.logo.team.$teamId.ts` | use resolver, read `variant` |
| `apps/remix/app/routes/api+/branding.logo.organisation.$orgId.ts` | same |
| `packages/trpc/server/team-router/update-team-branding-logo.types.ts` | add `brandingLogoDark`, `clearBrandingLogo`, `clearBrandingLogoDark` |
| `packages/trpc/server/team-router/update-team-branding-logo.ts` | explicit-write semantics |
| `packages/trpc/server/organisation-router/update-organisation-branding-logo.types.ts` | same as team |
| `packages/trpc/server/organisation-router/update-organisation-branding-logo.ts` | same as team |
| `packages/lib/utils/branding-logo-form-data.ts` | **new** — builds the multipart body from form values (shared by both routes) |
| `apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.branding.tsx` | use the builder |
| `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.branding.tsx` | use the builder |
| `apps/remix/app/components/general/branding-logo-image.tsx` | **new** — light/dark `<img>` pair |
| `apps/remix/app/components/forms/branding-logo-field.tsx` | **new** — one upload tile, extracted from the form |
| `apps/remix/app/components/forms/branding-preferences-form.tsx` | two tiles via `BrandingLogoField`; `brandingLogoDark` in schema/reset |
| `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx` | `BrandingLogoImage` |
| `apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx` | `BrandingLogoImage` |
| `apps/remix/app/components/general/envelope-editor/envelope-editor-header.tsx` | `BrandingLogoImage` |
| `packages/email/template-components/template-branding-logo.tsx` | white plate |
| `packages/app-tests/e2e/branding-logo-upload.spec.ts` | dark upload / clear / fallback |
| `packages/app-tests/e2e/signing-branding.spec.ts` | dark theme on signing page |

Branch: `feat/dark-mode-branding-logo` off `main`.

---

### Task 1: Schema, migration, defaults, inheritance

**Files:**
- Modify: `packages/prisma/schema.prisma:1007` and `:1050`
- Create: `packages/prisma/migrations/20260919120000_add_branding_logo_dark/migration.sql`
- Modify: `packages/lib/utils/organisations.ts:124`
- Modify: `packages/lib/utils/teams.ts:191`
- Modify: `packages/lib/server-only/team/get-team-settings.ts:39`

- [ ] **Step 1: Add the columns to the schema**

In `OrganisationGlobalSettings` (the block with `brandingLogo String @default("")`):

```prisma
  brandingEnabled        Boolean @default(false)
  brandingLogo           String  @default("")
  brandingLogoDark       String  @default("")
  brandingUrl            String  @default("")
```

In `TeamGlobalSettings` (the block with `brandingLogo String?`):

```prisma
  brandingEnabled        Boolean?
  brandingLogo           String?
  brandingLogoDark       String?
  brandingUrl            String?
```

- [ ] **Step 2: Write the migration by hand** (no local DB is required for this step)

`packages/prisma/migrations/20260919120000_add_branding_logo_dark/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN "brandingLogoDark" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN "brandingLogoDark" TEXT;
```

- [ ] **Step 3: Regenerate the client**

Run: `npm run prisma:generate`
Expected: `✔ Generated Prisma Client` with no schema errors.

- [ ] **Step 4: Add defaults**

`packages/lib/utils/organisations.ts` — after `brandingLogo: '',`:

```ts
    brandingLogo: '',
    brandingLogoDark: '',
```

`packages/lib/utils/teams.ts` — after `brandingLogo: null,`:

```ts
    brandingLogo: null,
    brandingLogoDark: null,
```

- [ ] **Step 5: Inherit in `get-team-settings.ts`**

```ts
  if (teamSettings.brandingEnabled === null) {
    teamSettings.brandingEnabled = organisationSettings.brandingEnabled;
    teamSettings.brandingLogo = organisationSettings.brandingLogo;
    teamSettings.brandingLogoDark = organisationSettings.brandingLogoDark;
    teamSettings.brandingUrl = organisationSettings.brandingUrl;
```

- [ ] **Step 6: Type-check lib**

Run: `npx tsc --noEmit -p packages/lib`
Expected: no errors. (If `Omit<OrganisationGlobalSettings, 'id'>` literals elsewhere fail with "missing brandingLogoDark", add `brandingLogoDark: ''` there too — the defaults tables above are the only known ones.)

- [ ] **Step 7: Commit**

```bash
git add packages/prisma packages/lib/utils/organisations.ts packages/lib/utils/teams.ts packages/lib/server-only/team/get-team-settings.ts
git commit -m "feat(branding): add brandingLogoDark to organisation and team settings"
```

---

### Task 2: Variant resolver (pure) with vitest

**Files:**
- Create: `packages/lib/server-only/branding/resolve-branding-logo.ts`
- Create: `packages/lib/server-only/branding/resolve-branding-logo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveBrandingLogo } from './resolve-branding-logo';

const settings = { brandingLogo: 'light-ref', brandingLogoDark: 'dark-ref' };

describe('resolveBrandingLogo', () => {
  it('serves the light logo when no variant is given', () => {
    expect(resolveBrandingLogo(settings, null)).toBe('light-ref');
  });

  it('serves the dark logo for variant=dark', () => {
    expect(resolveBrandingLogo(settings, 'dark')).toBe('dark-ref');
  });

  it('falls back to the light logo for variant=dark when no dark logo is set', () => {
    expect(resolveBrandingLogo({ ...settings, brandingLogoDark: '' }, 'dark')).toBe('light-ref');
    expect(resolveBrandingLogo({ ...settings, brandingLogoDark: null }, 'dark')).toBe('light-ref');
  });

  it('treats unknown variants as light', () => {
    expect(resolveBrandingLogo(settings, 'sepia')).toBe('light-ref');
  });

  it('returns an empty string when nothing is set', () => {
    expect(resolveBrandingLogo({ brandingLogo: '', brandingLogoDark: '' }, 'dark')).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/lib/server-only/branding/resolve-branding-logo.test.ts`
Expected: FAIL — cannot find module `./resolve-branding-logo`.

- [ ] **Step 3: Implement**

```ts
export type BrandingLogoVariant = 'light' | 'dark';

export type BrandingLogoSettings = {
  brandingLogo: string | null;
  brandingLogoDark: string | null;
};

/**
 * Pick the stored file reference to serve for a logo request.
 *
 * `dark` returns the dark logo when one is set and otherwise falls back to the
 * light logo, so every page can request the dark variant unconditionally.
 * Anything else is the light logo.
 */
export const resolveBrandingLogo = (settings: BrandingLogoSettings, variant: string | null): string => {
  const light = settings.brandingLogo ?? '';

  if (variant !== 'dark') {
    return light;
  }

  return settings.brandingLogoDark || light;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/lib/server-only/branding/resolve-branding-logo.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/server-only/branding/resolve-branding-logo.ts packages/lib/server-only/branding/resolve-branding-logo.test.ts
git commit -m "feat(branding): resolve logo variant with light fallback"
```

---

### Task 3: Serving routes honour `?variant=dark`

**Files:**
- Modify: `apps/remix/app/routes/api+/branding.logo.team.$teamId.ts`
- Modify: `apps/remix/app/routes/api+/branding.logo.organisation.$orgId.ts`

- [ ] **Step 1: Team route**

Replace the body from the `settings` lookup down to the ETag with:

```ts
import { resolveBrandingLogo } from '@documenso/lib/server-only/branding/resolve-branding-logo';
// (add to the existing imports)

  const settings = await getTeamSettings({
    teamId,
  });

  const variant = new URL(request.url).searchParams.get('variant');
  const brandingLogo = settings ? resolveBrandingLogo(settings, variant) : '';

  if (!settings || !brandingLogo) {
    return Response.json(
      {
        status: 'error',
        message: 'Logo not found',
      },
      { status: 404 },
    );
  }

  if (!settings.brandingEnabled) {
    return Response.json(
      {
        status: 'error',
        message: 'Branding is not enabled',
      },
      { status: 400 },
    );
  }

  // Keyed on the reference actually served, so a dark request that fell back to
  // the light logo shares the light response's cache entry.
  const etag = `"${Buffer.from(sha256(brandingLogo)).toString('hex')}"`;
```

and change `getFileServerSide(JSON.parse(settings.brandingLogo))` to `getFileServerSide(JSON.parse(brandingLogo))`.

- [ ] **Step 2: Organisation route**

Open `branding.logo.organisation.$orgId.ts`; it has the same shape with `getOrganisationSettings`/`settings` (check the local variable name). Apply the identical change: read `variant`, compute `brandingLogo` via `resolveBrandingLogo`, use it in the 404 check, the ETag and `getFileServerSide`.

- [ ] **Step 3: Type-check remix**

Run: `npx tsc --noEmit -p apps/remix`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/remix/app/routes/api+/branding.logo.team.\$teamId.ts apps/remix/app/routes/api+/branding.logo.organisation.\$orgId.ts
git commit -m "feat(branding): serve ?variant=dark logo with light fallback"
```

---

### Task 4: Upload mutations — second file, explicit clears

**Files:**
- Modify: `packages/trpc/server/team-router/update-team-branding-logo.types.ts`
- Modify: `packages/trpc/server/team-router/update-team-branding-logo.ts`
- Modify: `packages/trpc/server/organisation-router/update-organisation-branding-logo.types.ts`
- Modify: `packages/trpc/server/organisation-router/update-organisation-branding-logo.ts`

- [ ] **Step 1: Team request schema**

```ts
export const ZUpdateTeamBrandingLogoRequestSchema = zodFormData({
  payload: zfd.json(
    z.object({
      teamId: z.number(),
      // Multipart cannot express "remove", so clears are explicit flags. A logo
      // whose file is absent and whose clear flag is absent is left untouched.
      clearBrandingLogo: z.boolean().optional(),
      clearBrandingLogoDark: z.boolean().optional(),
    }),
  ),
  brandingLogo: zfdBrandingImageFile().optional(),
  brandingLogoDark: zfdBrandingImageFile().optional(),
});
```

- [ ] **Step 2: Team mutation body**

Replace from `const { payload, brandingLogo } = input;` through the end of the mutation:

```ts
    const { payload, brandingLogo, brandingLogoDark } = input;
    const { teamId, clearBrandingLogo, clearBrandingLogoDark } = payload;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have permission to update this team.',
      });
    }

    // Setting a logo requires the custom-branding entitlement; clearing it is
    // always allowed so a downgraded team can still remove its logo.
    if ((brandingLogo || brandingLogoDark) && IS_BILLING_ENABLED()) {
      const claim = await getOrganisationClaimByTeamId({ teamId });

      if (claim.flags?.allowCustomBranding !== true) {
        throw new AppError(AppErrorCode.UNAUTHORIZED, {
          message: 'Your plan does not allow custom branding.',
        });
      }
    }

    const data: { brandingLogo?: string; brandingLogoDark?: string } = {};

    if (brandingLogo) {
      data.brandingLogo = await buildBrandingLogoData(brandingLogo);
    } else if (clearBrandingLogo) {
      data.brandingLogo = '';
    }

    if (brandingLogoDark) {
      data.brandingLogoDark = await buildBrandingLogoData(brandingLogoDark);
    } else if (clearBrandingLogoDark) {
      data.brandingLogoDark = '';
    }

    if (Object.keys(data).length === 0) {
      return;
    }

    await prisma.team.update({
      where: {
        id: team.id,
      },
      data: {
        teamGlobalSettings: {
          update: data,
        },
      },
    });
```

- [ ] **Step 3: Organisation schema and mutation**

Apply the same two edits to the organisation files: the schema gains `clearBrandingLogo`, `clearBrandingLogoDark` inside `payload` and `brandingLogoDark: zfdBrandingImageFile().optional()`; the mutation destructures `{ organisationId, clearBrandingLogo, clearBrandingLogoDark } = payload`, gates the entitlement on `(brandingLogo || brandingLogoDark)`, builds `data` identically, early-returns when empty, and writes `organisationGlobalSettings: { update: data }`.

- [ ] **Step 4: Type-check trpc**

Run: `npx tsc --noEmit -p packages/trpc`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/trpc/server/team-router/update-team-branding-logo.ts packages/trpc/server/team-router/update-team-branding-logo.types.ts packages/trpc/server/organisation-router/update-organisation-branding-logo.ts packages/trpc/server/organisation-router/update-organisation-branding-logo.types.ts
git commit -m "feat(branding): accept a dark logo and explicit clears on the logo mutations"
```

---

### Task 5: Shared multipart builder + settings routes

**Files:**
- Create: `packages/lib/utils/branding-logo-form-data.ts`
- Modify: `apps/remix/app/routes/_authenticated+/t.$teamUrl+/settings.branding.tsx:49-63`
- Modify: `apps/remix/app/routes/_authenticated+/o.$orgUrl.settings.branding.tsx:49-63`

- [ ] **Step 1: The builder**

```ts
/**
 * Tri-state per logo, mirroring the form: a File uploads, `null` clears,
 * `undefined` leaves the stored logo alone.
 */
export type BrandingLogoFormValues = {
  brandingLogo?: File | null;
  brandingLogoDark?: File | null;
};

/**
 * Build the multipart body for the `updateBrandingLogo` mutations. Returns null
 * when neither logo changed so the caller can skip the request.
 */
export const buildBrandingLogoFormData = (
  scope: { teamId: number } | { organisationId: string },
  values: BrandingLogoFormValues,
): FormData | null => {
  const { brandingLogo, brandingLogoDark } = values;

  const hasLogoChange = brandingLogo instanceof File || brandingLogo === null;
  const hasDarkLogoChange = brandingLogoDark instanceof File || brandingLogoDark === null;

  if (!hasLogoChange && !hasDarkLogoChange) {
    return null;
  }

  const formData = new FormData();

  formData.append(
    'payload',
    JSON.stringify({
      ...scope,
      clearBrandingLogo: brandingLogo === null ? true : undefined,
      clearBrandingLogoDark: brandingLogoDark === null ? true : undefined,
    }),
  );

  if (brandingLogo instanceof File) {
    formData.append('brandingLogo', brandingLogo);
  }

  if (brandingLogoDark instanceof File) {
    formData.append('brandingLogoDark', brandingLogoDark);
  }

  return formData;
};
```

- [ ] **Step 2: Team route submit handler**

Replace the destructure and the `if (brandingLogo instanceof File || brandingLogo === null) { … }` block with:

```ts
import { buildBrandingLogoFormData } from '@documenso/lib/utils/branding-logo-form-data';
// (add to imports)

      const {
        brandingEnabled,
        brandingLogo,
        brandingLogoDark,
        brandingUrl,
        brandingCompanyDetails,
        brandingColors,
        brandingCss,
      } = data;

      // Upload (or clear) either logo through the dedicated, server-validated route.
      const logoFormData = buildBrandingLogoFormData({ teamId: team.id }, { brandingLogo, brandingLogoDark });

      if (logoFormData) {
        await updateTeamBrandingLogo(logoFormData);
      }
```

- [ ] **Step 3: Organisation route submit handler**

Same replacement with `buildBrandingLogoFormData({ organisationId: organisation.id }, { brandingLogo, brandingLogoDark })` and `updateOrganisationBrandingLogo(logoFormData)`.

- [ ] **Step 4: Type-check** — this will fail until Task 6 adds `brandingLogoDark` to the form schema. That is expected; continue to Task 6 and type-check there.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/utils/branding-logo-form-data.ts "apps/remix/app/routes/_authenticated+/t.\$teamUrl+/settings.branding.tsx" "apps/remix/app/routes/_authenticated+/o.\$orgUrl.settings.branding.tsx"
git commit -m "feat(branding): send dark logo and explicit clears from the settings pages"
```

---

### Task 6: Settings form — extract the tile, add the dark tile

**Files:**
- Create: `apps/remix/app/components/forms/branding-logo-field.tsx`
- Modify: `apps/remix/app/components/forms/branding-preferences-form.tsx`

- [ ] **Step 1: The tile component**

`branding-logo-field.tsx`:

```tsx
import { BRANDING_LOGO_ALLOWED_TYPES } from '@documenso/lib/constants/branding';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormDescription } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import type { ReactNode } from 'react';

import { InheritableField } from './inheritable-field';

export type BrandingLogoFieldProps = {
  label: ReactNode;
  description: ReactNode;
  testId: string;
  canInherit: boolean;
  isEnabled: boolean;
  /** Current preview URL: a blob: URL for an unsaved pick, the served URL for a saved logo, '' for none. */
  previewUrl: string;
  hasLoadedPreview: boolean;
  /** Render the preview on a dark surface so a dark-mode logo is visible in the light editor. */
  isDarkSurface?: boolean;
  onFileChange: (file: File | null) => void;
  /** Everything react-hook-form gives the input except value/onChange. */
  inputProps: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'accept' | 'disabled'>;
};

export const BrandingLogoField = ({
  label,
  description,
  testId,
  canInherit,
  isEnabled,
  previewUrl,
  hasLoadedPreview,
  isDarkSurface = false,
  onFileChange,
  inputProps,
}: BrandingLogoFieldProps) => {
  return (
    <InheritableField className="flex-1" canInherit={canInherit} isInherited={!previewUrl} label={label} testId={testId}>
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            'relative h-48 w-full overflow-hidden rounded-lg border border-border',
            isDarkSurface ? 'bg-zinc-900' : 'bg-background',
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Logo preview" className="h-full w-full object-contain p-4" />
          ) : (
            <div
              className={cn(
                'relative flex h-full w-full items-center justify-center text-sm',
                isDarkSurface ? 'text-zinc-400' : 'bg-muted/20 text-muted-foreground dark:bg-muted',
              )}
            >
              <Trans>Please upload a logo</Trans>

              {!hasLoadedPreview && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-muted dark:bg-muted">
                  <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <FormControl className="relative">
            <Input
              type="file"
              accept={BRANDING_LOGO_ALLOWED_TYPES.join(',')}
              disabled={!isEnabled}
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  onFileChange(file);
                }
              }}
              className={cn(
                'h-auto p-2',
                'file:text-primary hover:file:bg-primary/90',
                'file:mr-4 file:cursor-pointer file:rounded-md file:border-0',
                'file:p-2 file:py-2 file:font-medium',
                'file:bg-primary file:text-primary-foreground',
                !isEnabled && 'cursor-not-allowed',
              )}
              {...inputProps}
            />
          </FormControl>

          <div className="absolute top-0 right-2 inline-flex h-full items-center justify-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-destructive text-xs"
              onClick={() => onFileChange(null)}
            >
              <Trans>Remove</Trans>
            </Button>
          </div>
        </div>

        <FormDescription>{description}</FormDescription>
      </div>
    </InheritableField>
  );
};
```

- [ ] **Step 2: Form schema, saved values, reset, visibility**

In `branding-preferences-form.tsx`:

Schema — pull the file validator out so both fields share it, and add the dark field:

```ts
const ZBrandingLogoFileSchema = z
  .instanceof(File)
  .refine((file) => file.size <= BRANDING_LOGO_MAX_SIZE_BYTES, `File size must be less than ${BRANDING_LOGO_MAX_SIZE_MB}MB`)
  .refine((file) => BRANDING_LOGO_ALLOWED_TYPES.includes(file.type), 'Only .jpg, .png, and .webp files are accepted');

const ZBrandingPreferencesFormSchema = z.object({
  brandingEnabled: z.boolean().nullable(),
  brandingLogo: ZBrandingLogoFileSchema.nullish(),
  brandingLogoDark: ZBrandingLogoFileSchema.nullish(),
  brandingUrl: z.string().url().optional().or(z.literal('')),
  brandingCompanyDetails: z.string().max(500).optional(),
  brandingColors: ZCssVarsSchema.default({}),
  brandingCss: z.string().max(10_000).default(''),
});
```

`SettingsSubset` — add `'brandingLogoDark'` to the `Pick`.

`savedValues` — add `brandingLogoDark: undefined,`.

`isResetToDefaultsVisible` — add `!!settings.brandingLogoDark ||` after the `brandingLogo` line.

`handleResetToDefaults` — add `brandingLogoDark: null,` to `data`, and after the existing preview cleanup add the dark equivalent (see step 3 for the state names).

- [ ] **Step 3: Preview state for the dark logo**

Replace the single preview state and helpers with a pair. Right after `const [hasLoadedPreview, setHasLoadedPreview] = useState(false);` add:

```ts
  const [darkPreviewUrl, setDarkPreviewUrl] = useState<string>('');
```

Generalise `getSavedLogoPreviewUrl`:

```ts
  const getSavedLogoPreviewUrl = (variant: 'light' | 'dark') => {
    const stored = variant === 'dark' ? settings.brandingLogoDark : settings.brandingLogo;

    if (!stored) {
      return '';
    }

    const file = JSON.parse(stored);

    if (!('type' in file) || !('data' in file)) {
      return '';
    }

    const logoUrl =
      context === 'Team'
        ? `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/team/${team?.id}`
        : `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisation?.id}`;

    const query = variant === 'dark' ? `?variant=dark&v=${Date.now()}` : `?v=${Date.now()}`;

    return `${logoUrl}${query}`;
  };
```

Update the effect to load both and depend on both:

```ts
  useEffect(() => {
    const savedLogoPreviewUrl = getSavedLogoPreviewUrl('light');
    const savedDarkLogoPreviewUrl = getSavedLogoPreviewUrl('dark');

    if (savedLogoPreviewUrl) {
      setPreviewUrl(savedLogoPreviewUrl);
    }

    if (savedDarkLogoPreviewUrl) {
      setDarkPreviewUrl(savedDarkLogoPreviewUrl);
    }

    setHasLoadedPreview(true);
  }, [settings.brandingLogo, settings.brandingLogoDark]);
```

`handleReset`:

```ts
  const handleReset = () => {
    setPreviewUrl(getSavedLogoPreviewUrl('light'));
    setDarkPreviewUrl(getSavedLogoPreviewUrl('dark'));
    form.reset(savedValues);
  };
```

`handleResetToDefaults` — after the existing `previewUrl` revoke/clear:

```ts
    if (darkPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(darkPreviewUrl);
    }

    setDarkPreviewUrl('');
```

Blob cleanup effect — add a second effect for `darkPreviewUrl` mirroring the existing one.

A small helper used by both tiles, placed above the `return`:

```ts
  const swapPreview = (
    current: string,
    setter: (url: string) => void,
    onChange: (file: File | null) => void,
    file: File | null,
  ) => {
    if (current.startsWith('blob:')) {
      URL.revokeObjectURL(current);
    }

    setter(file ? URL.createObjectURL(file) : '');
    onChange(file);
  };
```

- [ ] **Step 4: Replace the logo `FormField` with two tiles**

Replace the whole `<FormField control={form.control} name="brandingLogo" … />` block with:

```tsx
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="brandingLogo"
                render={({ field: { value: _value, onChange, ...field } }) => (
                  <BrandingLogoField
                    label={<Trans>Branding Logo</Trans>}
                    testId="branding-logo"
                    canInherit={canInherit}
                    isEnabled={!!isBrandingEnabled}
                    previewUrl={previewUrl}
                    hasLoadedPreview={hasLoadedPreview}
                    onFileChange={(file) => swapPreview(previewUrl, setPreviewUrl, onChange, file)}
                    inputProps={field}
                    description={
                      <>
                        <Trans>Upload your brand logo (max 5MB, JPG, PNG, or WebP)</Trans>

                        {canInherit && (
                          <span>
                            {'. '}
                            <Trans>Leave blank to inherit from the organisation.</Trans>
                          </span>
                        )}
                      </>
                    }
                  />
                )}
              />

              <FormField
                control={form.control}
                name="brandingLogoDark"
                render={({ field: { value: _value, onChange, ...field } }) => (
                  <BrandingLogoField
                    label={<Trans>Dark Mode Logo</Trans>}
                    testId="branding-logo-dark"
                    canInherit={canInherit}
                    isEnabled={!!isBrandingEnabled}
                    isDarkSurface
                    previewUrl={darkPreviewUrl}
                    hasLoadedPreview={hasLoadedPreview}
                    onFileChange={(file) => swapPreview(darkPreviewUrl, setDarkPreviewUrl, onChange, file)}
                    inputProps={field}
                    description={
                      <>
                        <Trans>
                          Optional. Shown instead of the logo when the viewer's theme is dark. Leave empty to reuse the
                          logo.
                        </Trans>

                        {canInherit && (
                          <span>
                            {' '}
                            <Trans>Leave blank to inherit from the organisation.</Trans>
                          </span>
                        )}
                      </>
                    }
                  />
                )}
              />
            </div>
```

Add `import { BrandingLogoField } from './branding-logo-field';` and remove the now-unused imports (`BRANDING_LOGO_ALLOWED_TYPES`, `Loader`, `Input` if no longer used — `Input` is still used by `brandingUrl`, keep it; `cn` is still used for the tile? No — check and drop if unused).

- [ ] **Step 5: Type-check remix**

Run: `npx tsc --noEmit -p apps/remix`
Expected: no errors (this also validates Task 5's route changes).

- [ ] **Step 6: Commit**

```bash
git add apps/remix/app/components/forms/branding-logo-field.tsx apps/remix/app/components/forms/branding-preferences-form.tsx
git commit -m "feat(branding): dark mode logo upload tile in branding preferences"
```

---

### Task 7: `BrandingLogoImage` and the three call sites

**Files:**
- Create: `apps/remix/app/components/general/branding-logo-image.tsx`
- Modify: `apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx:171-177`
- Modify: `apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx:37-42`
- Modify: `apps/remix/app/components/general/envelope-editor/envelope-editor-header.tsx:74-76`

- [ ] **Step 1: The component**

```tsx
import { cn } from '@documenso/ui/lib/utils';

export type BrandingLogoImageProps = {
  scope: 'team' | 'organisation';
  id: number | string;
  alt: string;
  className?: string;
};

/**
 * The custom branding logo for the current theme.
 *
 * Renders the light and dark variants and lets Tailwind's `dark:` variant pick
 * one, driven by the `dark` class remix-themes puts on <html>. No JavaScript,
 * so there is no wrong-logo flash, and it is correct for logged-out recipients
 * whose theme comes from their system preference. When no dark logo is set the
 * server serves the light file for the dark variant, so both requests share a
 * cache entry.
 */
export const BrandingLogoImage = ({ scope, id, alt, className }: BrandingLogoImageProps) => {
  const src = `/api/branding/logo/${scope}/${id}`;

  return (
    <>
      <img src={src} alt={alt} className={cn(className, 'dark:hidden')} />
      <img src={`${src}?variant=dark`} alt={alt} className={cn(className, 'hidden dark:block')} />
    </>
  );
};
```

- [ ] **Step 2: Signing page view (v1)**

Replace the `<img … />` at lines 173–177 with:

```tsx
          <BrandingLogoImage
            scope="team"
            id={document.teamId}
            alt={`${document.team.name}'s Logo`}
            className="mb-4 h-12 w-12 md:mb-2"
          />
```

Add `import { BrandingLogoImage } from '~/components/general/branding-logo-image';`.

- [ ] **Step 3: Envelope signer header**

Replace the `<img … />` at lines 38–42 with:

```tsx
            <BrandingLogoImage
              scope="team"
              id={envelope.teamId}
              alt={`${envelope.team.name}'s Logo`}
              className="h-6 w-auto flex-shrink-0"
            />
```

Add the import.

- [ ] **Step 4: Envelope editor header**

Replace line 75 with:

```tsx
            <BrandingLogoImage scope="team" id={envelope.teamId} alt="Logo" className="h-6 w-auto" />
```

Add the import.

- [ ] **Step 5: Type-check remix and lint**

Run: `npx tsc --noEmit -p apps/remix && npx biome check apps/remix/app/components/general packages/lib/server-only/branding packages/lib/utils/branding-logo-form-data.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/remix/app/components/general/branding-logo-image.tsx apps/remix/app/components/general/document-signing/document-signing-page-view-v1.tsx apps/remix/app/components/general/envelope-signing/envelope-signer-header.tsx apps/remix/app/components/general/envelope-editor/envelope-editor-header.tsx
git commit -m "feat(branding): render the theme-matching logo on signing and editor surfaces"
```

---

### Task 8: Email white plate

**Files:**
- Modify: `packages/email/template-components/template-branding-logo.tsx`

- [ ] **Step 1: Wrap the custom logo**

Replace `const brandingLogo = <Img src={branding.brandingLogo} alt="Branding Logo" className={className} />;` with:

```tsx
  // Mail clients apply their own dark-mode transforms and we cannot detect them
  // server-side, so the custom logo sits on a fixed white plate. Inline styles
  // because email clients ignore stylesheets.
  const brandingLogo = (
    <span style={{ display: 'inline-block', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px' }}>
      <Img src={branding.brandingLogo} alt="Branding Logo" className={className} />
    </span>
  );
```

- [ ] **Step 2: Type-check email**

Run: `npx tsc --noEmit -p packages/email`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/email/template-components/template-branding-logo.tsx
git commit -m "feat(branding): keep the email logo legible under client dark mode"
```

---

### Task 9: E2E — upload, clear, fallback, dark signing page

**Files:**
- Modify: `packages/app-tests/e2e/branding-logo-upload.spec.ts`
- Modify: `packages/app-tests/e2e/signing-branding.spec.ts`

- [ ] **Step 1: Dark upload + fallback test** (append to `branding-logo-upload.spec.ts`)

```ts
const DARK_LOGO_PATH = path.join(__dirname, '../../assets/logo.png');

/** Fetch a served logo's bytes through the browser context so cookies/theme don't matter. */
const fetchLogo = async (page: Page, url: string) => {
  const response = await page.context().request.get(url);

  return { status: response.status(), body: await response.body() };
};

test('[BRANDING_LOGO]: dark logo is served for ?variant=dark and falls back when cleared', async ({ page }) => {
  const { user, organisation } = await seedUser({ isPersonalOrganisation: false });

  await grantCustomBranding(organisation.organisationClaim.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Light logo first, through the UI.
  await enableBrandingAndUpload(page);

  const logoUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/api/branding/logo/organisation/${organisation.id}`;

  const lightBefore = await fetchLogo(page, logoUrl);
  const darkBefore = await fetchLogo(page, `${logoUrl}?variant=dark`);

  expect(lightBefore.status).toBe(200);
  expect(darkBefore.status).toBe(200);
  // No dark logo yet: the dark variant is the light bytes.
  expect(darkBefore.body.equals(lightBefore.body)).toBe(true);

  // Upload the dark logo via the dark tile. Both tiles are file inputs; the dark one is second.
  await page.getByTestId('branding-logo-dark').locator('input[type="file"]').setInputFiles(DARK_LOGO_PATH);
  await page.getByRole('button', { name: 'Save changes' }).first().click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();

  const settings = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  expect(settings.brandingLogoDark).toBeTruthy();
  // The light logo was not touched by a dark-only save.
  expect(settings.brandingLogo).toBeTruthy();

  const darkAfter = await fetchLogo(page, `${logoUrl}?variant=dark`);
  expect(darkAfter.status).toBe(200);

  // Clear only the dark logo; the light one must survive and the dark variant falls back.
  await page.getByTestId('branding-logo-dark').getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Save changes' }).first().click();

  await expect
    .poll(async () => {
      const updated = await prisma.organisationGlobalSettings.findUniqueOrThrow({
        where: { id: organisation.organisationGlobalSettingsId },
      });

      return updated.brandingLogoDark;
    })
    .toBe('');

  const cleared = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });
  expect(cleared.brandingLogo).toBe(settings.brandingLogo);

  const darkFallback = await fetchLogo(page, `${logoUrl}?variant=dark`);
  expect(darkFallback.body.equals(lightBefore.body)).toBe(true);
});
```

Note: `InheritableField` renders `data-testid={testId}` on its wrapper — confirm by reading `apps/remix/app/components/forms/inheritable-field.tsx`; if the attribute is on a different element, scope the locators accordingly.

- [ ] **Step 2: Dark signing page test** (append to `signing-branding.spec.ts`)

```ts
test('[SIGNING_BRANDING]: V1 signing shows the dark logo when the viewer prefers dark', async ({ page }) => {
  const { user, team, organisation } = await seedUser();

  await enableOrganisationBranding({
    organisationGlobalSettingsId: organisation.organisationGlobalSettingsId,
  });

  await prisma.organisationGlobalSettings.update({
    where: { id: organisation.organisationGlobalSettingsId },
    data: { brandingLogoDark: await readBrandingLogo() },
  });

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    teamId: team.id,
    recipients: ['v1-dark-branding-signer@test.documenso.com'],
    fields: [FieldType.SIGNATURE],
  });

  // No theme cookie for a fresh recipient, so remix-themes follows the system preference.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`/sign/${recipients[0].token}`);

  const logos = page.getByRole('img', { name: `${team.name}'s Logo` });

  // Both variants are in the DOM; only the dark one is visible under the dark theme.
  await expect(logos).toHaveCount(2);
  await expect(logos.filter({ visible: true })).toHaveAttribute('src', /variant=dark/);

  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();

  await expect(logos.filter({ visible: true })).not.toHaveAttribute('src', /variant=dark/);
});
```

- [ ] **Step 3: Run the two specs**

Run: `npm run test:dev -w @documenso/app-tests -- branding-logo-upload signing-branding`
Expected: all tests in both files pass. (Requires the dev stack — see `docker/development/compose.yml` — and `npm run dev` running; if the local stack is not available, push and let CI's E2E job run them.)

- [ ] **Step 4: Commit**

```bash
git add packages/app-tests/e2e/branding-logo-upload.spec.ts packages/app-tests/e2e/signing-branding.spec.ts
git commit -m "test(branding): dark logo upload, fallback and dark-theme signing page"
```

---

### Task 10: Translations, full verification, PR

- [ ] **Step 1: Extract new strings**

Run: `npm run translate:extract`
Expected: the `en` catalog gains "Dark Mode Logo" and the dark-tile description; commit the catalog changes under `packages/lib/translations/`.

- [ ] **Step 2: Full local verification**

Run:
```bash
npx tsc --noEmit -p packages/lib && npx tsc --noEmit -p packages/trpc && npx tsc --noEmit -p packages/email && npx tsc --noEmit -p apps/remix
npx biome check .
npx vitest run packages/lib
```
Expected: all clean.

- [ ] **Step 3: Commit and open the PR**

```bash
git add packages/lib/translations
git commit -m "chore(i18n): extract dark mode logo strings"
git push -u origin feat/dark-mode-branding-logo
gh pr create --title "feat(branding): dark mode logo" --body "Implements docs/superpowers/specs/2026-09-19-dark-mode-branding-logo-design.md. Additive migration; no behaviour change without a dark logo uploaded."
```

Wait for CI (lint/typecheck/unit + E2E). Fix anything red before requesting merge.

---

## Self-review against the spec

- §1 schema/inheritance → Task 1. §2 serving → Tasks 2–3. §3 upload/explicit clears → Tasks 4–5. §4 rendering → Task 7. §5 form → Task 6. §6 emails → Task 8. §7 errors: invalid dark image reuses `buildBrandingLogoData`'s `AppError` (Task 4); missing stored file falls through the unchanged 404 branch (Task 3); unknown variant = light (Task 2). §8 tests → Tasks 2, 9, 10.
- Names used consistently: `brandingLogoDark`, `clearBrandingLogo`, `clearBrandingLogoDark`, `resolveBrandingLogo`, `buildBrandingLogoFormData`, `BrandingLogoField`, `BrandingLogoImage`, `?variant=dark`, test id `branding-logo-dark`.
