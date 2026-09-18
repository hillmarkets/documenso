import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import { OrganisationMemberInviteSchema } from '@documenso/prisma/generated/zod/modelSchema/OrganisationMemberInviteSchema';
import { OrganisationMemberInviteStatus } from '@prisma/client';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const getOrganisationMemberInvitesMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/organisation/{organisationId}/member/invite',
    summary: 'Find organisation members pending',
    description: 'Find all members of a organisation pending',
    tags: ['Organisation'],
  },
};

export const ZFindOrganisationMemberInvitesRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
  status: z.nativeEnum(OrganisationMemberInviteStatus).optional(),
});

export const ZFindOrganisationMemberInvitesResponseSchema = ZFindResultResponse.extend({
  data: OrganisationMemberInviteSchema.pick({
    id: true,
    organisationId: true,
    email: true,
    createdAt: true,
    organisationRole: true,
    status: true,
  }).array(),
});

export type TFindOrganisationMemberInvitesResponse = z.infer<typeof ZFindOrganisationMemberInvitesResponseSchema>;
