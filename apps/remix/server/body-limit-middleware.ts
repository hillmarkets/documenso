import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';

import type { HonoEnv } from './router';

const MB = 1024 * 1024;

/**
 * Ceiling for every body that is not a file upload. The largest legitimate one is a drawn or
 * uploaded signature image (capped at 1MB as a data URL), possibly batched with a few other
 * tRPC calls.
 *
 * This bounds the memory a single request can make the validator allocate: zod 3 records one
 * issue per failing array element (GHSA-mrhx-c7xc-m3w5), and even with `patches/zod+*.patch`
 * capping the issue list, the parsed body itself still has to fit in memory.
 */
const DEFAULT_BODY_MAX_BYTES = 4 * MB;

/**
 * Ceiling for file uploads: the configured document upload limit plus headroom for multipart
 * framing and the other form fields sent alongside the file.
 */
const FILE_BODY_MAX_BYTES = (APP_DOCUMENT_UPLOAD_SIZE_LIMIT + 10) * MB;

/**
 * Media types that carry file bytes. Matched exactly, so a JSON body cannot claim a file type
 * with a lookalike value such as `multipart/form-data-x`.
 */
const FILE_MEDIA_TYPES = new Set(['multipart/form-data', 'application/pdf', 'application/octet-stream']);

/**
 * Routes that accept file uploads. Both conditions are required for the larger ceiling, so
 * relabelling a body as multipart elsewhere still gets the default ceiling.
 */
const FILE_UPLOAD_PATH_PREFIXES = ['/api/files/', '/api/trpc/', '/api/v2/', '/api/v2-beta/'];

/**
 * Only reachable with a job signature. Carries bulk-send CSV content (up to 4MB before JSON
 * escaping), so it gets the larger ceiling whatever the media type.
 */
const JOBS_PATH_PREFIX = '/api/jobs/';

const onBodyTooLarge = (c: Context) => c.json({ message: 'Request body is too large' }, 413);

const defaultBodyLimit = bodyLimit({ maxSize: DEFAULT_BODY_MAX_BYTES, onError: onBodyTooLarge });

const fileBodyLimit = bodyLimit({ maxSize: FILE_BODY_MAX_BYTES, onError: onBodyTooLarge });

/**
 * Rejects oversized request bodies with a 413 before any handler parses them.
 */
export const bodyLimitMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const path = c.req.path;

  if (path.startsWith(JOBS_PATH_PREFIX)) {
    return await fileBodyLimit(c, next);
  }

  const isUploadRoute = FILE_UPLOAD_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isUploadRoute && FILE_MEDIA_TYPES.has(getMediaType(c.req.header('Content-Type')))) {
    return await fileBodyLimit(c, next);
  }

  return await defaultBodyLimit(c, next);
});

/**
 * The media type of a Content-Type header, without parameters (`multipart/form-data;
 * boundary=...` becomes `multipart/form-data`).
 */
const getMediaType = (contentType: string | undefined) => {
  return (contentType ?? '').split(';')[0].trim().toLowerCase();
};
