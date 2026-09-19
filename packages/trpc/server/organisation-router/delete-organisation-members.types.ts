import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteOrganisationMembersMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/member/delete-many',
    summary: 'Delete organisation members',
    description: 'Delete organisation members',
    tags: ['Organisation'],
  },
};

export const ZDeleteOrganisationMembersRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberIds: z.array(z.string()).refine((items) => new Set(items).size === items.length, {
    message: 'Organisation member ids must be unique, no duplicate values allowed',
  }),
});

export const ZDeleteOrganisationMembersResponseSchema = z.void();
