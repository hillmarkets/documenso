import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';
import type { Duration } from 'luxon';
import { DateTime } from 'luxon';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/organisations';
import * as timeConstants from '../../constants/time';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { alphaid } from '../../universal/id';
import { buildOrganisationWhereQuery } from '../../utils/organisations';
import { hashString } from '../auth/hash';

type TimeConstants = typeof timeConstants & {
  [key: string]: number | Duration;
};

const timeConstantsRecords: TimeConstants = timeConstants;

const expiresAt = (expiresIn: string | null) =>
  expiresIn ? DateTime.now().plus(timeConstantsRecords[expiresIn]).toJSDate() : null;

const mintToken = () => {
  const token = `api_${alphaid(16)}`;

  return { token, hashedToken: hashString(token) };
};

export type CreateOrganisationApiTokenOptions = {
  userId: number;
  organisationId: string;
  tokenName: string;
  expiresIn: string | null;
};

export const createOrganisationApiToken = async ({
  userId,
  organisationId,
  tokenName,
  expiresIn,
}: CreateOrganisationApiTokenOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'You do not have permission to create a token for this organisation',
    });
  }

  const { token, hashedToken } = mintToken();

  const storedToken = await prisma.apiToken.create({
    data: {
      name: tokenName,
      token: hashedToken,
      scope: ApiTokenScope.ORGANISATION,
      expires: expiresAt(expiresIn),
      userId,
      organisationId,
    },
  });

  return {
    id: storedToken.id,
    token,
  };
};

export type CreateInstanceApiTokenOptions = {
  /**
   * The admin minting the token. The caller (adminProcedure) guarantees this
   * user has the ADMIN role.
   */
  userId: number;
  tokenName: string;
  expiresIn: string | null;
};

export const createInstanceApiToken = async ({ userId, tokenName, expiresIn }: CreateInstanceApiTokenOptions) => {
  const { token, hashedToken } = mintToken();

  const storedToken = await prisma.apiToken.create({
    data: {
      name: tokenName,
      token: hashedToken,
      scope: ApiTokenScope.INSTANCE,
      expires: expiresAt(expiresIn),
      userId,
    },
  });

  return {
    id: storedToken.id,
    token,
  };
};
