import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const createAdminOrganisationMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/organisation/create',
    summary: 'Create organisation',
    description:
      'Create an organisation owned by `ownerUserId`. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZCreateAdminOrganisationRequestSchema = z.object({
  ownerUserId: z.number(),
  data: z.object({
    name: ZNameSchema,
  }),
});

export const ZCreateAdminOrganisationResponseSchema = z.object({
  organisationId: z.string(),
});

export type TCreateAdminOrganisationRequest = z.infer<typeof ZCreateAdminOrganisationRequestSchema>;
