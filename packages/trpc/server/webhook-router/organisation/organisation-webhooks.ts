import {
  createOrganisationWebhook,
  deleteOrganisationWebhook,
  editOrganisationWebhook,
  findOrganisationWebhooks,
  getOrganisationWebhookById,
} from '@documenso/lib/server-only/webhooks/scoped/scoped-webhooks';

import { authenticatedProcedure } from '../../trpc';
import {
  createOrganisationWebhookMeta,
  deleteOrganisationWebhookMeta,
  findOrganisationWebhooksMeta,
  getOrganisationWebhookMeta,
  updateOrganisationWebhookMeta,
  ZCreateOrganisationWebhookRequestSchema,
  ZDeleteOrganisationWebhookRequestSchema,
  ZDeleteOrganisationWebhookResponseSchema,
  ZFindOrganisationWebhooksRequestSchema,
  ZFindOrganisationWebhooksResponseSchema,
  ZGetOrganisationWebhookRequestSchema,
  ZOrganisationWebhookResponseSchema,
  ZUpdateOrganisationWebhookRequestSchema,
} from './organisation-webhooks.types';

export const createOrganisationWebhookRoute = authenticatedProcedure
  .meta(createOrganisationWebhookMeta)
  .input(ZCreateOrganisationWebhookRequestSchema)
  .output(ZOrganisationWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, ...data } = input;

    ctx.logger.info({ input: { organisationId } });

    return await createOrganisationWebhook({ ...data, organisationId, userId: ctx.user.id });
  });

export const findOrganisationWebhooksRoute = authenticatedProcedure
  .meta(findOrganisationWebhooksMeta)
  .input(ZFindOrganisationWebhooksRequestSchema)
  .output(ZFindOrganisationWebhooksResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({ input: { organisationId } });

    return await findOrganisationWebhooks({ organisationId, userId: ctx.user.id });
  });

export const getOrganisationWebhookRoute = authenticatedProcedure
  .meta(getOrganisationWebhookMeta)
  .input(ZGetOrganisationWebhookRequestSchema)
  .output(ZOrganisationWebhookResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, id } = input;

    ctx.logger.info({ input: { organisationId, id } });

    return await getOrganisationWebhookById({ id, organisationId, userId: ctx.user.id });
  });

export const updateOrganisationWebhookRoute = authenticatedProcedure
  .meta(updateOrganisationWebhookMeta)
  .input(ZUpdateOrganisationWebhookRequestSchema)
  .output(ZOrganisationWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, id, ...data } = input;

    ctx.logger.info({ input: { organisationId, id } });

    return await editOrganisationWebhook({ id, organisationId, userId: ctx.user.id, data });
  });

export const deleteOrganisationWebhookRoute = authenticatedProcedure
  .meta(deleteOrganisationWebhookMeta)
  .input(ZDeleteOrganisationWebhookRequestSchema)
  .output(ZDeleteOrganisationWebhookResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, id } = input;

    ctx.logger.info({ input: { organisationId, id } });

    await deleteOrganisationWebhook({ id, organisationId, userId: ctx.user.id });
  });
