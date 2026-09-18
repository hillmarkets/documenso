import { createWebhook } from '@documenso/lib/server-only/webhooks/create-webhook';
import { getAllWebhooksByEventTrigger } from '@documenso/lib/server-only/webhooks/get-all-webhooks-by-event-trigger';
import {
  createInstanceWebhook,
  createOrganisationWebhook,
} from '@documenso/lib/server-only/webhooks/scoped/scoped-webhooks';
import { triggerWebhook } from '@documenso/lib/server-only/webhooks/trigger/trigger-webhook';
import { prisma } from '@documenso/prisma';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { WebhookTriggerEvents } from '@prisma/client';

test('event on a team reaches team, organisation and instance webhooks but not a foreign team', async () => {
  const { owner, team, organisation } = await seedTeam();
  const { owner: foreignOwner, team: foreignTeam } = await seedTeam();
  const { user: admin } = await seedUser({ isAdmin: true });

  const base = {
    webhookUrl: 'https://example.com/hook',
    eventTriggers: [WebhookTriggerEvents.DOCUMENT_CREATED],
    secret: null,
    enabled: true,
  };

  const teamHook = await createWebhook({ ...base, userId: owner.id, teamId: team.id });
  const organisationHook = await createOrganisationWebhook({
    ...base,
    userId: owner.id,
    organisationId: organisation.id,
  });
  const instanceHook = await createInstanceWebhook({ ...base, userId: admin.id });
  const foreignHook = await createWebhook({ ...base, userId: foreignOwner.id, teamId: foreignTeam.id });

  const ids = (
    await getAllWebhooksByEventTrigger({ event: WebhookTriggerEvents.DOCUMENT_CREATED, teamId: team.id })
  ).map((webhook) => webhook.id);

  expect(ids).toEqual(expect.arrayContaining([teamHook.id, organisationHook.id, instanceHook.id]));
  expect(ids).not.toContain(foreignHook.id);

  // Triggering enqueues one execute-webhook job per matching webhook, each carrying the tenant.
  await triggerWebhook({ event: WebhookTriggerEvents.DOCUMENT_CREATED, data: { title: 'x' }, teamId: team.id });

  const jobs = await prisma.backgroundJob.findMany({
    where: { jobId: 'internal.execute-webhook' },
    orderBy: { id: 'desc' },
    take: 20,
  });

  const payloads = jobs
    .map((job) => job.payload as { webhookId: string; teamId?: number })
    .filter((payload) =>
      [teamHook.id, organisationHook.id, instanceHook.id, foreignHook.id].includes(payload.webhookId),
    );

  expect(payloads.map((payload) => payload.webhookId).sort()).toEqual(
    [teamHook.id, organisationHook.id, instanceHook.id].sort(),
  );
  expect(payloads.every((payload) => payload.teamId === team.id)).toBe(true);
});
