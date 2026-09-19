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
