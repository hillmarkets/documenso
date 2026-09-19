import { ZNameSchema } from '@documenso/lib/types/name';
import { zEmail } from '@documenso/lib/utils/zod';
import { Role } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const updateUserMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/user/{id}/update',
    summary: 'Update user',
    description: 'Update a user. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZUpdateUserRequestSchema = z.object({
  id: z.number().min(1),
  name: ZNameSchema.nullish(),
  email: zEmail().optional(),
  roles: z.array(z.nativeEnum(Role)).optional(),
});

export const ZUpdateUserResponseSchema = z.void();

export type TUpdateUserRequest = z.infer<typeof ZUpdateUserRequestSchema>;
export type TUpdateUserResponse = z.infer<typeof ZUpdateUserResponseSchema>;
