import { useState, useCallback } from 'react';
import { callApi, apiGet, apiPost, apiPatch } from '../lib/api-client.js';
import { buildErrorMessage } from '../lib/formatters.js';

export { callApi, apiGet, apiPost, apiPatch };

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<T | null>;
  setData: (data: T | null) => void;
}

export function useApiGet<T>(path: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<T>(path);
      setData(result);
      return result;
    } catch (err) {
      const message = buildErrorMessage(err, 'Request failed');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error, execute, setData };
}

export interface UseApiMutationResult<TInput, TOutput> {
  loading: boolean;
  error: string | null;
  execute: (input: TInput) => Promise<TOutput | null>;
}

export function useApiPost<TInput, TOutput>(path: string): UseApiMutationResult<TInput, TOutput> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (input: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);
    try {
      return await apiPost<TOutput>(path, input);
    } catch (err) {
      const message = buildErrorMessage(err, 'Request failed');
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { loading, error, execute };
}
