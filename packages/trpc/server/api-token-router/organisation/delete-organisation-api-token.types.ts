import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';

export const deleteOrganisationApiTokenMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/api-token/{id}/delete',
    summary: 'Delete organisation API token',
    description:
      'Revoke an ORGANISATION-scoped API token. Callable by organisation admins (session), ORGANISATION tokens for their own organisation, and INSTANCE tokens.',
    tags: ['Organisation API Tokens'],
  },
};

export const ZDeleteOrganisationApiTokenRequestSchema = z.object({
  organisationId: z.string(),
  id: z.number().min(1),
});

export const ZDeleteOrganisationApiTokenResponseSchema = z.void();
