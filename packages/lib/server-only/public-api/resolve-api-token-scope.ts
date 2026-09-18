import { prisma } from '@documenso/prisma';
import { ApiTokenScope } from '@prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';
import type { ApiTokenWithRelations } from './get-api-token-by-token';

export const X_TEAM_ID_HEADER = 'x-team-id';
export const X_ORGANISATION_ID_HEADER = 'x-organisation-id';

export type ApiScopeKind = 'instance' | 'organisation' | 'team';

export type ApiScope = {
  kind: ApiScopeKind;
  apiTokenId: number;
  /** Resolved target team, if any. */
  teamId: number | null;
  /** Resolved target organisation, if any. */
  organisationId: string | null;
};

type ScopeTargetInput = {
  scope: ApiTokenScope;
  teamId: number | null;
  organisationId: string | null;
};

export type ScopeTargetResult =
  | { ok: true; kind: ApiScopeKind; teamId: number | null; organisationId: string | null }
  | { ok: false; status: 400 | 403; message: string };

/**
 * Pure: decide which tenant a token is targeting from its scope and the request
 * headers. Does not touch the database. Existence and membership of the target
 * are validated by `resolveApiTokenScope`.
 */
export const resolveScopeTarget = (token: ScopeTargetInput, headers: Headers): ScopeTargetResult => {
  const rawTeamId = headers.get(X_TEAM_ID_HEADER);
  const rawOrganisationId = headers.get(X_ORGANISATION_ID_HEADER);

  let headerTeamId: number | null = null;

  if (rawTeamId !== null && rawTeamId !== '') {
    const parsed = Number(rawTeamId);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, status: 400, message: `${X_TEAM_ID_HEADER} must be a number` };
    }

    headerTeamId = parsed;
  }

  const headerOrganisationId = rawOrganisationId ? rawOrganisationId : null;

  switch (token.scope) {
    case ApiTokenScope.TEAM:
      return { ok: true, kind: 'team', teamId: token.teamId, organisationId: null };

    case ApiTokenScope.ORGANISATION:
      if (headerOrganisationId && headerOrganisationId !== token.organisationId) {
        return { ok: false, status: 403, message: 'Token is scoped to a different organisation' };
      }

      return { ok: true, kind: 'organisation', teamId: headerTeamId, organisationId: token.organisationId };

    case ApiTokenScope.INSTANCE:
      return { ok: true, kind: 'instance', teamId: headerTeamId, organisationId: headerOrganisationId };
  }
};

const OWNER_SELECT = { id: true, name: true, email: true, disabled: true } as const;

export type ResolvedApiTokenScope = {
  scope: ApiScope;
  /** The user every downstream procedure and audit log will act as. */
  user: ApiTokenWithRelations['user'];
  /** Name recorded in audit logs when the token stands in for a team or organisation. */
  auditName: string;
};

type ResolveApiTokenScopeOptions = {
  apiToken: ApiTokenWithRelations;
  headers: Headers;
};

/**
 * Turn a token and request headers into a typed scope and an acting user.
 * This is the ONLY place `x-team-id` / `x-organisation-id` are read.
 */
export const resolveApiTokenScope = async ({
  apiToken,
  headers,
}: ResolveApiTokenScopeOptions): Promise<ResolvedApiTokenScope> => {
  const target = resolveScopeTarget(apiToken, headers);

  if (!target.ok) {
    throw new AppError(target.status === 403 ? AppErrorCode.FORBIDDEN : AppErrorCode.INVALID_REQUEST, {
      message: target.message,
      statusCode: target.status,
    });
  }

  const scopeBase = { apiTokenId: apiToken.id, kind: target.kind };

  // TEAM: nothing to look up, the token already carries its team.
  if (target.kind === 'team') {
    return {
      scope: { ...scopeBase, teamId: target.teamId, organisationId: apiToken.team?.organisationId ?? null },
      user: apiToken.user,
      auditName: apiToken.team?.name ?? apiToken.name,
    };
  }

  // A team was named: validate it exists and, for ORG tokens, belongs to the token's organisation.
  if (target.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: target.teamId },
      select: {
        name: true,
        organisationId: true,
        organisation: { select: { owner: { select: OWNER_SELECT } } },
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Team not found', statusCode: 404 });
    }

    if (target.kind === 'organisation' && team.organisationId !== target.organisationId) {
      throw new AppError(AppErrorCode.FORBIDDEN, {
        message: 'Team does not belong to the organisation this token is scoped to',
        statusCode: 403,
      });
    }

    if (target.kind === 'instance' && target.organisationId && team.organisationId !== target.organisationId) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: `${X_TEAM_ID_HEADER} and ${X_ORGANISATION_ID_HEADER} refer to different organisations`,
        statusCode: 400,
      });
    }

    return {
      scope: { ...scopeBase, teamId: target.teamId, organisationId: team.organisationId },
      user: team.organisation.owner,
      auditName: team.name,
    };
  }

  // An organisation was named (ORG token, or INSTANCE token with x-organisation-id).
  if (target.organisationId !== null) {
    const organisation =
      apiToken.organisation?.id === target.organisationId
        ? apiToken.organisation
        : await prisma.organisation.findFirst({
            where: { id: target.organisationId },
            select: { id: true, name: true, owner: { select: OWNER_SELECT } },
          });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found', statusCode: 404 });
    }

    return {
      scope: { ...scopeBase, teamId: null, organisationId: organisation.id },
      user: organisation.owner,
      auditName: organisation.name,
    };
  }

  // INSTANCE token with no target: act as the admin who owns the token.
  return {
    scope: { ...scopeBase, teamId: null, organisationId: null },
    user: apiToken.user,
    auditName: apiToken.name,
  };
};
