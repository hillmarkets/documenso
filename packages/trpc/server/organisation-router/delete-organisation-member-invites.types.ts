import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteOrganisationMemberInvitesMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/member/invite/delete-many',
    summary: 'Delete organisation member invites',
    description: 'Delete organisation member invites',
    tags: ['Organisation'],
  },
};

export const ZDeleteOrganisationMemberInvitesRequestSchema = z.object({
  organisationId: z.string(),
  invitationIds: z.array(z.string()).refine((items) => new Set(items).size === items.length, {
    message: 'Invitation IDs must be unique, no duplicate values allowed',
  }),
});

export const ZDeleteOrganisationMemberInvitesResponseSchema = z.void();
