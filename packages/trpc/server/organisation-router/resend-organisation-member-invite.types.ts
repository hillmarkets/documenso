import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc-instance';

export const resendOrganisationMemberInviteMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/organisation/{organisationId}/member/invite/{invitationId}/resend',
    summary: 'Resend organisation member invite',
    description: 'Resend a organisation member invite',
    tags: ['Organisation'],
  },
};

export const ZResendOrganisationMemberInviteRequestSchema = z.object({
  organisationId: z.string(),
  invitationId: z.string(),
});

export const ZResendOrganisationMemberInviteResponseSchema = z.void();
