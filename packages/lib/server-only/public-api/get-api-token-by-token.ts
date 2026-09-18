import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { logger } from '../../utils/logger';
import { hashString } from '../auth/hash';
import { assertOrganisationRatesAndLimits } from '../rate-limit/assert-organisation-rates-and-limits';

const LAST_USED_AT_UPDATE_INTERVAL = 60_000; // 1 minute

const ORGANISATION_INCLUDE = {
  organisationClaim: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
      disabled: true,
    },
  },
} as const;

type GetApiTokenByTokenOptions = {
  token: string;

  /**
   * Defaults to false.
   *
   * Will assert that the API request limit is not exceeded.
   */
  bypassRateLimit?: boolean;
};

export const getApiTokenByToken = async ({ token, bypassRateLimit = false }: GetApiTokenByTokenOptions) => {
  const hashedToken = hashString(token);

  const apiToken = await prisma.apiToken.findFirst({
    where: {
      token: hashedToken,
    },
    include: {
      team: {
        include: {
          organisation: {
            include: ORGANISATION_INCLUDE,
          },
        },
      },
      organisation: {
        include: ORGANISATION_INCLUDE,
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
        },
      },
    },
  });

  if (!apiToken) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  // The organisation this token belongs to, if any. INSTANCE tokens have none.
  const organisation = apiToken.team?.organisation ?? apiToken.organisation ?? null;

  if (apiToken.scope !== ApiTokenScope.INSTANCE && !organisation) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  if (apiToken.user?.disabled || organisation?.owner.disabled) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User is disabled',
      statusCode: 401,
    });
  }

  if (apiToken.expires && apiToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Expired token',
      statusCode: 401,
    });
  }

  // INSTANCE tokens are the platform itself and are not subject to per-organisation limits.
  if (!bypassRateLimit && organisation) {
    await assertOrganisationRatesAndLimits({
      organisationId: organisation.id,
      organisationClaim: organisation.organisationClaim,
      type: 'api',
      count: 1,
    });
  }

  // Team and organisation tokens without an explicit user act as the organisation owner.
  // (For team tokens this is "a silly choice from many moons ago"; organisation tokens
  // follow the same rule so every downstream membership check passes.)
  const user = apiToken.user ?? organisation?.owner ?? null;

  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  // Only update the lastUsedAt after X amount of time has passed to reduce
  // the number of writes to the database
  if (!apiToken.lastUsedAt || apiToken.lastUsedAt.getTime() + LAST_USED_AT_UPDATE_INTERVAL < Date.now()) {
    void prisma.apiToken
      .updateMany({
        where: {
          id: apiToken.id,
          // Optimistic guard: skip if another request beat us
          lastUsedAt: apiToken.lastUsedAt,
        },
        data: {
          lastUsedAt: new Date(),
        },
      })
      .catch((err) => {
        logger.warn({
          msg: 'Failed to update API token lastUsedAt',
          apiTokenId: apiToken.id,
          err,
        });
      });
  }

  return {
    ...apiToken,
    user,
    organisation,
  };
};

export type ApiTokenWithRelations = Awaited<ReturnType<typeof getApiTokenByToken>>;
