import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { buildOrganisationWhereQuery } from '../../utils/organisations';

const TOKEN_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  expires: true,
  lastUsedAt: true,
} as const;

export type GetOrganisationApiTokensOptions = {
  userId: number;
  organisationId: string;
};

export const getOrganisationApiTokens = async ({ userId, organisationId }: GetOrganisationApiTokensOptions) => {
  return await prisma.apiToken.findMany({
    where: {
      scope: ApiTokenScope.ORGANISATION,
      organisation: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    },
    select: TOKEN_SELECT,
    orderBy: {
      createdAt: 'desc',
    },
  });
};

export const getInstanceApiTokens = async () => {
  return await prisma.apiToken.findMany({
    where: {
      scope: ApiTokenScope.INSTANCE,
    },
    select: {
      ...TOKEN_SELECT,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};
