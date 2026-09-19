import { createOrganisationMemberInvites } from '@documenso/lib/server-only/organisation/create-organisation-member-invites';

import { authenticatedProcedure } from '../trpc';
import {
  createOrganisationMemberInvitesMeta,
  ZCreateOrganisationMemberInvitesRequestSchema,
  ZCreateOrganisationMemberInvitesResponseSchema,
} from './create-organisation-member-invites.types';

export const createOrganisationMemberInvitesRoute = authenticatedProcedure
  .meta(createOrganisationMemberInvitesMeta)
  .input(ZCreateOrganisationMemberInvitesRequestSchema)
  .output(ZCreateOrganisationMemberInvitesResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitations } = input;
    const userId = ctx.user.id;
    const userName = ctx.user.name || '';

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    await createOrganisationMemberInvites({
      userId,
      userName,
      organisationId,
      invitations,
    });
  });
