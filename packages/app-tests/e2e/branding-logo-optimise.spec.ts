import { optimiseBrandingLogo } from '@documenso/lib/utils/images/logo';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const makePng = async (width = 1200, height = 1200) =>
  sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();

/** A 100×40 solid mark centred on a larger canvas of the given background. */
const makePaddedPng = async (background: { r: number; g: number; b: number; alpha: number }) => {
  const mark = await sharp({
    create: { width: 100, height: 40, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return sharp({ create: { width: 300, height: 300, channels: 4, background } })
    .composite([{ input: mark, left: 100, top: 130 }])
    .png()
    .toBuffer();
};

test.describe('optimiseBrandingLogo', () => {
  test('re-encodes a valid image to a PNG buffer', async () => {
    const input = await makePng();

    const output = await optimiseBrandingLogo(input);

    const metadata = await sharp(output.content).metadata();

    expect(metadata.format).toBe('png');
  });

  test('bounds the image to a maximum of 512px on its largest side and reports the result', async () => {
    const input = await makePng(2000, 1000);

    const output = await optimiseBrandingLogo(input);

    const metadata = await sharp(output.content).metadata();

    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
    expect({ width: output.width, height: output.height }).toEqual({
      width: metadata.width,
      height: metadata.height,
    });
  });

  test('trims transparent and white margins', async () => {
    const transparent = await optimiseBrandingLogo(await makePaddedPng({ r: 0, g: 0, b: 0, alpha: 0 }));
    const white = await optimiseBrandingLogo(await makePaddedPng({ r: 255, g: 255, b: 255, alpha: 1 }));

    expect({ width: transparent.width, height: transparent.height }).toEqual({ width: 100, height: 40 });
    expect({ width: white.width, height: white.height }).toEqual({ width: 100, height: 40 });
  });

  test('leaves a full-bleed logo whole', async () => {
    const output = await optimiseBrandingLogo(await makePaddedPng({ r: 200, g: 30, b: 30, alpha: 1 }));

    expect({ width: output.width, height: output.height }).toEqual({ width: 300, height: 300 });
  });

  test('rejects input that is not a valid image', async () => {
    await expect(optimiseBrandingLogo(Buffer.from('this is not an image'))).rejects.toThrow();
  });
});
