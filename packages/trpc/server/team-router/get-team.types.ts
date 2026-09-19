import { TeamMemberRole } from '@documenso/prisma/generated/types';
import OrganisationGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationGlobalSettingsSchema';
import TeamGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';
import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const getTeamMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/team/{teamReference}',
    summary: 'Get team',
    description: 'Get a team by ID or URL',
    tags: ['team'],
  },
};

export const ZGetTeamRequestSchema = z.object({
  // Preprocess (rather than a string|number union) so the OpenAPI generator accepts it as a path
  // parameter while the web client can keep passing a numeric ID.
  teamReference: z.preprocess((value) => String(value), z.string()).describe('The ID or URL of the team.'),
});

export const ZGetTeamResponseSchema = TeamSchema.pick({
  id: true,
  name: true,
  url: true,
  createdAt: true,
  avatarImageId: true,
  organisationId: true,
}).extend({
  currentTeamRole: z.nativeEnum(TeamMemberRole),
  teamSettings: TeamGlobalSettingsSchema.omit({
    id: true,
  }),
  derivedSettings: OrganisationGlobalSettingsSchema.omit({
    id: true,
  }),
});

export type TGetTeamResponse = z.infer<typeof ZGetTeamResponseSchema>;
