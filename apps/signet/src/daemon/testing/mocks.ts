import { vi } from 'vitest';

/**
 * Mock Prisma client for testing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockPrisma(): any {
  return {
    keyUser: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    token: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    key: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    request: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    log: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    signingCondition: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

/**
 * Mock stored keys for testing
 */
export function createMockStoredKeys() {
  return {
    'test-key': {
      key: 'nsec1test123456789012345678901234567890123456789012345678901234',
    },
    'encrypted-key': {
      iv: 'abcdef1234567890',
      data: 'encrypted-data-here',
    },
  };
}

/**
 * Mock request record for testing
 */
export function createMockRequest(overrides: Partial<{
  id: string;
  keyName: string | null;
  method: string;
  remotePubkey: string;
  params: string | null;
  allowed: boolean | null;
  createdAt: Date;
  processedAt: Date | null;
}> = {}) {
  return {
    id: 'test-request-id',
    keyName: 'test-key',
    method: 'sign_event',
    remotePubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    params: null,
    allowed: null,
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

/**
 * Mock key user record for testing
 */
export function createMockKeyUser(overrides: Partial<{
  id: number;
  keyName: string;
  userPubkey: string;
  description: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  signingConditions: Array<{
    id: number;
    method: string;
    kind: number | null;
    allowed: boolean;
  }>;
}> = {}) {
  return {
    id: 1,
    keyName: 'test-key',
    userPubkey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    description: 'Test App',
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
    signingConditions: [],
    ...overrides,
  };
}

/**
 * Mock log entry for testing
 */
export function createMockLogEntry(overrides: Partial<{
  id: number;
  timestamp: Date;
  type: string;
  method: string | null;
  params: string | null;
  keyUserId: number | null;
  KeyUser: {
    keyName: string;
    userPubkey: string;
    description: string | null;
  } | null;
}> = {}) {
  return {
    id: 1,
    timestamp: new Date(),
    type: 'approval',
    method: 'sign_event',
    params: null,
    keyUserId: 1,
    KeyUser: {
      keyName: 'test-key',
      userPubkey: '0123456789abcdef',
      description: 'Test App',
    },
    ...overrides,
  };
}
