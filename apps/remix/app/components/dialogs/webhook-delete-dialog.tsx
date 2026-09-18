import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { Webhook } from '@prisma/client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { type DialogScope, forScope, TEAM_DIALOG_SCOPE } from './scoped-dialog-props';

export type WebhookDeleteDialogProps = {
  webhook: Pick<Webhook, 'id' | 'webhookUrl'>;
  scope?: DialogScope;
  onDelete?: () => void;
  children: React.ReactNode;
};

export const WebhookDeleteDialog = ({
  webhook,
  scope = TEAM_DIALOG_SCOPE,
  onDelete,
  children,
}: WebhookDeleteDialogProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const deleteMessage = _(msg`delete ${webhook.webhookUrl}`);

  const ZDeleteWebhookFormSchema = z.object({
    webhookUrl: z.literal(deleteMessage, {
      errorMap: () => ({ message: _(msg`You must enter '${deleteMessage}' to proceed`) }),
    }),
  });

  type TDeleteWebhookFormSchema = z.infer<typeof ZDeleteWebhookFormSchema>;

  const utils = trpc.useUtils();

  const onSuccess = async () => {
    await Promise.all([
      utils.webhook.getTeamWebhooks.invalidate(),
      utils.webhook.organisation.find.invalidate(),
      utils.webhook.instance.find.invalidate(),
    ]);

    onDelete?.();
  };

  const deleteTeamWebhook = trpc.webhook.deleteWebhook.useMutation({ onSuccess });
  const deleteOrganisationWebhook = trpc.webhook.organisation.delete.useMutation({ onSuccess });
  const deleteInstanceWebhook = trpc.webhook.instance.delete.useMutation({ onSuccess });

  const form = useForm<TDeleteWebhookFormSchema>({
    resolver: zodResolver(ZDeleteWebhookFormSchema),
    values: {
      webhookUrl: '',
    },
  });

  const onSubmit = async () => {
    try {
      await forScope<Promise<unknown>>(scope, {
        team: async () => deleteTeamWebhook.mutateAsync({ id: webhook.id }),
        organisation: async (organisationId) =>
          deleteOrganisationWebhook.mutateAsync({ id: webhook.id, organisationId }),
        instance: async () => deleteInstanceWebhook.mutateAsync({ id: webhook.id }),
      });

      toast({
        title: _(msg`Webhook deleted`),
        description: _(msg`The webhook has been successfully deleted.`),
        duration: 5000,
      });

      setOpen(false);
    } catch (error) {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(msg`We encountered an unknown error while attempting to delete it. Please try again later.`),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild>
        {children ?? (
          <Button className="mr-4" variant="destructive">
            <Trans>Delete</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Delete Webhook</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Please note that this action is irreversible. Once confirmed, your webhook will be permanently deleted.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="webhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>
                        Confirm by typing:{' '}
                        <span className="font-semibold text-destructive text-sm">{deleteMessage}</span>
                      </Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" type="text" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!form.formState.isValid}
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Delete</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
