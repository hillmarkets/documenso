import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamLimits, type TTeamLimits } from '../../types/limits';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

/**
 * Usage allowances for a team the user belongs to. Self-hosted instances have no
 * billing, so everything is unlimited apart from the organisation claim's
 * envelope item count.
 */
export const getServerLimits = async ({ userId, teamId }: GetServerLimitsOptions): Promise<TTeamLimits> => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      teams: { some: { id: teamId } },
      members: { some: { userId } },
    },
    select: {
      organisationClaim: { select: { envelopeItemCount: true } },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  return buildTeamLimits(organisation.organisationClaim.envelopeItemCount);
};
