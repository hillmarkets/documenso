import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { resolveApiTokenScope } from '@documenso/lib/server-only/public-api/resolve-api-token-scope';
import { assertUserNotDisabled } from '@documenso/lib/server-only/user/assert-user-not-disabled';
import type { TrpcApiLog } from '@documenso/lib/types/api-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { alphaid } from '@documenso/lib/universal/id';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { TRPCError } from '@trpc/server';

import type { TrpcContext } from './context';
import { enforceApiTokenScope } from './scope-guard';
import { t } from './trpc-instance';

export type { TrpcRouteMeta } from './trpc-instance';

/**
 * Middlewares
 */

/**
 * Paths under which a procedure does not require a target team. Everything else
 * on the v2 surface is team-scoped and needs `ctx.teamId`.
 */
const TEAM_OPTIONAL_PATH_PREFIXES = ['/organisation', '/admin', '/team'];

const isTeamOptionalPath = (openapiPath: string) =>
  TEAM_OPTIONAL_PATH_PREFIXES.some((prefix) => openapiPath.startsWith(prefix));

type ApiTokenContextOptions = {
  ctx: TrpcContext;
  authorizationHeader: string;
  openapiPath: string;
  baseLogAttributes: TrpcApiLog;
};

/**
 * Shared by the authenticated, maybeAuthenticated and admin middlewares.
 * Validates the bearer token, resolves the tenant it targets and returns the
 * context patch every API-token request runs with.
 */
const buildApiTokenContext = async ({
  ctx,
  authorizationHeader,
  openapiPath,
  baseLogAttributes,
}: ApiTokenContextOptions) => {
  // Support for both "Authorization: Bearer api_xxx" and "Authorization: api_xxx"
  const [token] = authorizationHeader.split('Bearer ').filter((s) => s.length > 0);

  if (!token) {
    throw new Error('Token was not provided for authenticated middleware');
  }

  const apiToken = await getApiTokenByToken({ token });

  const { scope, user, auditName } = await resolveApiTokenScope({ apiToken, headers: ctx.req.headers });

  // Reject API requests from a disabled account. Presenting an API token is an
  // explicit attempt to act under that account, so we reject rather than downgrade.
  assertUserNotDisabled(user);

  if (scope.teamId === null && !isTeamOptionalPath(openapiPath)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'x-team-id header is required for ORGANISATION and INSTANCE tokens on this endpoint',
      statusCode: 400,
    });
  }

  // Attach identifying attributes to the logger so every subsequent log line
  // within this request (including errors) inherits them.
  const logger = ctx.logger.child({
    ...baseLogAttributes,
    auth: 'api',
    userId: user.id,
    apiTokenId: apiToken.id,
  } satisfies TrpcApiLog);

  logger.info({
    position: 'trpcProcedure',
  });

  const isUntargetedInstanceCall = scope.kind === 'instance' && scope.teamId === null && scope.organisationId === null;

  return {
    apiToken,
    ctxPatch: {
      ...ctx,
      logger,
      user,
      session: null,
      scope,
      // -1 matches the sentinel the session branch uses for "no team".
      teamId: scope.teamId ?? -1,
      metadata: {
        ...ctx.metadata,
        auditUser: isUntargetedInstanceCall
          ? { id: user.id, email: user.email, name: user.name }
          : { id: null, email: null, name: auditName },
        auth: 'api',
      } satisfies ApiRequestMetadata,
    },
  };
};

export const authenticatedMiddleware = t.middleware(async ({ ctx, next, path, meta }) => {
  // Auth-independent log bindings. `auth` is set per-branch below since it
  // depends on which auth path was taken; `ctx.metadata.auth` here is still
  // `null` (the resolved value is set in the `next()` call below).
  const baseLogAttributes: TrpcApiLog = {
    path,
    auth: null,
    source: ctx.metadata.source,
    trpcMiddleware: 'authenticated',
    unverifiedTeamId: ctx.teamId,
  };

  const authorizationHeader = ctx.req.headers.get('authorization');

  const isApiV2 = Boolean(meta?.openapi?.path);

  // Taken from `authenticatedMiddleware` in `@documenso/api/v1/middleware/authenticated.ts`.
  if (authorizationHeader && isApiV2) {
    const { ctxPatch } = await buildApiTokenContext({
      ctx,
      authorizationHeader,
      openapiPath: meta?.openapi?.path ?? '',
      baseLogAttributes,
    });

    return await next({ ctx: ctxPatch });
  }

  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid session or API token.',
    });
  }

  // Reject session requests from a disabled account. The session may still be
  // valid (sessions aren't invalidated by `disableUser`), so we gate every
  // authenticated TRPC call here.
  assertUserNotDisabled(ctx.user);

  // Recreate the logger with a sub request ID to differentiate between batched
  // requests, as well as identifying attributes so every subsequent log line
  // (including errors) inherits them.
  const trpcSessionLogger = ctx.logger.child({
    ...baseLogAttributes,
    auth: 'session',
    nonBatchedRequestId: alphaid(),
    userId: ctx.user.id,
    apiTokenId: null,
  } satisfies TrpcApiLog);

  trpcSessionLogger.info({
    position: 'trpcProcedure',
  });

  return await next({
    ctx: {
      ...ctx,
      teamId: ctx.teamId || -1,
      logger: trpcSessionLogger,
      user: ctx.user,
      session: ctx.session,
      metadata: {
        ...ctx.metadata,
        auditUser: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
        },
        auth: 'session',
      } satisfies ApiRequestMetadata,
    },
  });
});

export const maybeAuthenticatedMiddleware = t.middleware(async ({ ctx, next, path, meta }) => {
  const baseLogAttributes: TrpcApiLog = {
    path,
    auth: null,
    source: ctx.metadata.source,
    trpcMiddleware: 'maybeAuthenticated',
    unverifiedTeamId: ctx.teamId,
  };

  const authorizationHeader = ctx.req.headers.get('authorization');

  const isApiV2 = Boolean(meta?.openapi?.path);

  // Taken from `authenticatedMiddleware` in `@documenso/api/v1/middleware/authenticated.ts`.
  if (authorizationHeader && isApiV2) {
    const { ctxPatch } = await buildApiTokenContext({
      ctx,
      authorizationHeader,
      openapiPath: meta?.openapi?.path ?? '',
      baseLogAttributes,
    });

    return await next({ ctx: ctxPatch });
  }

  // Treat a disabled session as anonymous. Most routes wired through
  // `maybeAuthenticatedProcedure` are signer/invite flows that key off an
  // input token rather than `ctx.user`, so downgrading lets those keep
  // working while routes that genuinely need an account naturally fall
  // through to their own auth checks.
  const sessionUser = ctx.user && !ctx.user.disabled ? ctx.user : null;
  const sessionRecord = sessionUser ? ctx.session : null;

  // Resolve `auth` once so it stays in sync between the logger bindings and
  // the outgoing metadata.
  const auth = sessionRecord ? 'session' : null;

  // Recreate the logger with a sub request ID to differentiate between batched
  // requests, as well as identifying attributes so every subsequent log line
  // (including errors) inherits them.
  const trpcSessionLogger = ctx.logger.child({
    ...baseLogAttributes,
    auth,
    nonBatchedRequestId: alphaid(),
    userId: sessionUser?.id,
    apiTokenId: null,
  } satisfies TrpcApiLog);

  trpcSessionLogger.info({
    position: 'trpcProcedure',
  });

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
      user: sessionUser,
      session: sessionRecord,
      metadata: {
        ...ctx.metadata,
        auditUser: sessionUser
          ? {
              id: sessionUser.id,
              name: sessionUser.name,
              email: sessionUser.email,
            }
          : undefined,
        auth,
      } satisfies ApiRequestMetadata,
    },
  });
});

export const adminMiddleware = t.middleware(async ({ ctx, next, path, meta }) => {
  const authorizationHeader = ctx.req.headers.get('authorization');

  const isApiV2 = Boolean(meta?.openapi?.path);

  if (authorizationHeader && isApiV2) {
    const { apiToken, ctxPatch } = await buildApiTokenContext({
      ctx,
      authorizationHeader,
      openapiPath: meta?.openapi?.path ?? '',
      baseLogAttributes: {
        path,
        auth: null,
        source: ctx.metadata.source,
        trpcMiddleware: 'admin',
        unverifiedTeamId: ctx.teamId,
      },
    });

    if (apiToken.scope !== 'INSTANCE') {
      throw new AppError(AppErrorCode.FORBIDDEN, {
        message: 'This endpoint requires an INSTANCE-scoped API token',
        statusCode: 403,
      });
    }

    return await next({ ctx: ctxPatch });
  }

  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action.',
    });
  }

  // Disabled admins shouldn't be able to do anything either.
  assertUserNotDisabled(ctx.user);

  const isUserAdmin = isAdmin(ctx.user);

  if (!isUserAdmin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authorized to perform this action.',
    });
  }

  // Recreate the logger with a sub request ID to differentiate between batched
  // requests, as well as identifying attributes so every subsequent log line
  // (including errors) inherits them.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
    unverifiedTeamId: ctx.teamId,
    path,
    auth: 'session',
    source: ctx.metadata.source,
    userId: ctx.user.id,
    apiTokenId: null,
    trpcMiddleware: 'admin',
  } satisfies TrpcApiLog);

  trpcSessionLogger.info({
    position: 'trpcProcedure',
  });

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
      user: ctx.user,
      session: ctx.session,
      metadata: {
        ...ctx.metadata,
        auditUser: {
          id: ctx.user.id,
          name: ctx.user.name,
          email: ctx.user.email,
        },
        auth: 'session',
      } satisfies ApiRequestMetadata,
    },
  });
});

export const procedureMiddleware = t.middleware(async ({ ctx, next, path }) => {
  // Recreate the logger with a sub request ID to differentiate between batched
  // requests, as well as identifying attributes so every subsequent log line
  // (including errors) inherits them.
  const trpcSessionLogger = ctx.logger.child({
    nonBatchedRequestId: alphaid(),
    unverifiedTeamId: ctx.teamId,
    path,
    auth: ctx.metadata.auth,
    source: ctx.metadata.source,
    userId: ctx.user?.id,
    apiTokenId: null,
    trpcMiddleware: 'procedure',
  } satisfies TrpcApiLog);

  trpcSessionLogger.info({
    position: 'trpcProcedure',
  });

  return await next({
    ctx: {
      ...ctx,
      logger: trpcSessionLogger,
    },
  });
});

/**
 * Routers and Procedures
 */
export const router = t.router;
export const procedure = t.procedure.use(procedureMiddleware);
export const authenticatedProcedure = t.procedure.use(authenticatedMiddleware).use(enforceApiTokenScope);
// While this is functionally the same as `procedure`, it's useful for indicating purpose
export const maybeAuthenticatedProcedure = t.procedure.use(maybeAuthenticatedMiddleware).use(enforceApiTokenScope);
export const adminProcedure = t.procedure.use(adminMiddleware);
