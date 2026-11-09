import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveOAuthClaims } from './resolve-oauth-claims';

const USERINFO_ENDPOINT = 'https://auth.example.com/oauth2/userinfo';

const mockUserInfo = (body: unknown, status = 200) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
};

describe('resolveOAuthClaims', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call UserInfo when the ID token already has the profile', async () => {
    const fetchMock = mockUserInfo({});

    const idTokenClaims = { sub: 'abc', email: 'a@example.com', name: 'A', email_verified: true };

    const claims = await resolveOAuthClaims({
      idTokenClaims,
      userInfoEndpoint: USERINFO_ENDPOINT,
      accessToken: 'token',
    });

    expect(claims).toEqual(idTokenClaims);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the ID token claims when the provider has no userinfo endpoint', async () => {
    const fetchMock = mockUserInfo({});

    const claims = await resolveOAuthClaims({
      idTokenClaims: { sub: 'abc' },
      accessToken: 'token',
    });

    expect(claims).toEqual({ sub: 'abc' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('takes email, name and email_verified from UserInfo when the ID token only has sub', async () => {
    const fetchMock = mockUserInfo({ sub: 'abc', email: 'a@example.com', name: 'A', email_verified: true });

    const claims = await resolveOAuthClaims({
      idTokenClaims: { sub: 'abc' },
      userInfoEndpoint: USERINFO_ENDPOINT,
      accessToken: 'token',
    });

    expect(claims).toMatchObject({ sub: 'abc', email: 'a@example.com', name: 'A', email_verified: true });
    expect(fetchMock).toHaveBeenCalledWith(
      USERINFO_ENDPOINT,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    );
  });

  it('falls back to ID token claims for fields UserInfo does not return', async () => {
    mockUserInfo({ sub: 'abc', name: 'From UserInfo' });

    const claims = await resolveOAuthClaims({
      idTokenClaims: { sub: 'abc', email: 'a@example.com', email_verified: true },
      userInfoEndpoint: USERINFO_ENDPOINT,
      accessToken: 'token',
    });

    expect(claims).toMatchObject({ email: 'a@example.com', name: 'From UserInfo', email_verified: true });
  });

  it('does not pair an ID token email_verified with a different UserInfo email', async () => {
    mockUserInfo({ sub: 'abc', email: 'other@example.com', name: 'A' });

    const claims = await resolveOAuthClaims({
      idTokenClaims: { sub: 'abc', email: 'a@example.com', email_verified: true },
      userInfoEndpoint: USERINFO_ENDPOINT,
      accessToken: 'token',
    });

    expect(claims.email).toBe('other@example.com');
    expect(claims.email_verified).toBeUndefined();
  });

  it('rejects a UserInfo sub that differs from the ID token sub', async () => {
    mockUserInfo({ sub: 'someone-else', email: 'a@example.com', name: 'A', email_verified: true });

    await expect(
      resolveOAuthClaims({ idTokenClaims: { sub: 'abc' }, userInfoEndpoint: USERINFO_ENDPOINT, accessToken: 'token' }),
    ).rejects.toThrow('UserInfo sub does not match ID token sub');
  });

  it('rejects a UserInfo response with no sub', async () => {
    mockUserInfo({ email: 'a@example.com', name: 'A', email_verified: true });

    await expect(
      resolveOAuthClaims({ idTokenClaims: { sub: 'abc' }, userInfoEndpoint: USERINFO_ENDPOINT, accessToken: 'token' }),
    ).rejects.toThrow('UserInfo sub does not match ID token sub');
  });

  it('rejects when the UserInfo request fails', async () => {
    mockUserInfo({ error: 'invalid_token' }, 401);

    await expect(
      resolveOAuthClaims({ idTokenClaims: { sub: 'abc' }, userInfoEndpoint: USERINFO_ENDPOINT, accessToken: 'token' }),
    ).rejects.toThrow('Failed to fetch UserInfo: 401');
  });
});
