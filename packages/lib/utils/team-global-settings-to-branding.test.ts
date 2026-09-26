import type { OrganisationGlobalSettings } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { organisationGlobalSettingsToBranding, teamGlobalSettingsToBranding } from './team-global-settings-to-branding';

const settings = (overrides: Partial<OrganisationGlobalSettings>) =>
  ({
    brandingEnabled: true,
    brandingLogo: JSON.stringify({ type: 'S3_PATH', data: 'key', width: 512, height: 174 }),
    brandingLogoDark: '',
    brandingUrl: '',
    brandingCompanyDetails: '',
    brandingColors: null,
    ...overrides,
  }) as Omit<OrganisationGlobalSettings, 'id'>;

describe.each([
  ['team', teamGlobalSettingsToBranding],
  ['organisation', organisationGlobalSettingsToBranding],
] as const)('%s settings to email branding', (_scope, toBranding) => {
  it('carries the logo dimensions recorded at upload', () => {
    // biome-ignore lint/suspicious/noExplicitAny: both mappers take (settings, id, hidePoweredBy)
    const branding = (toBranding as any)(settings({}), 1, false);

    expect(branding.brandingLogoDimensions).toEqual({ width: 512, height: 174 });
  });

  it('has no dimensions for a logo stored before they were recorded', () => {
    // biome-ignore lint/suspicious/noExplicitAny: both mappers take (settings, id, hidePoweredBy)
    const branding = (toBranding as any)(
      settings({ brandingLogo: JSON.stringify({ type: 'S3_PATH', data: 'key' }) }),
      1,
      false,
    );

    expect(branding.brandingLogoDimensions).toBeNull();
  });

  it('has no dimensions when branding is off', () => {
    // biome-ignore lint/suspicious/noExplicitAny: both mappers take (settings, id, hidePoweredBy)
    const branding = (toBranding as any)(settings({ brandingEnabled: false }), 1, false);

    expect(branding.brandingLogoDimensions).toBeNull();
  });
});
