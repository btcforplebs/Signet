import { useState, useEffect, useCallback } from 'react';
import type { RelayStatusResponse } from '@signet/types';
import { apiGet } from '../lib/api-client.js';

interface UseRelaysResult {
  relays: RelayStatusResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRelays(): UseRelaysResult {
  const [relays, setRelays] = useState<RelayStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<RelayStatusResponse>('/relays');
      setRelays(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load relay status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { relays, loading, error, refresh };
}
