import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import type { DialogScope } from '~/components/dialogs/scoped-dialog-props';
import { TokenCreateDialog } from '~/components/dialogs/token-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { ScopedApiTokensTable } from '~/components/tables/scoped-api-tokens-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`API Tokens`);
}

export default function OrganisationApiTokensPage() {
  const organisation = useCurrentOrganisation();

  const isUnauthorized = !canExecuteOrganisationAction('MANAGE_ORGANISATION', organisation.currentOrganisationRole);

  const scope: DialogScope = { kind: 'organisation', organisationId: organisation.id };

  const {
    data: tokens,
    isLoading,
    isError,
  } = trpc.apiToken.organisation.find.useQuery(
    { organisationId: organisation.id },
    {
      enabled: !isUnauthorized,
    },
  );

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={<Trans>API Tokens</Trans>}
        subtitle={
          <Trans>
            Create and manage organisation-wide API tokens. Pass an <code>x-team-id</code> header to act inside a team.
          </Trans>
        }
      >
        {!isUnauthorized && <TokenCreateDialog scope={scope} />}
      </SettingsHeader>

      {isUnauthorized ? (
        <Alert className="flex flex-col items-center justify-between gap-4 p-6 md:flex-row" variant="warning">
          <div>
            <AlertTitle>
              <Trans>Unauthorized</Trans>
            </AlertTitle>
            <AlertDescription className="mr-2">
              <Trans>You need to be an organisation admin or manager to manage API tokens.</Trans>
            </AlertDescription>
          </div>
        </Alert>
      ) : (
        <ScopedApiTokensTable scope={scope} tokens={tokens ?? []} isLoading={isLoading} isError={isError} />
      )}
    </div>
  );
}
