import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteTeamGroupMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/{teamId}/groups/{teamGroupId}/delete',
    summary: 'Delete team group',
    description: 'Delete an existing group for a team',
    tags: ['Team'],
  },
};

export const ZDeleteTeamGroupRequestSchema = z.object({
  teamId: z.number(),
  teamGroupId: z.string(),
});

export const ZDeleteTeamGroupResponseSchema = z.void();
