import React, { createContext, useContext, useCallback, useMemo, useRef, useEffect } from 'react';
import { useServerEvents, type ServerEvent, type ServerEventCallback } from '../hooks/useServerEvents.js';

interface ServerEventsContextType {
  connected: boolean;
  error: string | null;
  reconnecting: boolean;
  subscribe: (callback: ServerEventCallback) => () => void;
}

const ServerEventsContext = createContext<ServerEventsContextType | null>(null);

export function ServerEventsProvider({ children }: { children: React.ReactNode }) {
  const subscribersRef = useRef<Set<ServerEventCallback>>(new Set());

  const handleEvent = useCallback((event: ServerEvent) => {
    for (const callback of subscribersRef.current) {
      try {
        callback(event);
      } catch (err) {
        console.error('Error in SSE event subscriber:', err);
      }
    }
  }, []);

  const { connected, error, reconnecting } = useServerEvents({
    enabled: true,
    onEvent: handleEvent,
  });

  const subscribe = useCallback((callback: ServerEventCallback) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const value = useMemo(() => ({
    connected,
    error,
    reconnecting,
    subscribe,
  }), [connected, error, reconnecting, subscribe]);

  return (
    <ServerEventsContext.Provider value={value}>
      {children}
    </ServerEventsContext.Provider>
  );
}

export function useServerEventsContext() {
  const context = useContext(ServerEventsContext);
  if (!context) {
    throw new Error('useServerEventsContext must be used within a ServerEventsProvider');
  }
  return context;
}

/**
 * Hook to subscribe to SSE events with automatic cleanup
 */
export function useSSESubscription(callback: ServerEventCallback) {
  const { subscribe } = useServerEventsContext();

  useEffect(() => {
    return subscribe(callback);
  }, [subscribe, callback]);
}
