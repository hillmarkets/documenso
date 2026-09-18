import { describe, expect, it } from 'vitest';

import { checkInputAgainstScope, readTeamReferences } from './check-input-against-scope';

const team = { kind: 'team' as const, apiTokenId: 1, teamId: 7, organisationId: 'org_a' };
const org = { kind: 'organisation' as const, apiTokenId: 1, teamId: null, organisationId: 'org_a' };
const instance = { kind: 'instance' as const, apiTokenId: 1, teamId: null, organisationId: null };

describe('checkInputAgainstScope', () => {
  it('allows anything for instance tokens', () => {
    expect(checkInputAgainstScope(instance, { organisationId: 'org_z', teamId: 99 }, '/organisation/x')).toBeNull();
    expect(checkInputAgainstScope(instance, {}, '/admin/user/1')).toBeNull();
  });

  it('rejects TEAM tokens on organisation and admin paths', () => {
    expect(checkInputAgainstScope(team, {}, '/organisation/org_a')).toEqual({
      status: 403,
      message: 'This endpoint requires an ORGANISATION or INSTANCE-scoped API token',
    });
    expect(checkInputAgainstScope(team, {}, '/admin/user')).toMatchObject({ status: 403 });
  });

  it('rejects TEAM tokens on team management paths', () => {
    expect(checkInputAgainstScope(team, { teamId: 7 }, '/team/7')).toMatchObject({ status: 403 });
  });

  it('TEAM token may only reference its own team on document paths', () => {
    expect(checkInputAgainstScope(team, { teamId: 7 }, '/document')).toBeNull();
    expect(checkInputAgainstScope(team, { teamId: 8 }, '/document')).toMatchObject({ status: 403 });
    expect(checkInputAgainstScope(team, { transferTeamId: 8 }, '/document')).toMatchObject({ status: 403 });
  });

  it('readTeamReferences collects every team-naming key', () => {
    expect(readTeamReferences({ teamId: 1, transferTeamId: 2, teamReference: 'acme', other: 'x' })).toEqual([
      '1',
      'acme',
      '2',
    ]);
    expect(readTeamReferences(undefined)).toEqual([]);
  });

  it('ORG token may only reference its own organisation, by id or url', () => {
    expect(checkInputAgainstScope(org, { organisationId: 'org_a' }, '/organisation/org_a')).toBeNull();
    expect(checkInputAgainstScope(org, { organisationReference: 'acme' }, '/organisation/acme', 'acme')).toBeNull();
    expect(checkInputAgainstScope(org, { organisationId: 'org_b' }, '/organisation/org_b')).toMatchObject({
      status: 403,
    });
    expect(checkInputAgainstScope(org, { organisationReference: 'org_b' }, '/organisation/org_b')).toMatchObject({
      status: 403,
    });
  });

  it('ORG token cannot call admin paths', () => {
    expect(checkInputAgainstScope(org, {}, '/admin/user/1')).toMatchObject({ status: 403 });
  });

  it('ignores non-object input', () => {
    expect(checkInputAgainstScope(org, undefined, '/organisation/x')).toBeNull();
    expect(checkInputAgainstScope(org, 'string', '/organisation/x')).toBeNull();
  });
});
