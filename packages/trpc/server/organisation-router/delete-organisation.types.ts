import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteOrganisationMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/delete',
    summary: 'Delete organisation',
    description: 'Delete an existing organisation',
    tags: ['Organisation'],
  },
};

export const ZDeleteOrganisationRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZDeleteOrganisationResponseSchema = z.void();
