import {
  createInstanceWebhook,
  deleteInstanceWebhook,
  editInstanceWebhook,
  findInstanceWebhooks,
  getInstanceWebhookById,
} from '@documenso/lib/server-only/webhooks/scoped/scoped-webhooks';

import { adminProcedure } from '../../trpc';
import {
  createInstanceWebhookMeta,
  deleteInstanceWebhookMeta,
  findInstanceWebhooksMeta,
  getInstanceWebhookMeta,
  updateInstanceWebhookMeta,
  ZCreateInstanceWebhookRequestSchema,
  ZDeleteInstanceWebhookRequestSchema,
  ZDeleteInstanceWebhookResponseSchema,
  ZFindInstanceWebhooksRequestSchema,
  ZFindInstanceWebhooksResponseSchema,
  ZGetInstanceWebhookRequestSchema,
  ZInstanceWebhookResponseSchema,
  ZUpdateInstanceWebhookRequestSchema,
} from './instance-webhooks.types';

export const createInstanceWebhookRoute = adminProcedure
  .meta(createInstanceWebhookMeta)
  .input(ZCreateInstanceWebhookRequestSchema)
  .output(ZInstanceWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({ input: { webhookUrl: input.webhookUrl } });

    return await createInstanceWebhook({ ...input, userId: ctx.user.id });
  });

export const findInstanceWebhooksRoute = adminProcedure
  .meta(findInstanceWebhooksMeta)
  .input(ZFindInstanceWebhooksRequestSchema)
  .output(ZFindInstanceWebhooksResponseSchema)
  .query(async ({ ctx }) => {
    ctx.logger.info({});

    return await findInstanceWebhooks();
  });

export const getInstanceWebhookRoute = adminProcedure
  .meta(getInstanceWebhookMeta)
  .input(ZGetInstanceWebhookRequestSchema)
  .output(ZInstanceWebhookResponseSchema)
  .query(async ({ input, ctx }) => {
    ctx.logger.info({ input: { id: input.id } });

    return await getInstanceWebhookById({ id: input.id });
  });

export const updateInstanceWebhookRoute = adminProcedure
  .meta(updateInstanceWebhookMeta)
  .input(ZUpdateInstanceWebhookRequestSchema)
  .output(ZInstanceWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;

    ctx.logger.info({ input: { id } });

    return await editInstanceWebhook({ id, data });
  });

export const deleteInstanceWebhookRoute = adminProcedure
  .meta(deleteInstanceWebhookMeta)
  .input(ZDeleteInstanceWebhookRequestSchema)
  .output(ZDeleteInstanceWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    ctx.logger.info({ input: { id: input.id } });

    await deleteInstanceWebhook({ id: input.id });
  });
