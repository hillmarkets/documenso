/**
 * Which tenant a token/webhook dialog operates on. Team pages omit it; organisation
 * and admin pages pass the matching scope so the dialog calls the right procedure.
 */
export type DialogScope = { kind: 'team' } | { kind: 'organisation'; organisationId: string } | { kind: 'instance' };

export const TEAM_DIALOG_SCOPE: DialogScope = { kind: 'team' };

/**
 * Picks the value matching the dialog scope. Keeps the three-way branching in one place.
 */
export const forScope = <T>(
  scope: DialogScope,
  handlers: { team: () => T; organisation: (organisationId: string) => T; instance: () => T },
): T => {
  switch (scope.kind) {
    case 'team':
      return handlers.team();
    case 'organisation':
      return handlers.organisation(scope.organisationId);
    case 'instance':
      return handlers.instance();
  }
};
