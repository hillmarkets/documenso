import { prisma } from '@documenso/prisma';
import sharp from 'sharp';

import { getFileServerSide } from '../../universal/upload/get-file.server';
import { getBrandingLogoDimensions } from '../../utils/branding-logo-size';

type LogoColumn = 'brandingLogo' | 'brandingLogoDark';

const LOGO_COLUMNS: LogoColumn[] = ['brandingLogo', 'brandingLogoDark'];

/**
 * Record pixel dimensions on branding logos uploaded before
 * `buildBrandingLogoData` started storing them, so those logos size by their
 * shape too. Runs on boot and is idempotent: a reference that already carries
 * dimensions is skipped, and each write is conditional on the reference being
 * unchanged, so a logo uploaded mid-run is never overwritten.
 *
 * The files themselves are left alone (only measured, not re-trimmed), so a
 * failure here costs nothing but the sizing, which falls back to a typical
 * logo shape.
 */
export const migrateBrandingLogoDimensions = async () => {
  const [organisationSettings, teamSettings] = await Promise.all([
    prisma.organisationGlobalSettings.findMany({
      select: { id: true, brandingLogo: true, brandingLogoDark: true },
    }),
    prisma.teamGlobalSettings.findMany({
      select: { id: true, brandingLogo: true, brandingLogoDark: true },
    }),
  ]);

  let migrated = 0;

  for (const settings of organisationSettings) {
    for (const column of LOGO_COLUMNS) {
      const measured = await measureReference(settings[column]);

      if (!measured) {
        continue;
      }

      const { count } = await prisma.organisationGlobalSettings.updateMany({
        where: { id: settings.id, [column]: settings[column] },
        data: { [column]: measured },
      });

      migrated += count;
    }
  }

  for (const settings of teamSettings) {
    for (const column of LOGO_COLUMNS) {
      const measured = await measureReference(settings[column]);

      if (!measured) {
        continue;
      }

      const { count } = await prisma.teamGlobalSettings.updateMany({
        where: { id: settings.id, [column]: settings[column] },
        data: { [column]: measured },
      });

      migrated += count;
    }
  }

  if (migrated > 0) {
    console.log(`Recorded dimensions on ${migrated} branding logo(s)`);
  }
};

/**
 * The reference with the stored file's dimensions added, or null when there is
 * nothing to do (no logo, dimensions already recorded) or the file cannot be
 * read.
 */
const measureReference = async (reference: string | null): Promise<string | null> => {
  if (!reference || getBrandingLogoDimensions(reference)) {
    return null;
  }

  try {
    const parsed = JSON.parse(reference);

    const file = await getFileServerSide(parsed);

    const { width, height } = await sharp(file).metadata();

    if (!width || !height) {
      return null;
    }

    return JSON.stringify({ ...parsed, width, height });
  } catch (err) {
    console.error('Could not measure a branding logo', err);

    return null;
  }
};
