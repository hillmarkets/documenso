import { OrganisationMemberRole } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const updateOrganisationMemberMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/member/{organisationMemberId}/update',
    summary: 'Update organisation member',
    description: 'Update organisation member',
    tags: ['Organisation'],
  },
};

export const ZUpdateOrganisationMemberRequestSchema = z.object({
  organisationId: z.string(),
  organisationMemberId: z.string(),
  data: z.object({
    role: z.nativeEnum(OrganisationMemberRole),
  }),
});

export const ZUpdateOrganisationMemberResponseSchema = z.void();
