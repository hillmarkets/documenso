import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteOrganisationMemberMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/member/{organisationMemberId}/delete',
    summary: 'Delete organisation member',
    description: 'Delete organisation member',
    tags: ['Organisation'],
  },
};

export const ZDeleteOrganisationMemberRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberId: z.string(),
});

export const ZDeleteOrganisationMemberResponseSchema = z.void();
