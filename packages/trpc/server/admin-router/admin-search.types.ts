import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const adminSearchMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/search',
    summary: 'Search',
    description:
      'Search users, organisations, teams and documents across the instance. Requires a session admin or an INSTANCE-scoped API token.',
    tags: ['Admin'],
  },
};

export const ZAdminSearchResultTypeSchema = z.enum([
  'document',
  'user',
  'organisation',
  'team',
  'recipient',
  'subscription',
]);

export const ZAdminSearchResultSchema = z.object({
  label: z.string(),
  sublabel: z.string().optional(),
  path: z.string(),
  value: z.string(),
});

export const ADMIN_SEARCH_MAX_QUERY_LENGTH = 100;

export const ZAdminSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(ADMIN_SEARCH_MAX_QUERY_LENGTH),
});

export const ZAdminSearchResponseSchema = z.object({
  groups: z.array(
    z.object({
      type: ZAdminSearchResultTypeSchema,
      results: ZAdminSearchResultSchema.array(),
    }),
  ),
});

export type TAdminSearchResultType = z.infer<typeof ZAdminSearchResultTypeSchema>;
export type TAdminSearchResult = z.infer<typeof ZAdminSearchResultSchema>;
export type TAdminSearchRequest = z.infer<typeof ZAdminSearchRequestSchema>;
export type TAdminSearchResponse = z.infer<typeof ZAdminSearchResponseSchema>;
