import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  checkInputAgainstScope,
  readTeamReferences,
} from '@documenso/lib/server-only/public-api/check-input-against-scope';
import type { ApiScope } from '@documenso/lib/server-only/public-api/resolve-api-token-scope';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { experimental_standaloneMiddleware } from '@trpc/server';

import type { TrpcRouteMeta } from './trpc-instance';

type ScopeGuardContext = {
  scope: ApiScope | null;
  metadata: ApiRequestMetadata;
};

/**
 * Standalone so it can be chained after any context-narrowing middleware.
 * Rejects API-token requests whose input references a tenant outside the token's
 * scope. Primary keys (organisationId, teamId, ...Reference, transferTeamId) are
 * checked here; everything else relies on the procedure's own membership check,
 * which the acting user (the organisation owner) fails for foreign tenants.
 */
export const enforceApiTokenScope = experimental_standaloneMiddleware<{
  ctx: ScopeGuardContext;
  meta: TrpcRouteMeta;
}>().create(async ({ ctx, next, meta, getRawInput }) => {
  if (!ctx.scope || ctx.metadata.auth !== 'api') {
    return await next();
  }

  const openapiPath = meta?.openapi?.path ?? '';
  const rawInput = await getRawInput();

  // Organisation routes accept an id OR a url; look the url up once so the guard can compare both.
  const organisationUrl =
    ctx.scope.kind === 'organisation' && ctx.scope.organisationId
      ? (
          await prisma.organisation.findFirst({
            where: { id: ctx.scope.organisationId },
            select: { url: true },
          })
        )?.url
      : undefined;

  const violation = checkInputAgainstScope(ctx.scope, rawInput, openapiPath, organisationUrl);

  if (violation) {
    throw new AppError(AppErrorCode.FORBIDDEN, {
      message: violation.message,
      statusCode: violation.status,
    });
  }

  // ORGANISATION tokens: every team named in the input must belong to the organisation.
  if (ctx.scope.kind === 'organisation' && ctx.scope.organisationId) {
    const references = readTeamReferences(rawInput);

    if (references.length > 0) {
      const numericIds = references.map(Number).filter((value) => Number.isInteger(value) && value > 0);

      const teams = await prisma.team.findMany({
        where: {
          organisationId: ctx.scope.organisationId,
          OR: [{ id: { in: numericIds } }, { url: { in: references } }],
        },
        select: { id: true, url: true },
      });

      const known = new Set(teams.flatMap((team) => [String(team.id), team.url]));

      if (!references.every((reference) => known.has(reference))) {
        throw new AppError(AppErrorCode.FORBIDDEN, {
          message: 'Token is scoped to a different organisation',
          statusCode: 403,
        });
      }
    }
  }

  return await next();
});
