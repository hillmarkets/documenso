import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdBrandingImageFile, zodFormData } from '../../utils/zod-form-data';

export const ZUpdateOrganisationBrandingLogoRequestSchema = zodFormData({
  payload: zfd.json(
    z.object({
      organisationId: z.string(),
      // Multipart cannot express "remove", so clears are explicit flags. A logo
      // whose file is absent and whose clear flag is absent is left untouched.
      clearBrandingLogo: z.boolean().optional(),
      clearBrandingLogoDark: z.boolean().optional(),
    }),
  ),
  brandingLogo: zfdBrandingImageFile().optional(),
  brandingLogoDark: zfdBrandingImageFile().optional(),
});

export const ZUpdateOrganisationBrandingLogoResponseSchema = z.void();

export type TUpdateOrganisationBrandingLogoRequest = z.infer<typeof ZUpdateOrganisationBrandingLogoRequestSchema>;
