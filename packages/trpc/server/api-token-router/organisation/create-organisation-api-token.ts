import { createOrganisationApiToken } from '@documenso/lib/server-only/public-api/create-scoped-api-token';

import { authenticatedProcedure } from '../../trpc';
import {
  createOrganisationApiTokenMeta,
  ZCreateOrganisationApiTokenRequestSchema,
  ZCreateOrganisationApiTokenResponseSchema,
} from './create-organisation-api-token.types';

export const createOrganisationApiTokenRoute = authenticatedProcedure
  .meta(createOrganisationApiTokenMeta)
  .input(ZCreateOrganisationApiTokenRequestSchema)
  .output(ZCreateOrganisationApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, tokenName, expirationDate } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await createOrganisationApiToken({
      userId: ctx.user.id,
      organisationId,
      tokenName,
      expiresIn: expirationDate,
    });
  });
