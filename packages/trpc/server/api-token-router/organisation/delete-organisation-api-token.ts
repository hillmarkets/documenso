import { deleteOrganisationApiToken } from '@documenso/lib/server-only/public-api/delete-scoped-api-token';

import { authenticatedProcedure } from '../../trpc';
import {
  deleteOrganisationApiTokenMeta,
  ZDeleteOrganisationApiTokenRequestSchema,
  ZDeleteOrganisationApiTokenResponseSchema,
} from './delete-organisation-api-token.types';

export const deleteOrganisationApiTokenRoute = authenticatedProcedure
  .meta(deleteOrganisationApiTokenMeta)
  .input(ZDeleteOrganisationApiTokenRequestSchema)
  .output(ZDeleteOrganisationApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, organisationId } = input;

    ctx.logger.info({
      input: {
        id,
        organisationId,
      },
    });

    await deleteOrganisationApiToken({
      id,
      organisationId,
      userId: ctx.user.id,
    });
  });
