import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const deleteInstanceApiTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/api-token/{id}/delete',
    summary: 'Delete instance API token',
    description: 'Revoke an INSTANCE-scoped API token. Requires a session admin or an INSTANCE token.',
    tags: ['Admin API Tokens'],
  },
};

export const ZDeleteInstanceApiTokenRequestSchema = z.object({
  id: z.number().min(1),
});

export const ZDeleteInstanceApiTokenResponseSchema = z.void();
