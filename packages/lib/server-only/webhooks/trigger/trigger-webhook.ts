import type { WebhookTriggerEvents } from '@prisma/client';

import { jobs } from '../../../jobs/client';
import { logger } from '../../../utils/logger';
import { getAllWebhooksByEventTrigger } from '../get-all-webhooks-by-event-trigger';

export type TriggerWebhookOptions = {
  event: WebhookTriggerEvents;
  data: Record<string, unknown>;
  teamId: number;
};

export const triggerWebhook = async ({ event, data, teamId }: TriggerWebhookOptions) => {
  try {
    const registeredWebhooks = await getAllWebhooksByEventTrigger({ event, teamId });

    if (registeredWebhooks.length === 0) {
      logger.debug({ msg: 'No webhooks registered for event', event, teamId });
      return;
    }

    await Promise.allSettled(
      registeredWebhooks.map(async (webhook) => {
        await jobs.triggerJob({
          name: 'internal.execute-webhook',
          payload: {
            event,
            webhookId: webhook.id,
            data,
            teamId,
          },
        });
      }),
    );
  } catch (err) {
    console.error(err);
    throw new Error(`Failed to trigger webhook`);
  }
};
