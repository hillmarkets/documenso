import { AppError, AppErrorCode } from '../../errors/app-error';
import { putFileServerSide } from '../../universal/upload/put-file.server';
import { optimiseBrandingLogo } from '../../utils/images/logo';

/**
 * Validate, sanitise and store an uploaded branding logo. Returns the
 * `JSON.stringify({ type, data, width, height })` reference persisted in the
 * `brandingLogo` column. `type` and `data` are what the serving endpoints read;
 * `width` and `height` let every surface size the logo by its shape (see
 * `getBrandingLogoBox`).
 */
export const buildBrandingLogoData = async (file: File): Promise<string> => {
  const buffer = Buffer.from(await file.arrayBuffer());

  const optimised = await optimiseBrandingLogo(buffer).catch(() => {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'The branding logo must be a valid image file.',
    });
  });

  const documentData = await putFileServerSide({
    name: 'branding-logo.png',
    type: 'image/png',
    arrayBuffer: async () => Promise.resolve(optimised.content),
  });

  return JSON.stringify({ ...documentData, width: optimised.width, height: optimised.height });
};
