import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const disableUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/{id}/disable',
    summary: 'Disable user',
    description: 'Disable a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZDisableUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZDisableUserResponseSchema = z.void();

export type TDisableUserRequest = z.infer<typeof ZDisableUserRequestSchema>;
export type TDisableUserResponse = z.infer<typeof ZDisableUserResponseSchema>;
