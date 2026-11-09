import { AppError } from '@documenso/lib/errors/app-error';

import { AuthenticationErrorCode } from '../errors/error-codes';

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

  const response = await fetch(userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: `Failed to fetch UserInfo: ${response.status}`,
    });
  }

  const userInfo: unknown = await response.json();

  if (typeof userInfo !== 'object' || userInfo === null) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'Invalid UserInfo response',
    });
  }

  const userInfoClaims = userInfo as Record<string, unknown>;

  if (typeof idTokenClaims.sub !== 'string' || userInfoClaims.sub !== idTokenClaims.sub) {
    throw new AppError(AuthenticationErrorCode.InvalidRequest, {
      message: 'UserInfo sub does not match ID token sub',
    });
  }

  // Keep the email and its verification flag from the same source so a verified
  // flag from one document never vouches for an email from the other.
  const emailSource = typeof userInfoClaims.email === 'string' ? userInfoClaims : idTokenClaims;

  return {
    ...idTokenClaims,
    name: userInfoClaims.name ?? idTokenClaims.name,
    email: emailSource.email,
    email_verified: emailSource.email_verified,
  };
};
