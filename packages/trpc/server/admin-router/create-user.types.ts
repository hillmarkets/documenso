import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const createUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/create',
    summary: 'Create user',
    description: 'Create a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZCreateUserRequestSchema = z.object({
  email: z.string().email().min(1),
  name: ZNameSchema,
});

export type TCreateUserRequest = z.infer<typeof ZCreateUserRequestSchema>;

export const ZCreateUserResponseSchema = z.object({
  userId: z.number(),
});

export type TCreateUserResponse = z.infer<typeof ZCreateUserResponseSchema>;
