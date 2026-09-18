import { deleteUser } from '@documenso/lib/server-only/user/delete-user';

import { adminProcedure } from '../trpc';
import { deleteUserMeta, ZDeleteUserRequestSchema, ZDeleteUserResponseSchema } from './delete-user.types';

export const deleteUserRoute = adminProcedure
  .meta(deleteUserMeta)
  .input(ZDeleteUserRequestSchema)
  .output(ZDeleteUserResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id } = input;

    ctx.logger.info({
      input: {
        id,
      },
    });

    await deleteUser({ id });
  });
