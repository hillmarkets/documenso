import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  createInstanceApiToken,
  createOrganisationApiToken,
} from '@documenso/lib/server-only/public-api/create-scoped-api-token';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

test.describe.configure({
  mode: 'parallel',
});

const get = (request: APIRequestContext, path: string, token: string, headers: Record<string, string> = {}) =>
  request.get(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });

test.describe('Scoped API tokens', () => {
  test('team, organisation and instance tokens across endpoint classes', async ({ request }) => {
    const { owner, team, organisation } = await seedTeam();
    const { team: foreignTeam, organisation: foreignOrganisation } = await seedTeam();
    const { user: admin } = await seedUser({ isAdmin: true });

    const teamToken = (await createApiToken({ userId: owner.id, teamId: team.id, tokenName: 'team', expiresIn: null }))
      .token;

    const organisationToken = (
      await createOrganisationApiToken({
        userId: owner.id,
        organisationId: organisation.id,
        tokenName: 'organisation',
        expiresIn: null,
      })
    ).token;

    const instanceToken = (await createInstanceApiToken({ userId: admin.id, tokenName: 'instance', expiresIn: null }))
      .token;

    // Team-scoped endpoint: document.find
    expect((await get(request, '/document', teamToken)).status()).toBe(200);
    expect((await get(request, '/document', organisationToken)).status()).toBe(400);
    expect((await get(request, '/document', organisationToken, { 'x-team-id': String(team.id) })).status()).toBe(200);
    expect((await get(request, '/document', organisationToken, { 'x-team-id': String(foreignTeam.id) })).status()).toBe(
      403,
    );
    expect((await get(request, '/document', instanceToken)).status()).toBe(400);
    expect((await get(request, '/document', instanceToken, { 'x-team-id': String(foreignTeam.id) })).status()).toBe(
      200,
    );

    // Organisation endpoint: organisation.get
    expect((await get(request, `/organisation/${organisation.id}`, teamToken)).status()).toBe(403);
    expect((await get(request, `/organisation/${organisation.id}`, organisationToken)).status()).toBe(200);
    expect((await get(request, `/organisation/${foreignOrganisation.id}`, organisationToken)).status()).toBe(403);
    expect(
      (
        await get(request, `/organisation/${foreignOrganisation.id}`, instanceToken, {
          'x-organisation-id': foreignOrganisation.id,
        })
      ).status(),
    ).toBe(200);

    // Admin endpoint: admin.user.get
    expect((await get(request, `/admin/user/${owner.id}`, teamToken)).status()).toBe(403);
    expect((await get(request, `/admin/user/${owner.id}`, organisationToken)).status()).toBe(403);
    expect((await get(request, `/admin/user/${owner.id}`, instanceToken)).status()).toBe(200);

    // v1 only accepts team tokens
    const v1 = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents`, {
      headers: { Authorization: `Bearer ${organisationToken}` },
    });
    expect(v1.status()).toBe(403);
  });

  test('instance token creates organisation, team and reads documents', async ({ request }) => {
    const { user: admin } = await seedUser({ isAdmin: true });
    const { user: ownerToBe } = await seedUser();

    const token = (await createInstanceApiToken({ userId: admin.id, tokenName: 'instance', expiresIn: null })).token;
    const auth = { Authorization: `Bearer ${token}` };

    const organisationResponse = await request.post(`${baseUrl}/admin/organisation/create`, {
      headers: auth,
      data: { ownerUserId: ownerToBe.id, data: { name: 'Acme' } },
    });
    expect(organisationResponse.status()).toBe(200);
    const { organisationId } = (await organisationResponse.json()) as { organisationId: string };

    const teamResponse = await request.post(`${baseUrl}/team/create`, {
      headers: { ...auth, 'x-organisation-id': organisationId },
      data: { organisationId, teamName: 'Sales', teamUrl: `sales-${Date.now()}`, inheritMembers: true },
    });
    expect(teamResponse.status()).toBe(200);
    const { id: teamId } = (await teamResponse.json()) as { id: number };

    const documentsResponse = await get(request, '/document', token, { 'x-team-id': String(teamId) });
    expect(documentsResponse.status()).toBe(200);
  });
});
