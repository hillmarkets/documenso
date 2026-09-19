import ApiTokenSchema from '@documenso/prisma/generated/zod/modelSchema/ApiTokenSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const findOrganisationApiTokensMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/organisation/{organisationId}/api-token',
    summary: 'Find organisation API tokens',
    description:
      'List ORGANISATION-scoped API tokens. Callable by organisation admins (session), ORGANISATION tokens for their own organisation, and INSTANCE tokens.',
    tags: ['Organisation API Tokens'],
  },
};

export const ZFindOrganisationApiTokensRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZFindOrganisationApiTokensResponseSchema = z.array(
  ApiTokenSchema.pick({
    id: true,
    name: true,
    createdAt: true,
    expires: true,
    lastUsedAt: true,
  }),
);

export type TFindOrganisationApiTokensResponse = z.infer<typeof ZFindOrganisationApiTokensResponseSchema>;
