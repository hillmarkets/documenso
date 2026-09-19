import { z } from 'zod';

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

export const buildTeamLimits = (maximumEnvelopeItemCount: number): TTeamLimits => ({
  quota: UNLIMITED_USAGE,
  remaining: UNLIMITED_USAGE,
  maximumEnvelopeItemCount,
});
