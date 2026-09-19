import { trpc } from '@documenso/trpc/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';

import type { DialogScope } from '~/components/dialogs/scoped-dialog-props';
import { WebhookCreateDialog } from '~/components/dialogs/webhook-create-dialog';
import { SettingsHeader } from '~/components/general/settings-header';
import { ScopedWebhooksTable } from '~/components/tables/scoped-webhooks-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Instance Webhooks`);
}

const scope: DialogScope = { kind: 'instance' };

export default function AdminWebhooksPage() {
  const { t } = useLingui();

  const { data, isLoading, isError } = trpc.webhook.instance.find.useQuery();

  return (
    <div>
      <SettingsHeader
        hideDivider
        title={t`Instance Webhooks`}
        subtitle={t`Instance webhooks receive events from every team on this instance.`}
      >
        <WebhookCreateDialog scope={scope} />
      </SettingsHeader>

      <ScopedWebhooksTable scope={scope} webhooks={data ?? []} isLoading={isLoading} isError={isError} />
    </div>
  );
}
