import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteTeamMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/{teamId}/delete',
    summary: 'Delete team',
    description: 'Delete an existing team',
    tags: ['Team'],
  },
};

export const ZDeleteTeamRequestSchema = z.object({
  teamId: z.number(),
  transferTeamId: z.number().optional(),
});

export const ZDeleteTeamResponseSchema = z.void();
