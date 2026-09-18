import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';

import { buildWebhookDeliveryWhere } from './build-webhook-delivery-where';

export type GetAllWebhooksByEventTriggerOptions = {
  event: WebhookTriggerEvents;
  teamId: number;
};

/**
 * Every webhook that should receive `event` for something that happened in `teamId`:
 * the team's own webhooks, its organisation's webhooks and all instance webhooks.
 */
export const getAllWebhooksByEventTrigger = async ({ event, teamId }: GetAllWebhooksByEventTriggerOptions) => {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organisationId: true },
  });

  if (!team) {
    return [];
  }

  return prisma.webhook.findMany({
    where: buildWebhookDeliveryWhere({ event, teamId, organisationId: team.organisationId }),
  });
};
