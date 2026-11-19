import { z } from 'zod';

import { DEFAULT_ENVELOPE_CONTENT_COUNT, DEFAULT_ENVELOPE_CONTENT_IMAGE_COUNT } from '../constants/envelope-content';

/**
 * Per-team usage allowances. `Infinity` means unlimited; every self-hosted
 * organisation is unlimited except for `maximumEnvelopeItemCount`, which is an
 * organisation-claim setting rather than a billing quota.
 */
export const ZUsageAllowanceSchema = z.object({
  documents: z.number(),
  recipients: z.number(),
  directTemplates: z.number(),
});

export type TUsageAllowance = z.infer<typeof ZUsageAllowanceSchema>;

export const ZTeamLimitsSchema = z.object({
  quota: ZUsageAllowanceSchema,
  remaining: ZUsageAllowanceSchema,
  maximumEnvelopeItemCount: z.number(),
  maximumEnvelopeContentCount: z.number(),
  maximumEnvelopeContentImageCount: z.number(),
});

export type TTeamLimits = z.infer<typeof ZTeamLimitsSchema>;

export const UNLIMITED_USAGE: TUsageAllowance = {
  documents: Number.POSITIVE_INFINITY,
  recipients: Number.POSITIVE_INFINITY,
  directTemplates: Number.POSITIVE_INFINITY,
};

/**
 * Initial value the UI renders with before the organisation claim is known.
 */
export const DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT = 5;

/**
 * Default recipient allowance recorded on a fresh organisation claim.
 * 0 means unlimited.
 */
export const DEFAULT_RECIPIENT_COUNT = 20;

export type TClaimLimits = Pick<
  TTeamLimits,
  'maximumEnvelopeItemCount' | 'maximumEnvelopeContentCount' | 'maximumEnvelopeContentImageCount'
>;

export const buildTeamLimits = (claimLimits: TClaimLimits): TTeamLimits => ({
  quota: UNLIMITED_USAGE,
  remaining: UNLIMITED_USAGE,
  ...claimLimits,
});

/**
 * Values the UI renders with before the organisation claim is known.
 */
export const DEFAULT_CLAIM_LIMITS: TClaimLimits = {
  maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
  maximumEnvelopeContentCount: DEFAULT_ENVELOPE_CONTENT_COUNT,
  maximumEnvelopeContentImageCount: DEFAULT_ENVELOPE_CONTENT_IMAGE_COUNT,
};
