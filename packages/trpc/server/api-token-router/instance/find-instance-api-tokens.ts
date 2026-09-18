import { getInstanceApiTokens } from '@documenso/lib/server-only/public-api/get-scoped-api-tokens';

import { adminProcedure } from '../../trpc';
import {
  findInstanceApiTokensMeta,
  ZFindInstanceApiTokensRequestSchema,
  ZFindInstanceApiTokensResponseSchema,
} from './find-instance-api-tokens.types';

export const findInstanceApiTokensRoute = adminProcedure
  .meta(findInstanceApiTokensMeta)
  .input(ZFindInstanceApiTokensRequestSchema)
  .output(ZFindInstanceApiTokensResponseSchema)
  .query(async ({ ctx }) => {
    ctx.logger.info({});

    return await getInstanceApiTokens();
  });
