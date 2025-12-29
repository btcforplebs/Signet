import { vi } from 'vitest';
import type {
  PendingRequest,
  KeyInfo,
  ConnectedApp,
  DashboardStats,
  ActivityEntry,
  ConnectionInfo,
} from '@signet/types';

/**
 * Create mock pending request
 */
export function createMockRequest(overrides: Partial<PendingRequest> = {}): PendingRequest {
  return {
    id: 'test-request-id',
    keyName: 'test-key',
    method: 'sign_event',
    remotePubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    createdAt: new Date().toISOString(),
    requiresPassword: false,
    eventPreview: null,
    ...overrides,
  };
}

/**
 * Create mock key info
 */
export function createMockKey(overrides: Partial<KeyInfo> = {}): KeyInfo {
  return {
    name: 'test-key',
    npub: 'npub1test123456789012345678901234567890123456789012345678901234',
    bunkerUri: 'bunker://test...',
    status: 'stopped',
    userCount: 0,
    tokenCount: 0,
    isEncrypted: false,
    ...overrides,
  };
}

/**
 * Create mock connected app
 */
export function createMockApp(overrides: Partial<ConnectedApp> = {}): ConnectedApp {
  return {
    id: 1,
    keyName: 'test-key',
    userPubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    description: 'Test App',
    permissions: ['sign_event'],
    connectedAt: new Date().toISOString(),
    lastUsedAt: null,
    requestCount: 0,
    ...overrides,
  };
}

/**
 * Create mock dashboard stats
 */
export function createMockDashboardStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    pendingRequests: 0,
    connectedApps: 0,
    totalKeys: 0,
    ...overrides,
  };
}

/**
 * Create mock activity entry
 */
export function createMockActivityEntry(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 1,
    timestamp: new Date().toISOString(),
    type: 'approval',
    method: 'sign_event',
    params: null,
    keyName: 'test-key',
    userPubkey: '0123456789abcdef',
    description: 'Test App',
    ...overrides,
  };
}

/**
 * Create mock connection info
 */
export function createMockConnectionInfo(overrides: Partial<ConnectionInfo> = {}): ConnectionInfo {
  return {
    npub: 'npub1test...',
    pubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    npubUri: 'npub:test...',
    hexUri: 'hex:test...',
    relays: ['wss://relay.example.com'],
    ...overrides,
  };
}

/**
 * Create a mock fetch response
 */
export function mockFetchResponse(data: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    status: ok ? 200 : 400,
  });
}

/**
 * Create mock API responses for common endpoints
 */
export function setupMockApi(overrides: {
  requests?: PendingRequest[];
  keys?: KeyInfo[];
  apps?: ConnectedApp[];
  stats?: DashboardStats;
  activity?: ActivityEntry[];
  connection?: ConnectionInfo;
} = {}) {
  const defaultResponses: Record<string, unknown> = {
    '/requests': { requests: overrides.requests || [] },
    '/keys': { keys: overrides.keys || [] },
    '/apps': { apps: overrides.apps || [] },
    '/dashboard/stats': overrides.stats || createMockDashboardStats(),
    '/dashboard/activity': { activity: overrides.activity || [] },
    '/connection': overrides.connection || createMockConnectionInfo(),
  };

  return vi.fn().mockImplementation((url: string) => {
    const path = url.replace(/^\/api/, '');
    const data = defaultResponses[path] || {};

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      status: 200,
    });
  });
}
