import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateOpenApiDocument } from 'trpc-to-openapi';

import { appRouter } from './router';

export const openApiDocument = {
  ...generateOpenApiDocument(appRouter, {
    title: 'Documenso v2 API',
    description: [
      'Welcome to the Documenso v2 API.',
      '',
      'This API provides access to our system, which you can use to integrate applications, automate workflows, or build custom tools.',
      '',
      '## Token scopes',
      '',
      '- **TEAM** tokens act inside one team. Tenant headers are ignored.',
      '- **ORGANISATION** tokens act inside one organisation. Pass `x-team-id: <id>` to call team-scoped endpoints for a team in that organisation.',
      '- **INSTANCE** tokens act anywhere. Pass `x-team-id` and/or `x-organisation-id` to target a tenant. Only INSTANCE tokens (or session admins) may call `/admin/*` endpoints.',
      '',
      'Team-scoped endpoints return `400` when an ORGANISATION or INSTANCE token omits `x-team-id`. Cross-tenant references return `403`.',
    ].join('\n'),
    version: '1.0.0',
    baseUrl: `${NEXT_PUBLIC_WEBAPP_URL()}/api/v2`,
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
      },
    },
  }),

  /**
   * Dirty way to pass through the security field.
   */
  security: [
    {
      apiKey: [],
    },
  ],
};
