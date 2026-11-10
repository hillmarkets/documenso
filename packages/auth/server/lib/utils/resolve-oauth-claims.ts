import { AppError } from '@documenso/lib/errors/app-error';

import { AuthenticationErrorCode } from '../errors/error-codes';

const USERINFO_TIMEOUT_MS = 10_000;

type ResolveOAuthClaimsOptions = {
  /**
   * The decoded ID token claims.
   */
  idTokenClaims: Record<string, unknown>;

  /**
   * The provider's `userinfo_endpoint`, if its discovery document advertises one.
   */
  userInfoEndpoint?: string;

  accessToken: string;
};

/**
 * Some providers (Google, Microsoft) put the profile claims in the ID token, others
 * only serve them from the UserInfo endpoint. Only call UserInfo when the ID token
 * is missing something we need.
 *
 * The `sub` always comes from the ID token. When UserInfo is fetched its `sub` must
 * match, see OIDC Core 5.3.2.
 */
export const resolveOAuthClaims = async (options: ResolveOAuthClaimsOptions): Promise<Record<string, unknown>> => {
  const { idTokenClaims, userInfoEndpoint, accessToken } = options;

  const hasProfileInIdToken =
    typeof idTokenClaims.email === 'string' &&
    typeof idTokenClaims.name === 'string' &&
    idTokenClaims.email_verified !== undefined;

  if (hasProfileInIdToken || !userInfoEndpoint) {
    return idTokenClaims;
  }

  let userInfo: unknown;

  try {
    const response = await fetch(userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(USERINFO_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new AppError(AuthenticationErrorCode.InvalidRequest, {
        message: `Failed to fetch UserInfo: ${response.status}`,
      });
    }

    userInfo = await response.json();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Failed to fetch UserInfo',
    });
  }

  if (typeof userInfo !== 'object' || userInfo === null) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Invalid UserInfo response',
    });
  }

  const userInfoClaims = userInfo as Record<string, unknown>;

  if (typeof idTokenClaims.sub !== 'string' || idTokenClaims.sub === '' || userInfoClaims.sub !== idTokenClaims.sub) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'UserInfo sub does not match ID token sub',
    });
  }

  // Keep the email and its verification flag from the same source so a verified
  // flag from one document never vouches for a different email from the other.
  // The same email (ignoring case) is the same source, so a verified ID token
  // email is kept when UserInfo repeats it or omits email_verified.
  const sameEmail =
    typeof idTokenClaims.email === 'string' &&
    typeof userInfoClaims.email === 'string' &&
    idTokenClaims.email.toLowerCase() === userInfoClaims.email.toLowerCase();

  const emailSource = typeof userInfoClaims.email === 'string' && !sameEmail ? userInfoClaims : idTokenClaims;

  return {
    ...idTokenClaims,
    name: userInfoClaims.name ?? idTokenClaims.name,
    email: emailSource.email,
    email_verified: sameEmail
      ? (idTokenClaims.email_verified ?? userInfoClaims.email_verified)
      : emailSource.email_verified,
  };
};
