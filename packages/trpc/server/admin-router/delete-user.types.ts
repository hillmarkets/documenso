import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const deleteUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/{id}/delete',
    summary: 'Delete user',
    description: 'Delete a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZDeleteUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZDeleteUserResponseSchema = z.void();

export type TDeleteUserRequest = z.infer<typeof ZDeleteUserRequestSchema>;
export type TDeleteUserResponse = z.infer<typeof ZDeleteUserResponseSchema>;
