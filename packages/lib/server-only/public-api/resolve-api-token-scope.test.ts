import { ApiTokenScope } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { resolveScopeTarget } from './resolve-api-token-scope';

const headers = (h: Record<string, string>) => new Headers(h);

describe('resolveScopeTarget', () => {
  it('TEAM token ignores headers and targets its own team', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.TEAM, teamId: 7, organisationId: null },
      headers({ 'x-team-id': '99', 'x-organisation-id': 'org_x' }),
    );

    expect(r).toEqual({ ok: true, kind: 'team', teamId: 7, organisationId: null });
  });

  it('ORGANISATION token with no headers targets its org only', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.ORGANISATION, teamId: null, organisationId: 'org_a' },
      headers({}),
    );

    expect(r).toEqual({ ok: true, kind: 'organisation', teamId: null, organisationId: 'org_a' });
  });

  it('ORGANISATION token passes x-team-id through for DB validation', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.ORGANISATION, teamId: null, organisationId: 'org_a' },
      headers({ 'x-team-id': '12' }),
    );

    expect(r).toEqual({ ok: true, kind: 'organisation', teamId: 12, organisationId: 'org_a' });
  });

  it('ORGANISATION token rejects a foreign x-organisation-id', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.ORGANISATION, teamId: null, organisationId: 'org_a' },
      headers({ 'x-organisation-id': 'org_b' }),
    );

    expect(r).toEqual({ ok: false, status: 403, message: 'Token is scoped to a different organisation' });
  });

  it('INSTANCE token with no headers has no target', () => {
    const r = resolveScopeTarget({ scope: ApiTokenScope.INSTANCE, teamId: null, organisationId: null }, headers({}));

    expect(r).toEqual({ ok: true, kind: 'instance', teamId: null, organisationId: null });
  });

  it('INSTANCE token honours both headers', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.INSTANCE, teamId: null, organisationId: null },
      headers({ 'x-team-id': '3', 'x-organisation-id': 'org_c' }),
    );

    expect(r).toEqual({ ok: true, kind: 'instance', teamId: 3, organisationId: 'org_c' });
  });

  it('rejects a non-numeric x-team-id', () => {
    const r = resolveScopeTarget(
      { scope: ApiTokenScope.INSTANCE, teamId: null, organisationId: null },
      headers({ 'x-team-id': 'abc' }),
    );

    expect(r).toEqual({ ok: false, status: 400, message: 'x-team-id must be a number' });
  });
});
