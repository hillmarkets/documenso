import { z } from 'zod';

import { ZTeamUrlSchema } from '../team-router/schema';
import type { TrpcRouteMeta } from '../trpc-instance';
import { ZCreateOrganisationRequestSchema } from './create-organisation.types';

export const updateOrganisationMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/update',
    summary: 'Update organisation',
    description: 'Update an organisation',
    tags: ['Organisation'],
  },
};

export const ZUpdateOrganisationRequestSchema = z.object({
  data: ZCreateOrganisationRequestSchema.pick({
    name: true,
  }).extend({
    url: ZTeamUrlSchema,
  }),
  organisationId: z.string(),
});

export const ZUpdateOrganisationResponseSchema = z.void();
