import type { BrandingLogoDimensions, BrandingLogoSurface } from '@documenso/lib/utils/branding-logo-size';
import { getBrandingLogoBox } from '@documenso/lib/utils/branding-logo-size';
import { cn } from '@documenso/ui/lib/utils';

export type BrandingLogoImageProps = {
  scope: 'team' | 'organisation';
  id: number | string;
  alt: string;
  /** Where the logo sits. Picks its size; see `BRANDING_LOGO_SURFACE_SIZES`. */
  surface: BrandingLogoSurface;
  /** The stored logo's pixel size (`getBrandingLogoDimensions`), or null if never recorded. */
  dimensions: BrandingLogoDimensions | null;
  /** Placement only (margins, flex). The size comes from `surface`. */
  className?: string;
};

/**
 * The custom branding logo for the current theme, sized by its shape.
 *
 * Renders the light and dark variants and lets Tailwind's `dark:` variant pick
 * one, driven by the `dark` class remix-themes puts on <html>. No JavaScript,
 * so there is no wrong-logo flash, and it is correct for logged-out recipients
 * whose theme comes from their system preference. When no dark logo is set the
 * server serves the light file for the dark variant, so both requests share a
 * cache entry.
 *
 * The box is computed from the light logo's dimensions. `object-contain` keeps
 * a dark variant with a different shape undistorted inside it.
 */
export const BrandingLogoImage = ({ scope, id, alt, surface, dimensions, className }: BrandingLogoImageProps) => {
  const src = `/api/branding/logo/${scope}/${id}`;

  const { width, height } = getBrandingLogoBox(surface, dimensions);

  const sizeProps = {
    width,
    height,
    style: { width, height },
  };

  return (
    <>
      <img
        src={src}
        alt={alt}
        {...sizeProps}
        className={cn('flex-shrink-0 object-contain', className, 'dark:hidden')}
      />
      <img
        src={`${src}?variant=dark`}
        alt={alt}
        {...sizeProps}
        className={cn('flex-shrink-0 object-contain', className, 'hidden dark:block')}
      />
    </>
  );
};
