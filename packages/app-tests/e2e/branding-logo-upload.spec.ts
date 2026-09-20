import fs from 'node:fs';
import path from 'node:path';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { apiSignin } from './fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const LOGO_PATH = path.join(__dirname, '../../assets/logo.png');

type MultipartFile = { name: string; mimeType: string; buffer: Buffer };

const enableBrandingAndUpload = async (page: Page) => {
  // Enable custom branding so the file input is no longer disabled.
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).click();

  // Upload the logo file through the real multipart route.
  await page.locator('input[type="file"]').setInputFiles(LOGO_PATH);

  await page.getByRole('button', { name: 'Save changes' }).first().click();
  await expect(page.getByText('Your branding preferences have been updated').first()).toBeVisible();
};

/**
 * POST a logo straight to the dedicated multipart tRPC route using the
 * authenticated browser cookies. This bypasses the client-side form validation,
 * which is the only way to exercise the server-side image validation /
 * sanitisation (`zfdBrandingImageFile` + `optimiseBrandingLogo`) and the entitlement gate.
 */
const postOrganisationBrandingLogo = async (page: Page, organisationId: string, file: MultipartFile | null) => {
  const multipart: Record<string, string | MultipartFile> = {
    payload: JSON.stringify({ organisationId }),
  };

  if (file) {
    multipart.brandingLogo = file;
  }

  return await page
    .context()
    .request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/trpc/organisation.settings.updateBrandingLogo`, { multipart });
};

/**
 * Grant the organisation the custom-branding entitlement. The positive branding
 * flows require it whenever billing is enabled; with billing disabled the gate is
 * bypassed, so this keeps these tests valid in both modes.
 */
const grantCustomBranding = async (organisationClaimId: string) => {
  await prisma.organisationClaim.update({
    where: { id: organisationClaimId },
    data: { flags: { allowLegacyEnvelopes: true, allowCustomBranding: true } },
  });
};

test('[BRANDING_LOGO]: uploads an organisation branding logo via the dedicated route', async ({ page }) => {
  const { user, organisation } = await seedUser({ isPersonalOrganisation: false });

  await grantCustomBranding(organisation.organisationClaim.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  await enableBrandingAndUpload(page);

  const settings = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  expect(settings.brandingLogo).toBeTruthy();

  const parsed = JSON.parse(settings.brandingLogo);
  expect(parsed).toHaveProperty('type');
  expect(parsed).toHaveProperty('data');
});

test('[BRANDING_LOGO]: uploads a team branding logo via the dedicated route', async ({ page }) => {
  const { user, team, organisation } = await seedUser({ isPersonalOrganisation: false });

  await grantCustomBranding(organisation.organisationClaim.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  await enableBrandingAndUpload(page);

  // TeamGlobalSettings has no `teamId` column (the FK lives on Team), so read it
  // through the team relation.
  const teamWithSettings = await prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(teamWithSettings.teamGlobalSettings?.brandingLogo).toBeTruthy();

  const parsed = JSON.parse(teamWithSettings.teamGlobalSettings?.brandingLogo ?? '');
  expect(parsed).toHaveProperty('type');
  expect(parsed).toHaveProperty('data');
});

test('[BRANDING_LOGO]: clears the organisation branding logo when the user removes it', async ({ page }) => {
  const { user, organisation } = await seedUser({ isPersonalOrganisation: false });

  await grantCustomBranding(organisation.organisationClaim.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  await enableBrandingAndUpload(page);

  // Confirm the logo was stored before we clear it.
  const settings = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  expect(settings.brandingLogo).toBeTruthy();

  // Remove the logo and save again.
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Save changes' }).first().click();

  // Clearing the logo persists an empty string via the dedicated route.
  await expect
    .poll(async () => {
      const updated = await prisma.organisationGlobalSettings.findUniqueOrThrow({
        where: { id: organisation.organisationGlobalSettingsId },
      });

      return updated.brandingLogo;
    })
    .toBe('');
});

test('[BRANDING_LOGO]: validates and sanitises the logo on the server', async ({ page }) => {
  const { user, organisation } = await seedUser({ isPersonalOrganisation: false });

  await grantCustomBranding(organisation.organisationClaim.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Positive control: a genuine PNG is accepted and stored. This also proves the
  // direct multipart request shape matches what the route expects.
  const validResponse = await postOrganisationBrandingLogo(page, organisation.id, {
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: fs.readFileSync(LOGO_PATH),
  });

  expect(validResponse.ok()).toBeTruthy();

  const afterValid = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  expect(afterValid.brandingLogo).toBeTruthy();

  // Bytes that pass the MIME/size allowlist but are not a real image must be
  // rejected by the server (the `sharp` re-encode) without changing stored state.
  const invalidResponse = await postOrganisationBrandingLogo(page, organisation.id, {
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('this is definitely not a valid png'),
  });

  expect(invalidResponse.ok()).toBeFalsy();
  expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
  expect(invalidResponse.status()).toBeLessThan(500);

  const afterInvalid = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  // The previously stored, valid logo is left untouched by the rejected upload.
  expect(afterInvalid.brandingLogo).toBe(afterValid.brandingLogo);
});

test('[BRANDING_LOGO]: rejects setting a logo without the custom-branding entitlement', async ({ page }) => {
  // The entitlement is only enforced when billing is enabled; with billing off
  // the check is intentionally skipped server-side, so this can't be exercised.
  test.skip(
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED !== 'true',
    'Entitlement is only enforced when billing is enabled.',
  );

  // Seeded organisations have no `allowCustomBranding` claim flag.
  const { user, organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  const response = await postOrganisationBrandingLogo(page, organisation.id, {
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: fs.readFileSync(LOGO_PATH),
  });

  expect(response.ok()).toBeFalsy();

  const settings = await prisma.organisationGlobalSettings.findUniqueOrThrow({
    where: { id: organisation.organisationGlobalSettingsId },
  });

  expect(settings.brandingLogo).toBeFalsy();
});

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

  // Upload the dark logo via the dark tile.
  await page.getByTestId('branding-logo-dark').locator('input[type="file"]').setInputFiles(LOGO_PATH);
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
