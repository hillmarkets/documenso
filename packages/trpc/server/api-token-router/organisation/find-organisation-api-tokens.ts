import { getOrganisationApiTokens } from '@documenso/lib/server-only/public-api/get-scoped-api-tokens';

import { authenticatedProcedure } from '../../trpc';
import {
  findOrganisationApiTokensMeta,
  ZFindOrganisationApiTokensRequestSchema,
  ZFindOrganisationApiTokensResponseSchema,
} from './find-organisation-api-tokens.types';

export const findOrganisationApiTokensRoute = authenticatedProcedure
  .meta(findOrganisationApiTokensMeta)
  .input(ZFindOrganisationApiTokensRequestSchema)
  .output(ZFindOrganisationApiTokensResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getOrganisationApiTokens({ userId: ctx.user.id, organisationId });
  });
