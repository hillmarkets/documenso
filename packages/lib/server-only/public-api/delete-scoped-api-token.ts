import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../utils/organisations';

export type DeleteOrganisationApiTokenOptions = {
  id: number;
  userId: number;
  organisationId: string;
};

export const deleteOrganisationApiToken = async ({ id, userId, organisationId }: DeleteOrganisationApiTokenOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to delete this token',
    });
  }

  await prisma.apiToken.delete({
    where: {
      id,
      scope: ApiTokenScope.ORGANISATION,
      organisationId,
    },
  });
};

export const deleteInstanceApiToken = async ({ id }: { id: number }) => {
  await prisma.apiToken.delete({
    where: {
      id,
      scope: ApiTokenScope.INSTANCE,
    },
  });
};
