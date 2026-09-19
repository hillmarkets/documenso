import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';

import type { DialogScope } from '~/components/dialogs/scoped-dialog-props';
import { WebhookCreateDialog } from '~/components/dialogs/webhook-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { ScopedWebhooksTable } from '~/components/tables/scoped-webhooks-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Webhooks`);
}

export default function OrganisationWebhooksPage() {
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();

  const isUnauthorized = !canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole);

  const scope: DialogScope = { kind: 'organisation', organisationId: organisation.id };

  const { data, isLoading, isError } = trpc.webhook.organisation.find.useQuery(
    { organisationId: organisation.id },
    {
      enabled: !isUnauthorized,
    },
  );

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={t`Webhooks`}
        subtitle={t`Organisation webhooks receive events from every team in this organisation.`}
      >
        {!isUnauthorized && <WebhookCreateDialog scope={scope} />}
      </SettingsHeader>

      {isUnauthorized ? (
        <Alert className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row" variant="warning">
          <div>
            <AlertTitle>
              <Trans>Unauthorized</Trans>
            </AlertTitle>
            <AlertDescription className="mr-2">
              <Trans>You need to be an organisation admin or manager to manage webhooks.</Trans>
            </AlertDescription>
          </div>
        </Alert>
      ) : (
        <ScopedWebhooksTable scope={scope} webhooks={data ?? []} isLoading={isLoading} isError={isError} />
      )}
    </div>
  );
}
