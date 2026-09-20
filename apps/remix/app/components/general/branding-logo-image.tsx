import { cn } from '@documenso/ui/lib/utils';

export type BrandingLogoImageProps = {
  scope: 'team' | 'organisation';
  id: number | string;
  alt: string;
  className?: string;
};

/**
 * The custom branding logo for the current theme.
 *
 * Renders the light and dark variants and lets Tailwind's `dark:` variant pick
 * one, driven by the `dark` class remix-themes puts on <html>. No JavaScript,
 * so there is no wrong-logo flash, and it is correct for logged-out recipients
 * whose theme comes from their system preference. When no dark logo is set the
 * server serves the light file for the dark variant, so both requests share a
 * cache entry.
 */
export const BrandingLogoImage = ({ scope, id, alt, className }: BrandingLogoImageProps) => {
  const src = `/api/branding/logo/${scope}/${id}`;

  return (
    <>
      <img src={src} alt={alt} className={cn(className, 'dark:hidden')} />
      <img src={`${src}?variant=dark`} alt={alt} className={cn(className, 'hidden dark:block')} />
    </>
  );
};
