import { createInstanceApiToken } from '@documenso/lib/server-only/public-api/create-scoped-api-token';

import { adminProcedure } from '../../trpc';
import {
  createInstanceApiTokenMeta,
  ZCreateInstanceApiTokenRequestSchema,
  ZCreateInstanceApiTokenResponseSchema,
} from './create-instance-api-token.types';

export const createInstanceApiTokenRoute = adminProcedure
  .meta(createInstanceApiTokenMeta)
  .input(ZCreateInstanceApiTokenRequestSchema)
  .output(ZCreateInstanceApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { tokenName, expirationDate } = input;

    ctx.logger.info({
      input: {
        tokenName,
      },
    });

    return await createInstanceApiToken({
      userId: ctx.user.id,
      tokenName,
      expiresIn: expirationDate,
    });
  });
