import sharp from 'sharp';

import type { BrandingLogoDimensions } from '../branding-logo-size';

export const loadLogo = async (file: Uint8Array) => {
  const content = await sharp(file).toFormat('png', { quality: 80 }).toBuffer();

  return {
    contentType: 'image/png',
    content,
  };
};

export type OptimisedBrandingLogo = BrandingLogoDimensions & {
  content: Buffer;
};

/**
 * Validate and sanitise an uploaded branding logo. Re-encoding through `sharp`
 * proves the bytes are a real raster image and strips any embedded payloads.
 * Throws if the input cannot be parsed as an image.
 *
 * Empty margins are trimmed first, so padding baked into the file does not
 * shrink the logo on every surface, and the final pixel dimensions are
 * returned so surfaces can size the logo by its shape.
 */
export const optimiseBrandingLogo = async (input: Buffer | Uint8Array): Promise<OptimisedBrandingLogo> => {
  const trimmed = await trimEmptyMargins(input);

  const { data, info } = await sharp(trimmed)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  return {
    content: data,
    width: info.width,
    height: info.height,
  };
};

/**
 * Trim margins only when the corner is transparent or near-white, the two
 * backgrounds a logo is padded with. A full-bleed logo (a coloured badge, say)
 * has its own colour in the corner, and trimming that would eat the badge.
 */
const trimEmptyMargins = async (input: Buffer | Uint8Array): Promise<Buffer | Uint8Array> => {
  const { data: corner } = await sharp(input)
    .ensureAlpha()
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const [red, green, blue, alpha] = corner;

  const isTransparent = alpha < 8;
  const isWhite = alpha > 247 && red > 247 && green > 247 && blue > 247;

  if (!isTransparent && !isWhite) {
    return input;
  }

  // A blank image has nothing to trim to and sharp refuses it, so keep it whole.
  return await sharp(input)
    .trim({ threshold: 10 })
    .png()
    .toBuffer()
    .catch(() => input);
};
