import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';
import type { TrpcRouteMeta } from '../trpc-instance';
import { ZTeamUrlSchema } from './schema';

export const createTeamMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/team/create',
    summary: 'Create team',
    description: 'Create a new team',
    tags: ['Team'],
  },
};

export const ZCreateTeamRequestSchema = z.object({
  organisationId: z.string(),
  teamName: ZNameSchema,
  teamUrl: ZTeamUrlSchema,
  inheritMembers: z
    .boolean()
    .describe(
      'Whether to automatically assign all current and future organisation members to the new team. Defaults to true.',
    ),
});

export const ZCreateTeamResponseSchema = z.object({
  id: z.number(),
  url: z.string(),
});

export type TCreateTeamRequest = z.infer<typeof ZCreateTeamRequestSchema>;
