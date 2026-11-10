import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOpenIdConfiguration } from './open-id';

const mockDiscovery = (userinfo_endpoint?: string) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            userinfo_endpoint,
          }),
        ),
    ),
  );
};

describe('getOpenIdConfiguration userinfo_endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps an https userinfo endpoint', async () => {
    mockDiscovery('https://auth.example.com/userinfo');

    const config = await getOpenIdConfiguration('https://auth.example.com/.well-known/openid-configuration');

    expect(config.userinfo_endpoint).toBe('https://auth.example.com/userinfo');
  });

  it('ignores an http or unparseable userinfo endpoint', async () => {
    for (const endpoint of ['http://auth.example.com/userinfo', 'not a url']) {
      mockDiscovery(endpoint);

      const config = await getOpenIdConfiguration('https://auth.example.com/.well-known/openid-configuration');

      expect(config.userinfo_endpoint).toBeUndefined();
    }
  });
});
