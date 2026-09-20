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
