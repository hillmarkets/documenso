import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const createOrganisationApiTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/api-token/create',
    summary: 'Create organisation API token',
    description:
      'Create an ORGANISATION-scoped API token. Callable by organisation admins (session), ORGANISATION tokens for their own organisation, and INSTANCE tokens.',
    tags: ['Organisation API Tokens'],
  },
};

export const ZCreateOrganisationApiTokenRequestSchema = z.object({
  organisationId: z.string(),
  tokenName: ZNameSchema,
  expirationDate: z.string().nullable(),
});

export const ZCreateOrganisationApiTokenResponseSchema = z.object({
  id: z.number(),
  token: z.string(),
});

export type TCreateOrganisationApiTokenRequest = z.infer<typeof ZCreateOrganisationApiTokenRequestSchema>;
