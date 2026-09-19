import type { TGetApiTokensResponse } from '@documenso/trpc/server/api-token-router/get-api-tokens.types';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import { Skeleton } from '@documenso/ui/primitives/skeleton';
import { TableCell } from '@documenso/ui/primitives/table';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import type { DialogScope } from '~/components/dialogs/scoped-dialog-props';
import TokenDeleteDialog from '~/components/dialogs/token-delete-dialog';

type ScopedApiToken = TGetApiTokensResponse[number] & {
  user?: { email: string } | null;
};

export type ScopedApiTokensTableProps = {
  scope: DialogScope;
  tokens: ScopedApiToken[];
  isLoading: boolean;
  isError: boolean;
  /** Show who minted the token. Used on the instance page where tokens have no tenant. */
  showCreatedBy?: boolean;
};

/**
 * The API token list shared by the team, organisation and admin settings pages.
 */
export const ScopedApiTokensTable = ({
  scope,
  tokens,
  isLoading,
  isError,
  showCreatedBy = false,
}: ScopedApiTokensTableProps) => {
  const { t, i18n } = useLingui();

  const columns = useMemo(() => {
    return [
      {
        header: t`Name`,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
      },
      ...(showCreatedBy
        ? [
            {
              header: t`Created by`,
              cell: ({ row }) => <span className="text-muted-foreground">{row.original.user?.email ?? '-'}</span>,
            } satisfies DataTableColumnDef<ScopedApiToken>,
          ]
        : []),
      {
        header: t`Created`,
        cell: ({ row }) => i18n.date(row.original.createdAt),
      },
      {
        header: t`Expires`,
        cell: ({ row }) => {
          if (!row.original.expires) {
            return (
              <span className="text-muted-foreground">
                <Trans>Never</Trans>
              </span>
            );
          }

          if (row.original.expires < new Date()) {
            return (
              <Badge variant="destructive" size="small">
                <Trans>Expired</Trans>
              </Badge>
            );
          }

          return i18n.date(row.original.expires);
        },
      },
      {
        header: t`Last Used`,
        cell: ({ row }) => {
          if (!row.original.lastUsedAt) {
            return (
              <span className="text-muted-foreground">
                <Trans>Never</Trans>
              </span>
            );
          }

          return <span className="text-foreground">{i18n.date(row.original.lastUsedAt)}</span>;
        },
      },
      {
        header: t`Actions`,
        cell: ({ row }) => (
          <TokenDeleteDialog token={row.original} scope={scope}>
            <Button variant="destructive">
              <Trans>Delete</Trans>
            </Button>
          </TokenDeleteDialog>
        ),
      },
    ] satisfies DataTableColumnDef<ScopedApiToken>[];
  }, [scope, showCreatedBy]);

  return (
    <DataTable
      columns={columns}
      data={tokens}
      perPage={0}
      currentPage={0}
      totalPages={0}
      error={{
        enable: isError,
      }}
      emptyState={
        <div className="flex h-60 flex-col items-center justify-center gap-y-4 text-muted-foreground/60">
          <p>
            <Trans>You have no API tokens yet. Your tokens will be shown here once you create them.</Trans>
          </p>
        </div>
      }
      skeleton={{
        enable: isLoading,
        rows: 3,
        component: (
          <>
            <TableCell>
              <Skeleton className="h-4 w-24 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12 rounded-full" />
            </TableCell>
          </>
        ),
      }}
    />
  );
};
