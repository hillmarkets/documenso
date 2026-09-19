import { createContext, useContext, useMemo } from 'react';

import { buildTeamLimits, DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, type TTeamLimits } from '../../types/limits';

export type LimitsContextValue = TTeamLimits & {
  /**
   * Kept for call-site compatibility: limits are static on self-hosted
   * instances, so there is nothing to refresh.
   */
  refreshLimits: () => Promise<void>;
};

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  if (!limits) {
    throw new Error('useLimits must be used within a LimitsProvider');
  }

  return limits;
};

export type LimitsProviderProps = {
  /** From the organisation claim. Falls back to the UI default while loading. */
  maximumEnvelopeItemCount?: number;
  children?: React.ReactNode;
};

export const LimitsProvider = ({
  maximumEnvelopeItemCount = DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
  children,
}: LimitsProviderProps) => {
  const value = useMemo<LimitsContextValue>(
    () => ({
      ...buildTeamLimits(maximumEnvelopeItemCount),
      refreshLimits: async () => {},
    }),
    [maximumEnvelopeItemCount],
  );

  return <LimitsContext.Provider value={value}>{children}</LimitsContext.Provider>;
};
