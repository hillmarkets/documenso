import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteOrganisationGroupMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/groups/{groupId}/delete',
    summary: 'Delete organisation group',
    description: 'Delete an existing group for a organisation',
    tags: ['Organisation'],
  },
};

export const ZDeleteOrganisationGroupRequestSchema = z.object({
  organisationId: z.string(),
  groupId: z.string(),
});

export const ZDeleteOrganisationGroupResponseSchema = z.void();
