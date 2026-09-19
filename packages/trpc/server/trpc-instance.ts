import { AppError, genericErrorCodeToTrpcErrorCodeMap } from '@documenso/lib/errors/app-error';
import { initTRPC } from '@trpc/server';
import type { AnyZodObject } from 'zod';

import { dataTransformer } from '../utils/data-transformer';
import type { TrpcContext } from './context';

// Can't import type from trpc-to-openapi because it breaks build, not sure why.
export type TrpcRouteMeta = {
  openapi?: {
    enabled?: boolean;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: `/${string}`;
    summary?: string;
    description?: string;
    protect?: boolean;
    tags?: string[];
    // eslint-disable-next-line @typescript-eslint/ban-types
    contentTypes?: ('application/json' | 'application/x-www-form-urlencoded' | (string & {}))[];
    deprecated?: boolean;
    requestHeaders?: AnyZodObject;
    responseHeaders?: AnyZodObject;
    successDescription?: string;
    errorResponses?: number[] | Record<number, string>;
  };
} & Record<string, unknown>;

export const t = initTRPC
  .meta<TrpcRouteMeta>()
  .context<TrpcContext>()
  .create({
    transformer: dataTransformer,
    errorFormatter(opts) {
      const { shape, error, ctx } = opts;

      const originalError = error.cause;

      let data: Record<string, unknown> = shape.data;

      // Default unknown errors to 400, since if you're throwing an AppError it is expected
      // that you already know what you're doing.
      if (originalError instanceof AppError) {
        if (originalError.headers && ctx) {
          for (const [headerKey, headerValue] of Object.entries(originalError.headers)) {
            ctx.res.headers.append(headerKey, headerValue);
          }
        }

        data = {
          ...data,
          appError: AppError.toJSON(originalError),
          code: originalError.code,
          httpStatus: originalError.statusCode ?? genericErrorCodeToTrpcErrorCodeMap[originalError.code]?.status ?? 400,
        };
      }

      return {
        ...shape,
        data,
      };
    },
  });
