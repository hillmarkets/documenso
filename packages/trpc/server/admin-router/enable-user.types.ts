import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const enableUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/{id}/enable',
    summary: 'Enable user',
    description: 'Enable a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZEnableUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZEnableUserResponseSchema = z.void();

export type TEnableUserRequest = z.infer<typeof ZEnableUserRequestSchema>;
export type TEnableUserResponse = z.infer<typeof ZEnableUserResponseSchema>;
