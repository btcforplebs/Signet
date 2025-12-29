import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiGet, useApiPost } from '../useApi';

// Mock the api-client module
vi.mock('../../lib/api-client.js', () => ({
  callApi: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

describe('useApiGet', () => {
  let mockApiGet: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiClient = await import('../../lib/api-client.js');
    mockApiGet = apiClient.apiGet as ReturnType<typeof vi.fn>;
  });

  it('should initialize with null data and not loading', () => {
    const { result } = renderHook(() => useApiGet<{ test: string }>('/test'));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set loading state during execution', async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiGet.mockReturnValue(promise);

    const { result } = renderHook(() => useApiGet<{ test: string }>('/test'));

    // Start execution
    act(() => {
      result.current.execute();
    });

    // Should be loading
    expect(result.current.loading).toBe(true);

    // Resolve and wait
    await act(async () => {
      resolvePromise!({ test: 'value' });
      await promise;
    });

    // Should not be loading anymore
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should return data on successful fetch', async () => {
    const mockData = { test: 'value' };
    mockApiGet.mockResolvedValue(mockData);

    const { result } = renderHook(() => useApiGet<{ test: string }>('/test'));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should set error on failed fetch', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useApiGet<{ test: string }>('/test'));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('should allow manual data updates via setData', () => {
    const { result } = renderHook(() => useApiGet<{ test: string }>('/test'));

    act(() => {
      result.current.setData({ test: 'manual' });
    });

    expect(result.current.data).toEqual({ test: 'manual' });
  });
});

describe('useApiPost', () => {
  let mockApiPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const apiClient = await import('../../lib/api-client.js');
    mockApiPost = apiClient.apiPost as ReturnType<typeof vi.fn>;
  });

  it('should initialize with not loading', () => {
    const { result } = renderHook(() =>
      useApiPost<{ input: string }, { result: string }>('/test')
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should execute POST request with input', async () => {
    const mockResponse = { result: 'success' };
    mockApiPost.mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useApiPost<{ input: string }, { result: string }>('/test')
    );

    let response: { result: string } | null = null;
    await act(async () => {
      response = await result.current.execute({ input: 'test-value' });
    });

    expect(mockApiPost).toHaveBeenCalledWith('/test', { input: 'test-value' });
    expect(response).toEqual(mockResponse);
  });

  it('should handle errors during POST', async () => {
    mockApiPost.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() =>
      useApiPost<{ input: string }, { result: string }>('/test')
    );

    await act(async () => {
      await result.current.execute({ input: 'test-value' });
    });

    expect(result.current.error).toBe('Server error');
  });

  it('should set loading state during execution', async () => {
    let resolvePromise: (value: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockApiPost.mockReturnValue(promise);

    const { result } = renderHook(() =>
      useApiPost<{ input: string }, { result: string }>('/test')
    );

    // Start execution
    act(() => {
      result.current.execute({ input: 'test-value' });
    });

    expect(result.current.loading).toBe(true);

    // Resolve
    await act(async () => {
      resolvePromise!({ result: 'done' });
      await promise;
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
