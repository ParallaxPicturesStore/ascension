import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import type { PartnerData, Alert, Streak, WeeklyStats } from '@ascension/api';

interface PartnerState {
  partner: PartnerData | null;
  streak: Streak | null;
  weeklyStats: WeeklyStats | null;
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Fetches and caches data about the connected partner (the monitored user).
 * The current user (accountability partner) passes their own userId.
 */
export function usePartner(userId: string | undefined): PartnerState {
  const api = useApi();
  const [partner, setPartner] = useState<PartnerData | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch partner data (includes streak + recent alerts)
      const partnerData = await api.users.getPartnerData(userId);
      setPartner(partnerData);

      console.log("session user id : " , userId);      
      if (partnerData) {
        setStreak(partnerData.streak);

        // Fetch full alert list for this partner
        const allAlerts = await api.alerts.getForPartner(userId);
        setAlerts(allAlerts);

        // Fetch weekly stats for the monitored user
        const stats = await api.streaks.getWeeklyStats(partnerData.id);
        setWeeklyStats(stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partner data');
    } finally {
      setLoading(false);
    }
  }, [api, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { partner, streak, weeklyStats, alerts, loading, error, refresh };
}
