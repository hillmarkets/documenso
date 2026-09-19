import { prisma } from '@documenso/prisma';
import type { WebhookTriggerEvents } from '@prisma/client';
import { WebhookScope } from '@prisma/client';

import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '../../../constants/organisations';
import { AppError, AppErrorCode } from '../../../errors/app-error';
import { buildOrganisationWhereQuery } from '../../../utils/organisations';

export type ScopedWebhookData = {
  webhookUrl: string;
  eventTriggers: WebhookTriggerEvents[];
  secret: string | null;
  enabled: boolean;
};

type OrganisationActor = {
  userId: number;
  organisationId: string;
};

/**
 * Throws unless `userId` may manage the organisation. INSTANCE and ORGANISATION
 * tokens act as the organisation owner, so they pass this check naturally.
 */
export const assertCanManageOrganisationWebhooks = async ({ userId, organisationId }: OrganisationActor) => {
  const organisation = await prisma.organisation.findFirst({
    where: buildOrganisationWhereQuery({
      organisationId,
      userId,
      roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
    }),
    select: { id: true },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }
};

/*
 * Organisation-scoped webhooks
 */

export const createOrganisationWebhook = async ({
  userId,
  organisationId,
  ...data
}: ScopedWebhookData & OrganisationActor) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return await prisma.webhook.create({
    data: { ...data, scope: WebhookScope.ORGANISATION, userId, organisationId },
  });
};

export const findOrganisationWebhooks = async ({ userId, organisationId }: OrganisationActor) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return await prisma.webhook.findMany({
    where: { scope: WebhookScope.ORGANISATION, organisationId },
    orderBy: { createdAt: 'desc' },
  });
};

export const getOrganisationWebhookById = async ({
  id,
  userId,
  organisationId,
}: OrganisationActor & { id: string }) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return await prisma.webhook.findFirstOrThrow({
    where: { id, scope: WebhookScope.ORGANISATION, organisationId },
  });
};

export const editOrganisationWebhook = async ({
  id,
  userId,
  organisationId,
  data,
}: OrganisationActor & { id: string; data: ScopedWebhookData }) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return await prisma.webhook.update({
    where: { id, scope: WebhookScope.ORGANISATION, organisationId },
    data,
  });
};

export const deleteOrganisationWebhook = async ({ id, userId, organisationId }: OrganisationActor & { id: string }) => {
  await assertCanManageOrganisationWebhooks({ userId, organisationId });

  return await prisma.webhook.delete({
    where: { id, scope: WebhookScope.ORGANISATION, organisationId },
  });
};

/*
 * Instance-scoped webhooks. Authorization is the caller's job (adminProcedure).
 */

export const createInstanceWebhook = async ({ userId, ...data }: ScopedWebhookData & { userId: number }) => {
  return await prisma.webhook.create({
    data: { ...data, scope: WebhookScope.INSTANCE, userId },
  });
};

export const findInstanceWebhooks = async () => {
  return await prisma.webhook.findMany({
    where: { scope: WebhookScope.INSTANCE },
    orderBy: { createdAt: 'desc' },
  });
};

export const getInstanceWebhookById = async ({ id }: { id: string }) => {
  return await prisma.webhook.findFirstOrThrow({
    where: { id, scope: WebhookScope.INSTANCE },
  });
};

export const editInstanceWebhook = async ({ id, data }: { id: string; data: ScopedWebhookData }) => {
  return await prisma.webhook.update({
    where: { id, scope: WebhookScope.INSTANCE },
    data,
  });
};

export const deleteInstanceWebhook = async ({ id }: { id: string }) => {
  return await prisma.webhook.delete({
    where: { id, scope: WebhookScope.INSTANCE },
  });
};
