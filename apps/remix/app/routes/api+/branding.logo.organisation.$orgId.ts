import { resolveBrandingLogo } from '@documenso/lib/server-only/branding/resolve-branding-logo';
import { sha256 } from '@documenso/lib/universal/crypto';
import { getFileServerSide } from '@documenso/lib/universal/upload/get-file.server';
import { loadLogo } from '@documenso/lib/utils/images/logo';
import { prisma } from '@documenso/prisma';

import type { Route } from './+types/branding.logo.organisation.$orgId';

const CACHE_CONTROL = 'public, max-age=0, stale-while-revalidate=86400';

export async function loader({ params, request }: Route.LoaderArgs) {
  const organisationId = params.orgId;

  if (!organisationId) {
    return Response.json(
      {
        status: 'error',
        message: 'Invalid organisation ID',
      },
      { status: 400 },
    );
  }

  const organisation = await prisma.organisation.findUnique({
    where: {
      id: organisationId,
    },
    include: {
      organisationGlobalSettings: true,
    },
  });

  const settings = organisation?.organisationGlobalSettings;

  const variant = new URL(request.url).searchParams.get('variant');
  const brandingLogo = settings ? resolveBrandingLogo(settings, variant) : '';

  if (!settings || !brandingLogo) {
    return Response.json(
      {
        status: 'error',
        message: 'Logo not found',
      },
      { status: 404 },
    );
  }

  if (!settings.brandingEnabled) {
    return Response.json(
      {
        status: 'error',
        message: 'Branding is not enabled',
      },
      { status: 400 },
    );
  }

  // Keyed on the reference actually served, so a dark request that fell back to
  // the light logo shares the light response's cache entry.
  const etag = `"${Buffer.from(sha256(brandingLogo)).toString('hex')}"`;

  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': CACHE_CONTROL,
      },
    });
  }

  const file = await getFileServerSide(JSON.parse(brandingLogo)).catch((e) => {
    console.error(e);
  });

  if (!file) {
    return Response.json(
      {
        status: 'error',
        message: 'Not found',
      },
      { status: 404 },
    );
  }

  const { content, contentType } = await loadLogo(file);

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': content.length.toString(),
      'Cache-Control': CACHE_CONTROL,
      ETag: etag,
    },
  });
}
