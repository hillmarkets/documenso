import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiTokenWithRelations } from './get-api-token-by-token';

export type TeamScopedApiToken = ApiTokenWithRelations & {
  scope: typeof ApiTokenScope.TEAM;
  teamId: number;
  team: NonNullable<ApiTokenWithRelations['team']>;
};

/**
 * Narrows a token to TEAM scope. Used by surfaces that only support team tokens
 * (API v1, Zapier, embedding presign).
 */
export const requireTeamScopedToken = (apiToken: ApiTokenWithRelations, surface: string): TeamScopedApiToken => {
  if (apiToken.scope !== ApiTokenScope.TEAM || apiToken.teamId === null || !apiToken.team) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: `${surface} only supports team-scoped tokens; use /api/v2 with an x-team-id header`,
      statusCode: 403,
    });
  }

  return apiToken as TeamScopedApiToken;
};
