export type BrandingLogoDimensions = {
  width: number;
  height: number;
};

export type BrandingLogoSurface = 'email' | 'signer-header' | 'editor-header' | 'signing-page';

type BrandingLogoSurfaceSize = {
  /** Target area in px², so a square mark and a long wordmark carry the same visual weight. */
  area: number;
  maxWidth: number;
  maxHeight: number;
  /** Floor that keeps long wordmarks legible, applied only while it still fits `maxWidth`. */
  minHeight: number;
};

export const BRANDING_LOGO_SURFACE_SIZES: Record<BrandingLogoSurface, BrandingLogoSurfaceSize> = {
  // Top of every transactional email, on a white plate in a 600px column.
  email: { area: 2500, maxWidth: 200, maxHeight: 48, minHeight: 20 },
  // The signing page's 24px nav row, beside the document title, down to 375px wide.
  'signer-header': { area: 1200, maxWidth: 140, maxHeight: 24, minHeight: 16 },
  // The envelope editor's nav row, same geometry as the signer header but desktop only.
  'editor-header': { area: 1200, maxWidth: 180, maxHeight: 24, minHeight: 16 },
  // The v1 signing page, stand-alone above the document title.
  'signing-page': { area: 3000, maxWidth: 240, maxHeight: 56, minHeight: 24 },
};

/**
 * Aspect ratio assumed for a logo whose dimensions were never recorded. A
 * typical mark-plus-wordmark lockup, so an unmeasured logo lands close to
 * where a measured one would.
 */
const FALLBACK_ASPECT_RATIO = 3;

/**
 * Read the pixel dimensions recorded in a stored branding logo reference (the
 * `JSON.stringify({ type, data, width, height })` string in the `brandingLogo`
 * columns). Returns null for an empty reference or one stored before
 * dimensions were recorded.
 */
export const getBrandingLogoDimensions = (reference: string | null | undefined): BrandingLogoDimensions | null => {
  if (!reference) {
    return null;
  }

  try {
    const { width, height } = JSON.parse(reference) as Partial<BrandingLogoDimensions>;

    if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
      return null;
    }

    return { width, height };
  } catch {
    return null;
  }
};

/**
 * The box a logo renders in on a surface. Sized by area rather than height, so
 * the logo's shape no longer decides how big it looks, then clamped to what
 * the surface can hold. Always keeps the logo's aspect ratio.
 */
export const getBrandingLogoBox = (
  surface: BrandingLogoSurface,
  dimensions: BrandingLogoDimensions | null,
): BrandingLogoDimensions => {
  const { area, maxWidth, maxHeight, minHeight } = BRANDING_LOGO_SURFACE_SIZES[surface];

  const ratio = dimensions ? dimensions.width / dimensions.height : FALLBACK_ASPECT_RATIO;

  let height = Math.sqrt(area / ratio);

  if (height > maxHeight) {
    height = maxHeight;
  }

  if (height * ratio > maxWidth) {
    height = maxWidth / ratio;
  }

  if (height < minHeight && minHeight * ratio <= maxWidth) {
    height = minHeight;
  }

  return {
    width: Math.round(height * ratio),
    height: Math.round(height),
  };
};

const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};
