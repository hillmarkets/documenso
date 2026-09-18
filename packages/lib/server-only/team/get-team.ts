import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { buildTeamWhereQuery, extractDerivedTeamSettings, getHighestTeamRoleInGroup } from '../../utils/teams';

export type GetTeamByIdOptions = {
  userId: number;
  teamId: number;
};

export const getTeamById = async ({ userId, teamId }: GetTeamByIdOptions) => {
  return await getTeam({
    teamReference: teamId,
    userId,
  });
};

export type GetTeamByUrlOptions = {
  userId: number;
  teamUrl: string;
};

export type TGetTeamByUrlResponse = Awaited<ReturnType<typeof getTeamByUrl>>;

/**
 * Get a team given a team URL.
 */
export const getTeamByUrl = async ({ userId, teamUrl }: GetTeamByUrlOptions) => {
  return await getTeam({
    teamReference: teamUrl,
    userId,
  });
};

/**
 * Get a team by its ID or URL.
 */
export const getTeam = async ({ teamReference, userId }: { teamReference: number | string; userId: number }) => {
  // A numeric reference may be an ID or an all-digit URL, so match either.
  const numericReference = Number(teamReference);
  const isNumeric = Number.isInteger(numericReference) && numericReference > 0;

  const team = await prisma.team.findFirst({
    where: {
      ...buildTeamWhereQuery({ teamId: undefined, userId }),
      OR: isNumeric ? [{ id: numericReference }, { url: String(teamReference) }] : [{ url: String(teamReference) }],
    },
    include: {
      teamEmail: true,
      teamGroups: {
        where: {
          organisationGroup: {
            organisationGroupMembers: {
              some: {
                organisationMember: {
                  userId,
                },
              },
            },
          },
        },
      },
      teamGlobalSettings: true,
      organisation: {
        include: {
          organisationGlobalSettings: true,
        },
      },
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Team not found',
    });
  }

  const organisationSettings = team.organisation.organisationGlobalSettings;
  const teamSettings = team.teamGlobalSettings;

  return {
    ...team,
    currentTeamRole: getHighestTeamRoleInGroup(team.teamGroups),
    teamSettings,
    derivedSettings: extractDerivedTeamSettings(organisationSettings, teamSettings),
  };
};
