import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import type { DialogScope } from '~/components/dialogs/scoped-dialog-props';
import { TokenCreateDialog } from '~/components/dialogs/token-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { ScopedApiTokensTable } from '~/components/tables/scoped-api-tokens-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Instance API Tokens`);
}

const scope: DialogScope = { kind: 'instance' };

export default function AdminApiTokensPage() {
  const { data: tokens, isLoading, isError } = trpc.apiToken.instance.find.useQuery();

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={<Trans>Instance API Tokens</Trans>}
        subtitle={
          <Trans>
            Instance tokens can act across every organisation and team. Pass <code>x-team-id</code> or{' '}
            <code>x-organisation-id</code> headers to target a tenant.
          </Trans>
        }
      >
        <TokenCreateDialog scope={scope} />
      </SettingsHeader>

      <ScopedApiTokensTable scope={scope} tokens={tokens ?? []} isLoading={isLoading} isError={isError} showCreatedBy />
    </div>
  );
}
