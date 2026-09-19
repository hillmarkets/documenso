import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';
import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';
import SubscriptionSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';
import UserSchema from '@documenso/prisma/generated/zod/modelSchema/UserSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const findAdminOrganisationsMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/organisation',
    summary: 'Find organisations',
    description: 'List every organisation on the instance. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZFindAdminOrganisationsRequestSchema = ZFindSearchParamsSchema.extend({
  ownerUserId: z.number().optional(),
  memberUserId: z.number().optional(),
});

export const ZFindAdminOrganisationsResponseSchema = ZFindResultResponse.extend({
  data: OrganisationSchema.pick({
    id: true,
    createdAt: true,
    updatedAt: true,
    name: true,
    url: true,
    customerId: true,
  })
    .extend({
      owner: UserSchema.pick({
        id: true,
        email: true,
        name: true,
      }),
      subscription: SubscriptionSchema.pick({
        status: true,
        id: true,
        planId: true,
        priceId: true,
        periodEnd: true,
        createdAt: true,
        updatedAt: true,
        cancelAtPeriodEnd: true,
      }).nullable(),
    })
    .array(),
});

export type TFindAdminOrganisationsResponse = z.infer<typeof ZFindAdminOrganisationsResponseSchema>;
