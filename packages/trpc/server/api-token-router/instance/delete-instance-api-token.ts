import { deleteInstanceApiToken } from '@documenso/lib/server-only/public-api/delete-scoped-api-token';

import { adminProcedure } from '../../trpc';
import {
  deleteInstanceApiTokenMeta,
  ZDeleteInstanceApiTokenRequestSchema,
  ZDeleteInstanceApiTokenResponseSchema,
} from './delete-instance-api-token.types';

export const deleteInstanceApiTokenRoute = adminProcedure
  .meta(deleteInstanceApiTokenMeta)
  .input(ZDeleteInstanceApiTokenRequestSchema)
  .output(ZDeleteInstanceApiTokenResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await deleteInstanceApiToken({ id });
  });
