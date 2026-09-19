import { WebhookScope, WebhookTriggerEvents } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { buildWebhookDeliveryWhere } from './build-webhook-delivery-where';

describe('buildWebhookDeliveryWhere', () => {
  it('matches team, parent org and instance webhooks for the event', () => {
    expect(
      buildWebhookDeliveryWhere({ event: WebhookTriggerEvents.DOCUMENT_CREATED, teamId: 5, organisationId: 'org_a' }),
    ).toEqual({
      enabled: true,
      eventTriggers: { has: WebhookTriggerEvents.DOCUMENT_CREATED },
      OR: [
        { scope: WebhookScope.TEAM, teamId: 5 },
        { scope: WebhookScope.ORGANISATION, organisationId: 'org_a' },
        { scope: WebhookScope.INSTANCE },
      ],
    });
  });
});
