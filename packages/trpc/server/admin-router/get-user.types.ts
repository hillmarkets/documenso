import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const getUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/user/{id}',
    summary: 'Get user',
    description: 'Get a user by ID. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZGetUserRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZGetUserResponseSchema = UserSchema.pick({
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  roles: true,
  disabled: true,
  twoFactorEnabled: true,
  signature: true,
});

export type TGetUserRequest = z.infer<typeof ZGetUserRequestSchema>;
export type TGetUserResponse = z.infer<typeof ZGetUserResponseSchema>;
