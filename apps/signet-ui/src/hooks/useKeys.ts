import { useState, useCallback } from 'react';
import type { KeyInfo } from '@signet/types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api-client.js';
import { buildErrorMessage } from '../lib/formatters.js';

interface DeleteKeyResult {
  ok: boolean;
  revokedApps?: number;
  error?: string;
}

interface UseKeysResult {
  keys: KeyInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createKey: (data: { keyName: string; passphrase?: string; nsec?: string }) => Promise<KeyInfo | null>;
  deleteKey: (keyName: string, passphrase?: string) => Promise<{ success: boolean; revokedApps?: number }>;
  unlockKey: (keyName: string, passphrase: string) => Promise<boolean>;
  renameKey: (keyName: string, newName: string) => Promise<boolean>;
  setPassphrase: (keyName: string, passphrase: string) => Promise<boolean>;
  creating: boolean;
  deleting: boolean;
  unlocking: boolean;
  renaming: boolean;
  settingPassphrase: boolean;
  clearError: () => void;
}

export function useKeys(): UseKeysResult {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [settingPassphrase, setSettingPassphrase] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet<{ keys: KeyInfo[] }>('/keys');
      setKeys(response.keys);
      setError(null);
    } catch (err) {
      setError(buildErrorMessage(err, 'Unable to load keys'));
    } finally {
      setLoading(false);
    }
  }, []);

  const createKey = useCallback(async (data: { keyName: string; passphrase?: string; nsec?: string }): Promise<KeyInfo | null> => {
    if (!data.keyName.trim()) {
      setError('Key name is required');
      return null;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await apiPost<{ ok?: boolean; key?: KeyInfo; error?: string }>('/keys', data);

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create key');
      }

      await refresh();
      return result.key ?? null;
    } catch (err) {
      setError(buildErrorMessage(err, 'Failed to create key'));
      return null;
    } finally {
      setCreating(false);
    }
  }, [refresh]);

  const deleteKey = useCallback(async (keyName: string, passphrase?: string): Promise<{ success: boolean; revokedApps?: number }> => {
    setDeleting(true);
    setError(null);

    try {
      const result = await apiDelete<DeleteKeyResult>(
        `/keys/${encodeURIComponent(keyName)}`,
        passphrase ? { passphrase } : undefined
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete key');
      }

      await refresh();
      return { success: true, revokedApps: result.revokedApps };
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to delete key');
      setError(message);
      return { success: false };
    } finally {
      setDeleting(false);
    }
  }, [refresh]);

  const unlockKey = useCallback(async (keyName: string, passphrase: string): Promise<boolean> => {
    setUnlocking(true);
    setError(null);

    try {
      const result = await apiPost<{ ok?: boolean; error?: string }>(
        `/keys/${encodeURIComponent(keyName)}/unlock`,
        { passphrase }
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to unlock key');
      }

      await refresh();
      return true;
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to unlock key');
      setError(message);
      return false;
    } finally {
      setUnlocking(false);
    }
  }, [refresh]);

  const renameKey = useCallback(async (keyName: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) {
      setError('New key name is required');
      return false;
    }

    setRenaming(true);
    setError(null);

    try {
      const result = await apiPatch<{ ok?: boolean; error?: string }>(
        `/keys/${encodeURIComponent(keyName)}`,
        { newName: newName.trim() }
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to rename key');
      }

      await refresh();
      return true;
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to rename key');
      setError(message);
      return false;
    } finally {
      setRenaming(false);
    }
  }, [refresh]);

  const setPassphrase = useCallback(async (keyName: string, passphrase: string): Promise<boolean> => {
    if (!passphrase.trim()) {
      setError('Passphrase is required');
      return false;
    }

    setSettingPassphrase(true);
    setError(null);

    try {
      const result = await apiPost<{ ok?: boolean; error?: string }>(
        `/keys/${encodeURIComponent(keyName)}/set-passphrase`,
        { passphrase }
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to set passphrase');
      }

      await refresh();
      return true;
    } catch (err) {
      const message = buildErrorMessage(err, 'Failed to set passphrase');
      setError(message);
      return false;
    } finally {
      setSettingPassphrase(false);
    }
  }, [refresh]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    keys,
    loading,
    error,
    refresh,
    createKey,
    deleteKey,
    unlockKey,
    renameKey,
    setPassphrase,
    creating,
    deleting,
    unlocking,
    renaming,
    settingPassphrase,
    clearError,
  };
}
