import { useState, useCallback, useEffect } from 'react';
import type { ConnectedApp, TrustLevel } from '@signet/types';
import { apiGet, apiPost, apiPatch } from '../lib/api-client.js';
import { buildErrorMessage } from '../lib/formatters.js';
import { useSSESubscription } from '../contexts/ServerEventsContext.js';
import type { ServerEvent } from './useServerEvents.js';

interface UseAppsResult {
  apps: ConnectedApp[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  revokeApp: (appId: number) => Promise<boolean>;
  updateDescription: (appId: number, description: string) => Promise<boolean>;
  updateTrustLevel: (appId: number, trustLevel: TrustLevel) => Promise<boolean>;
  clearError: () => void;
}

export function useApps(): UseAppsResult {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<{ apps: ConnectedApp[] }>('/apps');
      setApps(response.apps);
      setError(null);
    } catch (err) {
      setError(buildErrorMessage(err, 'Unable to load connected apps'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    if (!initialFetchDone) {
      refresh();
      setInitialFetchDone(true);
    }
  }, [initialFetchDone, refresh]);

  // Subscribe to SSE events for real-time updates
  const handleSSEEvent = useCallback((event: ServerEvent) => {
    if (event.type === 'app:connected') {
      // Add new app to the list (or replace if already exists)
      setApps(prev => {
        const exists = prev.some(app => app.id === event.app.id);
        if (exists) {
          return prev.map(app => app.id === event.app.id ? event.app : app);
        }
        // Add new app at the beginning (most recent)
        return [event.app, ...prev];
      });
    }
  }, []);

  useSSESubscription(handleSSEEvent);

  const revokeApp = useCallback(async (appId: number): Promise<boolean> => {
    try {
      const result = await apiPost<{ ok?: boolean; error?: string }>(`/apps/${appId}/revoke`, {});
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Failed to revoke app access');
      }
      await refresh();
      return true;
    } catch (err) {
      setError(buildErrorMessage(err, 'Failed to revoke app access'));
      return false;
    }
  }, [refresh]);

  const updateDescription = useCallback(async (appId: number, description: string): Promise<boolean> => {
    if (!description.trim()) {
      setError('Description is required');
      return false;
    }

    try {
      const result = await apiPatch<{ ok?: boolean; error?: string }>(`/apps/${appId}`, { description: description.trim() });
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Failed to rename app');
      }
      await refresh();
      return true;
    } catch (err) {
      setError(buildErrorMessage(err, 'Failed to rename app'));
      return false;
    }
  }, [refresh]);

  const updateTrustLevel = useCallback(async (appId: number, trustLevel: TrustLevel): Promise<boolean> => {
    try {
      const result = await apiPatch<{ ok?: boolean; error?: string }>(`/apps/${appId}`, { trustLevel });
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Failed to update trust level');
      }
      await refresh();
      return true;
    } catch (err) {
      setError(buildErrorMessage(err, 'Failed to update trust level'));
      return false;
    }
  }, [refresh]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    apps,
    loading,
    error,
    refresh,
    revokeApp,
    updateDescription,
    updateTrustLevel,
    clearError,
  };
}
