import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteTeamMemberMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/{teamId}/member/{memberId}/delete',
    summary: 'Delete team member',
    description: 'Delete team member',
    tags: ['Team'],
  },
};

export const ZDeleteTeamMemberRequestSchema = z.object({
  teamId: z.number().describe('The ID of the team to remove the member from.'),
  memberId: z.string().describe('The ID of the member to remove from the team.'),
});

export const ZDeleteTeamMemberResponseSchema = z.void();
