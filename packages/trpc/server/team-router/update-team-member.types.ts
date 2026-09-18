import { TeamMemberRole } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const updateTeamMemberMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/{teamId}/member/{memberId}/update',
    summary: 'Update team member',
    description: 'Update team member',
    tags: ['Team'],
  },
};

export const ZUpdateTeamMemberRequestSchema = z.object({
  teamId: z.number(),
  memberId: z.string(),
  data: z.object({
    role: z.nativeEnum(TeamMemberRole),
  }),
});

export const ZUpdateTeamMemberResponseSchema = z.void();
