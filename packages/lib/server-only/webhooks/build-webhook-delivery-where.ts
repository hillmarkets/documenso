import type { Prisma, WebhookTriggerEvents } from '@prisma/client';
import { WebhookScope } from '@prisma/client';

export type BuildWebhookDeliveryWhereOptions = {
  event: WebhookTriggerEvents;
  teamId: number;
  organisationId: string;
};

/**
 * An event on team T delivers to T's webhooks, T's organisation's webhooks and
 * every instance webhook. Matching is purely by tenant — authorization lives on
 * the management procedures, not here.
 */
export const buildWebhookDeliveryWhere = ({
  event,
  teamId,
  organisationId,
}: BuildWebhookDeliveryWhereOptions): Prisma.WebhookWhereInput => ({
  enabled: true,
  eventTriggers: { has: event },
  OR: [
    { scope: WebhookScope.TEAM, teamId },
    { scope: WebhookScope.ORGANISATION, organisationId },
    { scope: WebhookScope.INSTANCE },
  ],
});
