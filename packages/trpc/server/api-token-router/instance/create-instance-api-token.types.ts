import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const createInstanceApiTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/api-token/create',
    summary: 'Create instance API token',
    description:
      'Create an INSTANCE-scoped API token that can act across every organisation and team. Requires a session admin or an INSTANCE token.',
    tags: ['Admin API Tokens'],
  },
};

export const ZCreateInstanceApiTokenRequestSchema = z.object({
  tokenName: ZNameSchema,
  expirationDate: z.string().nullable(),
});

export const ZCreateInstanceApiTokenResponseSchema = z.object({
  id: z.number(),
  token: z.string(),
});

export type TCreateInstanceApiTokenRequest = z.infer<typeof ZCreateInstanceApiTokenRequestSchema>;
