import { APP_DOCUMENT_UPLOAD_SIZE_LIMIT } from '@documenso/lib/constants/app';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';

import type { HonoEnv } from './router';

const MB = 1024 * 1024;

/**
 * Ceiling for JSON, form-urlencoded and other structured bodies. The largest legitimate one is
 * a drawn or uploaded signature image (capped at 1MB as a data URL), possibly batched with a
 * few other tRPC calls.
 *
 * This bounds the memory a single request can make the validator allocate: zod 3 records one
 * issue per failing array element (GHSA-mrhx-c7xc-m3w5), and even with `patches/zod+*.patch`
 * capping the issue list, the parsed body itself still has to fit in memory.
 */
const STRUCTURED_BODY_MAX_BYTES = 4 * MB;

/**
 * Ceiling for file uploads (multipart or raw bytes): the configured document upload limit plus
 * headroom for multipart framing and the other form fields sent alongside the file.
 */
const FILE_BODY_MAX_BYTES = (APP_DOCUMENT_UPLOAD_SIZE_LIMIT + 10) * MB;

const FILE_CONTENT_TYPES = ['multipart/form-data', 'application/pdf', 'application/octet-stream'];

const structuredBodyLimit = bodyLimit({
  maxSize: STRUCTURED_BODY_MAX_BYTES,
  onError: (c) => c.json({ message: 'Request body is too large' }, 413),
});

const fileBodyLimit = bodyLimit({
  maxSize: FILE_BODY_MAX_BYTES,
  onError: (c) => c.json({ message: 'Request body is too large' }, 413),
});

/**
 * Rejects oversized request bodies with a 413 before any handler parses them.
 *
 * File uploads get the document upload ceiling. So does `/api/jobs`, which is only reachable
 * with a job signature and carries bulk-send CSV content (up to 4MB before JSON escaping).
 * Everything else gets the structured-body ceiling.
 */
export const bodyLimitMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const contentType = (c.req.header('Content-Type') ?? '').toLowerCase();

  const isFileBody = FILE_CONTENT_TYPES.some((type) => contentType.startsWith(type));
  const isJobsRoute = c.req.path.startsWith('/api/jobs/');

  if (isFileBody || isJobsRoute) {
    return await fileBodyLimit(c, next);
  }

  return await structuredBodyLimit(c, next);
});
