import WebhookSchema from '@documenso/prisma/generated/zod/modelSchema/WebhookSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';
import { ZCreateWebhookRequestSchema } from '../schema';

const TAG = 'Organisation Webhooks';
const ACCESS =
  'Callable by organisation admins (session), ORGANISATION tokens for their own organisation, and INSTANCE tokens.';

export const createOrganisationWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/webhook/create',
    summary: 'Create organisation webhook',
    description: `Create a webhook that receives events from every team in the organisation. ${ACCESS}`,
    tags: [TAG],
  },
};

export const findOrganisationWebhooksMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/organisation/{organisationId}/webhook',
    summary: 'Find organisation webhooks',
    description: `List organisation-level webhooks. ${ACCESS}`,
    tags: [TAG],
  },
};

export const getOrganisationWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/organisation/{organisationId}/webhook/{id}',
    summary: 'Get organisation webhook',
    description: `Get an organisation-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

export const updateOrganisationWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/webhook/{id}/update',
    summary: 'Update organisation webhook',
    description: `Update an organisation-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

export const deleteOrganisationWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/webhook/{id}/delete',
    summary: 'Delete organisation webhook',
    description: `Delete an organisation-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

const ZOrganisationRef = z.object({ organisationId: z.string() });
const ZWebhookRef = ZOrganisationRef.extend({ id: z.string() });

export const ZCreateOrganisationWebhookRequestSchema = ZCreateWebhookRequestSchema.merge(ZOrganisationRef);
export const ZFindOrganisationWebhooksRequestSchema = ZOrganisationRef;
export const ZGetOrganisationWebhookRequestSchema = ZWebhookRef;
export const ZUpdateOrganisationWebhookRequestSchema = ZCreateWebhookRequestSchema.merge(ZWebhookRef);
export const ZDeleteOrganisationWebhookRequestSchema = ZWebhookRef;

export const ZOrganisationWebhookResponseSchema = WebhookSchema;
export const ZFindOrganisationWebhooksResponseSchema = z.array(WebhookSchema);
export const ZDeleteOrganisationWebhookResponseSchema = z.void();

export type TCreateOrganisationWebhookRequest = z.infer<typeof ZCreateOrganisationWebhookRequestSchema>;
export type TUpdateOrganisationWebhookRequest = z.infer<typeof ZUpdateOrganisationWebhookRequestSchema>;
