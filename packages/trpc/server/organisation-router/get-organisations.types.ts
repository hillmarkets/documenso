import { ZOrganisationManySchema } from '@documenso/lib/types/organisation';
import OrganisationMemberRoleSchema from '@documenso/prisma/generated/zod/inputTypeSchemas/OrganisationMemberRoleSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const getOrganisationsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/organisation',
    summary: 'Get teams',
    description: 'Get all teams you are a member of',
    tags: ['Organisation'],
  },
};

export const ZGetOrganisationsRequestSchema = z.void();

export const ZGetOrganisationsResponseSchema = ZOrganisationManySchema.extend({
  currentOrganisationRole: OrganisationMemberRoleSchema,
  currentMemberId: z.string(),
}).array();

export type TGetOrganisationsResponse = z.infer<typeof ZGetOrganisationsResponseSchema>;
