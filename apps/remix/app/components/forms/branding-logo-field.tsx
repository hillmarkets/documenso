import { BRANDING_LOGO_ALLOWED_TYPES } from '@documenso/lib/constants/branding';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormDescription } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Trans } from '@lingui/react/macro';
import { Loader } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { InheritableField } from './inheritable-field';

export type BrandingLogoFieldProps = {
  label: ReactNode;
  description: ReactNode;
  testId: string;
  canInherit: boolean;
  isEnabled: boolean;
  /** A blob: URL for an unsaved pick, the served URL for a saved logo, '' for none. */
  previewUrl: string;
  hasLoadedPreview: boolean;
  /** Render the preview on a dark surface so a dark-mode logo is visible in the light editor. */
  isDarkSurface?: boolean;
  onFileChange: (file: File | null) => void;
  /** Everything react-hook-form gives the input except value/onChange. */
  inputProps: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'accept' | 'disabled'>;
};

export const BrandingLogoField = ({
  label,
  description,
  testId,
  canInherit,
  isEnabled,
  previewUrl,
  hasLoadedPreview,
  isDarkSurface = false,
  onFileChange,
  inputProps,
}: BrandingLogoFieldProps) => {
  return (
    <InheritableField
      className="flex-1"
      canInherit={canInherit}
      isInherited={!previewUrl}
      label={label}
      testId={testId}
    >
      <div className="flex flex-col gap-4" data-testid={testId}>
        <div
          className={cn(
            'relative h-48 w-full overflow-hidden rounded-lg border border-border',
            isDarkSurface ? 'bg-zinc-900' : 'bg-background',
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Logo preview" className="h-full w-full object-contain p-4" />
          ) : (
            <div
              className={cn(
                'relative flex h-full w-full items-center justify-center text-sm',
                isDarkSurface ? 'text-zinc-400' : 'bg-muted/20 text-muted-foreground dark:bg-muted',
              )}
            >
              <Trans>Please upload a logo</Trans>

              {!hasLoadedPreview && (
                <div className="absolute inset-0 z-[999] flex items-center justify-center bg-muted dark:bg-muted">
                  <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <FormControl className="relative">
            <Input
              type="file"
              accept={BRANDING_LOGO_ALLOWED_TYPES.join(',')}
              disabled={!isEnabled}
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  onFileChange(file);
                }
              }}
              className={cn(
                'h-auto p-2',
                'file:text-primary hover:file:bg-primary/90',
                'file:mr-4 file:cursor-pointer file:rounded-md file:border-0',
                'file:p-2 file:py-2 file:font-medium',
                'file:bg-primary file:text-primary-foreground',
                !isEnabled && 'cursor-not-allowed',
              )}
              {...inputProps}
            />
          </FormControl>

          <div className="absolute top-0 right-2 inline-flex h-full items-center justify-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-destructive text-xs"
              onClick={() => onFileChange(null)}
            >
              <Trans>Remove</Trans>
            </Button>
          </div>
        </div>

        <FormDescription>{description}</FormDescription>
      </div>
    </InheritableField>
  );
};
