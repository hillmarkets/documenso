import WebhookSchema from '@documenso/prisma/generated/zod/modelSchema/WebhookSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../../trpc-instance';
import { ZCreateWebhookRequestSchema } from '../schema';

const TAG = 'Admin Webhooks';
const ACCESS = 'Requires a session admin or an INSTANCE token.';

export const createInstanceWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/webhook/create',
    summary: 'Create instance webhook',
    description: `Create a webhook that receives events from every team on this instance. ${ACCESS}`,
    tags: [TAG],
  },
};

export const findInstanceWebhooksMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/webhook',
    summary: 'Find instance webhooks',
    description: `List instance-level webhooks. ${ACCESS}`,
    tags: [TAG],
  },
};

export const getInstanceWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/webhook/{id}',
    summary: 'Get instance webhook',
    description: `Get an instance-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

export const updateInstanceWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/webhook/{id}/update',
    summary: 'Update instance webhook',
    description: `Update an instance-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

export const deleteInstanceWebhookMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/webhook/{id}/delete',
    summary: 'Delete instance webhook',
    description: `Delete an instance-level webhook. ${ACCESS}`,
    tags: [TAG],
  },
};

const ZWebhookRef = z.object({ id: z.string() });

export const ZCreateInstanceWebhookRequestSchema = ZCreateWebhookRequestSchema;
export const ZFindInstanceWebhooksRequestSchema = z.void();
export const ZGetInstanceWebhookRequestSchema = ZWebhookRef;
export const ZUpdateInstanceWebhookRequestSchema = ZCreateWebhookRequestSchema.merge(ZWebhookRef);
export const ZDeleteInstanceWebhookRequestSchema = ZWebhookRef;

export const ZInstanceWebhookResponseSchema = WebhookSchema;
export const ZFindInstanceWebhooksResponseSchema = z.array(WebhookSchema);
export const ZDeleteInstanceWebhookResponseSchema = z.void();

export type TCreateInstanceWebhookRequest = z.infer<typeof ZCreateInstanceWebhookRequestSchema>;
export type TUpdateInstanceWebhookRequest = z.infer<typeof ZUpdateInstanceWebhookRequestSchema>;
