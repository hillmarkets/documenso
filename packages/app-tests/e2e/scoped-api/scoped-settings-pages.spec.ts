import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { ApiTokenScope, WebhookScope, WebhookTriggerEvents } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';
import { expectTextToBeVisible } from '../fixtures/generic';

const createWebhookThroughDialog = async (page: import('@playwright/test').Page, webhookUrl: string) => {
  await page.getByRole('button', { name: 'Create Webhook' }).click();
  await page.getByLabel('Webhook URL*').fill(webhookUrl);
  await page.getByLabel('Triggers').click();
  await page.waitForTimeout(200);
  await page.getByText('document.created').click();
  await page.getByText('The URL for Documenso to send webhook events to.').click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expectTextToBeVisible(page, 'Webhook created');
  await expect(page.getByText(webhookUrl)).toBeVisible();
};

const createTokenThroughDialog = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByRole('button', { name: 'Create token' }).click();
  await page.getByLabel('Name*').fill(name);
  await page.getByRole('button', { name: 'Create token' }).last().click();
  await expectTextToBeVisible(page, 'Token created');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText(name)).toBeVisible();
};

test('[SCOPED-API]: organisation settings pages create org-scoped tokens and webhooks', async ({ page }) => {
  const { user, organisation } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: `/o/${organisation.url}/settings/tokens` });

  await expectTextToBeVisible(page, 'API Tokens');
  await createTokenThroughDialog(page, 'org-token');

  const token = await prisma.apiToken.findFirstOrThrow({
    where: { name: 'org-token', organisationId: organisation.id },
  });
  expect(token.scope).toBe(ApiTokenScope.ORGANISATION);
  expect(token.teamId).toBeNull();

  await page.goto(`/o/${organisation.url}/settings/webhooks`);
  const webhookUrl = `https://example.com/org-webhook-${Date.now()}`;
  await createWebhookThroughDialog(page, webhookUrl);

  const webhook = await prisma.webhook.findFirstOrThrow({ where: { webhookUrl } });
  expect(webhook.scope).toBe(WebhookScope.ORGANISATION);
  expect(webhook.organisationId).toBe(organisation.id);
  expect(webhook.eventTriggers).toEqual([WebhookTriggerEvents.DOCUMENT_CREATED]);
});

test('[SCOPED-API]: admin pages create instance-scoped tokens and webhooks', async ({ page }) => {
  const { user } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: user.email, redirectPath: '/admin/tokens' });

  await expectTextToBeVisible(page, 'Instance API Tokens');
  await createTokenThroughDialog(page, 'instance-token');

  const token = await prisma.apiToken.findFirstOrThrow({ where: { name: 'instance-token', userId: user.id } });
  expect(token.scope).toBe(ApiTokenScope.INSTANCE);
  expect(token.teamId).toBeNull();
  expect(token.organisationId).toBeNull();

  await page.goto('/admin/webhooks');
  await expectTextToBeVisible(page, 'Instance Webhooks');
  const webhookUrl = `https://example.com/instance-webhook-${Date.now()}`;
  await createWebhookThroughDialog(page, webhookUrl);

  const webhook = await prisma.webhook.findFirstOrThrow({ where: { webhookUrl } });
  expect(webhook.scope).toBe(WebhookScope.INSTANCE);
  expect(webhook.teamId).toBeNull();
  expect(webhook.organisationId).toBeNull();
});

test('[SCOPED-API]: team settings pages still create team-scoped tokens', async ({ page }) => {
  const { user, team } = await seedUser();

  await apiSignin({ page, email: user.email, redirectPath: `/t/${team.url}/settings/tokens` });
  await createTokenThroughDialog(page, 'team-token');

  const token = await prisma.apiToken.findFirstOrThrow({ where: { name: 'team-token', teamId: team.id } });
  expect(token.scope).toBe(ApiTokenScope.TEAM);
});
