import { WebhookTriggerEvents } from '@prisma/client';
import { z } from 'zod';

export const ZTriggerWebhookBodySchema = z.object({
  event: z.nativeEnum(WebhookTriggerEvents),
  data: z.unknown(),
  teamId: z.number(),
});

export type TTriggerWebhookBodySchema = z.infer<typeof ZTriggerWebhookBodySchema>;
