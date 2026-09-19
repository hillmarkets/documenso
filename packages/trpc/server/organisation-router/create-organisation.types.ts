import { ZNameSchema } from '@documenso/lib/types/name';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const createOrganisationMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/create',
    summary: 'Create organisation',
    description: 'Create an organisation',
    tags: ['Organisation'],
  },
};

export const ZCreateOrganisationRequestSchema = z.object({
  name: ZNameSchema,
});

export const ZCreateOrganisationResponseSchema = z.object({
  paymentRequired: z.literal(false),
  organisationId: z.string(),
});

export type TCreateOrganisationResponse = z.infer<typeof ZCreateOrganisationResponseSchema>;
