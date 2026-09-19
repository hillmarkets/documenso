import ApiTokenSchema from '@documenso/prisma/generated/zod/modelSchema/ApiTokenSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const findInstanceApiTokensMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/api-token',
    summary: 'Find instance API tokens',
    description: 'List INSTANCE-scoped API tokens. Requires a session admin or an INSTANCE token.',
    tags: ['Admin API Tokens'],
  },
};

export const ZFindInstanceApiTokensRequestSchema = z.void();

export const ZFindInstanceApiTokensResponseSchema = z.array(
  ApiTokenSchema.pick({
    id: true,
    name: true,
    createdAt: true,
    expires: true,
    lastUsedAt: true,
  }).extend({
    user: z
      .object({
        id: z.number(),
        name: z.string().nullable(),
        email: z.string(),
      })
      .nullable(),
  }),
);

export type TFindInstanceApiTokensResponse = z.infer<typeof ZFindInstanceApiTokensResponseSchema>;
