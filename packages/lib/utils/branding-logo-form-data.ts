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
