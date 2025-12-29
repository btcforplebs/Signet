/**
 * Key status indicating availability
 */
export type KeyStatus = 'online' | 'locked' | 'offline';

/**
 * Summary of a key for listing
 */
export interface KeySummary {
    name: string;
    npub?: string;
    userCount: number;
    tokenCount: number;
}

/**
 * Full key information for the UI
 */
export interface KeyInfo {
    name: string;
    npub?: string;
    bunkerUri?: string;
    status: KeyStatus;
    isEncrypted: boolean;
    userCount: number;
    tokenCount: number;
    requestCount: number;
    lastUsedAt: string | null;
}

/**
 * Summary of a key user (connected app/client)
 */
export interface KeyUserSummary {
    id: number;
    name: string;
    pubkey: string;
    description?: string;
    createdAt: Date | string;
    lastUsedAt?: Date | string | null;
    revokedAt?: Date | string | null;
    signingConditions?: unknown;
}

/**
 * Request body for creating a new key
 */
export interface CreateKeyRequest {
    keyName: string;
    passphrase?: string;
    nsec?: string;
}

/**
 * Response from key creation
 */
export interface CreateKeyResponse {
    ok: boolean;
    key?: KeyInfo;
    error?: string;
}
