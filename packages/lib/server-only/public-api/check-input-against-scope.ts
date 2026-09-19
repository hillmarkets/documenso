import type { ApiScope } from './resolve-api-token-scope';

export type ScopeViolation = { status: 403; message: string };

const ORGANISATION_KEYS = ['organisationId', 'organisationReference'] as const;

/**
 * Input keys that name a team. Exported so the tRPC guard can validate them
 * against the organisation for ORGANISATION tokens.
 */
export const TEAM_REFERENCE_KEYS = ['teamId', 'teamReference', 'transferTeamId'] as const;

/**
 * TEAM tokens are for document work inside one team. Tenant management lives on
 * these prefixes and is reserved for ORGANISATION and INSTANCE tokens.
 */
const TEAM_TOKEN_FORBIDDEN_PREFIXES = ['/organisation', '/team'];

const readString = (input: Record<string, unknown>, key: string): string | null => {
  const value = input[key];

  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};

/**
 * Pure: given the resolved scope and a procedure's raw input, decide whether the
 * input references a tenant the token is not allowed to touch.
 *
 * Returns null when allowed. Organisation routes accept an id OR a url, so the
 * caller passes the scoped organisation's url alongside the scope to compare both.
 *
 * For ORGANISATION tokens, team references are checked against the database by
 * the tRPC guard (`readTeamReferences`), not here.
 */
export const checkInputAgainstScope = (
  scope: ApiScope,
  rawInput: unknown,
  openapiPath: string,
  organisationUrl?: string,
): ScopeViolation | null => {
  if (scope.kind === 'instance') {
    return null;
  }

  if (openapiPath.startsWith('/admin')) {
    return { status: 403, message: 'This endpoint requires an INSTANCE-scoped API token' };
  }

  if (scope.kind === 'team' && TEAM_TOKEN_FORBIDDEN_PREFIXES.some((prefix) => openapiPath.startsWith(prefix))) {
    return { status: 403, message: 'This endpoint requires an ORGANISATION or INSTANCE-scoped API token' };
  }

  if (typeof rawInput !== 'object' || rawInput === null || Array.isArray(rawInput)) {
    return null;
  }

  const input = rawInput as Record<string, unknown>;

  for (const key of ORGANISATION_KEYS) {
    const value = readString(input, key);

    if (value !== null && value !== scope.organisationId && value !== organisationUrl) {
      return { status: 403, message: 'Token is scoped to a different organisation' };
    }
  }

  if (scope.kind === 'team') {
    for (const key of TEAM_REFERENCE_KEYS) {
      const value = readString(input, key);

      if (value !== null && value !== String(scope.teamId)) {
        return { status: 403, message: 'Token is scoped to a different team' };
      }
    }
  }

  return null;
};

/**
 * Every team reference present in the input, for the tRPC guard to validate.
 */
export const readTeamReferences = (rawInput: unknown): string[] => {
  if (typeof rawInput !== 'object' || rawInput === null || Array.isArray(rawInput)) {
    return [];
  }

  const input = rawInput as Record<string, unknown>;

  return TEAM_REFERENCE_KEYS.map((key) => readString(input, key)).filter((value): value is string => value !== null);
};
