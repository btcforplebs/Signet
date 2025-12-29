import type { NDKEvent, NostrEvent } from '@nostr-dev-kit/ndk';
import prisma from '../../db.js';
import { ACL_CACHE_TTL_MS, ACL_CACHE_MAX_SIZE } from '../constants.js';

export type RpcMethod = 'connect' | 'sign_event' | 'encrypt' | 'decrypt' | 'ping';

/**
 * Simple LRU-like cache for ACL decisions with TTL.
 * Reduces database load for repeated requests from the same app.
 */
interface CacheEntry {
    keyUser: {
        id: number;
        revokedAt: Date | null;
        trustLevel: string | null;
    };
    hasExplicitDeny: boolean;
    timestamp: number;
}

const aclCache = new Map<string, CacheEntry>();

function getCacheKey(keyName: string, remotePubkey: string): string {
    return `${keyName}:${remotePubkey}`;
}

function getCachedEntry(keyName: string, remotePubkey: string): CacheEntry | null {
    const key = getCacheKey(keyName, remotePubkey);
    const entry = aclCache.get(key);

    if (!entry) {
        return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > ACL_CACHE_TTL_MS) {
        aclCache.delete(key);
        return null;
    }

    return entry;
}

function setCachedEntry(keyName: string, remotePubkey: string, entry: Omit<CacheEntry, 'timestamp'>): void {
    const key = getCacheKey(keyName, remotePubkey);

    // Simple size limit - remove oldest entries when full
    if (aclCache.size >= ACL_CACHE_MAX_SIZE) {
        const firstKey = aclCache.keys().next().value;
        if (firstKey) {
            aclCache.delete(firstKey);
        }
    }

    aclCache.set(key, { ...entry, timestamp: Date.now() });
}

/**
 * Invalidate cache for a specific key/pubkey combination.
 * Call this when permissions change.
 */
export function invalidateAclCache(keyName: string, remotePubkey: string): void {
    aclCache.delete(getCacheKey(keyName, remotePubkey));
}

/**
 * Invalidate all cache entries for a key.
 * Call this when revoking all apps for a key.
 */
export function invalidateAclCacheForKey(keyName: string): void {
    for (const key of aclCache.keys()) {
        if (key.startsWith(`${keyName}:`)) {
            aclCache.delete(key);
        }
    }
}

/**
 * Clear the entire ACL cache.
 */
export function clearAclCache(): void {
    aclCache.clear();
}

export type TrustLevel = 'paranoid' | 'reasonable' | 'full';

export type AllowScope = {
    kind?: number | 'all';
};

/**
 * Event kinds considered "safe" for auto-approval in "reasonable" trust level.
 * These are common social actions that are low-risk.
 */
export const SAFE_KINDS = new Set([
    1,      // Short text note
    6,      // Repost
    7,      // Reaction
    16,     // Generic repost
    1111,   // Comment
    30023,  // Long-form article
    30024,  // Draft long-form
    1808,   // Zap goal
    9735,   // Zap receipt (created by wallet, but harmless)
    10000,  // Mute list (user preference)
    10001,  // Pin list
    30000,  // Follow sets
    30001,  // Bookmark sets
    24242,  // Blossom authorization (file upload/delete auth)
]);

/**
 * Event kinds considered "sensitive" that require explicit approval even in "reasonable" mode.
 * These can change identity, leak data, or have security implications.
 */
export const SENSITIVE_KINDS = new Set([
    0,      // Profile metadata (identity)
    3,      // Contact/follow list (social graph)
    4,      // NIP-04 encrypted DM (privacy)
    5,      // Event deletion (irreversible)
    10002,  // Relay list (can affect connectivity)
    22242,  // Client authentication (security)
    24133,  // NIP-46 request (meta - signing for another signer)
    13194,  // Wallet info (financial)
    23194,  // Wallet request (financial)
    23195,  // Wallet response (financial)
]);

/**
 * Check if a kind is safe for auto-approval in "reasonable" mode.
 * Unknown kinds default to requiring approval (safe by default).
 */
export function isKindSafe(kind: number): boolean {
    if (SENSITIVE_KINDS.has(kind)) {
        return false;
    }
    // Only auto-approve explicitly safe kinds
    return SAFE_KINDS.has(kind);
}

/**
 * Get the trust level display info
 */
export function getTrustLevelInfo(level: TrustLevel): { label: string; description: string; icon: string } {
    switch (level) {
        case 'paranoid':
            return {
                label: "I'm Paranoid",
                description: 'Every action requires manual approval',
                icon: '🔒',
            };
        case 'reasonable':
            return {
                label: "Let's Be Reasonable",
                description: 'Auto-approve common actions, ask for sensitive ones',
                icon: '⚖️',
            };
        case 'full':
            return {
                label: 'Full Trust',
                description: 'Auto-approve everything',
                icon: '🤝',
            };
    }
}

type SigningConditionQuery = {
    method: string;
    kind?: string | { in: string[] };
};

function extractKind(payload?: string | NostrEvent | NDKEvent): number | undefined {
    if (!payload) {
        return undefined;
    }

    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload);
            if (typeof parsed?.kind === 'number') {
                return parsed.kind;
            }
        } catch {
            return undefined;
        }
        return undefined;
    }

    if ('kind' in payload && typeof (payload as NostrEvent).kind === 'number') {
        return (payload as NostrEvent).kind;
    }

    if (typeof (payload as NDKEvent).rawEvent === 'function') {
        const raw = (payload as NDKEvent).rawEvent();
        if (raw && typeof raw.kind === 'number') {
            return raw.kind;
        }
    }

    return undefined;
}

function buildConditionQuery(
    method: RpcMethod,
    payload?: string | NostrEvent | NDKEvent
): SigningConditionQuery {
    if (method !== 'sign_event') {
        return { method };
    }

    const kind = extractKind(payload);
    const kinds = new Set<string>(['all']);
    if (typeof kind === 'number') {
        kinds.add(kind.toString());
    }

    return {
        method,
        kind: { in: Array.from(kinds) },
    };
}

/**
 * Check if a request should be auto-approved based on trust level.
 * This is called AFTER checking explicit SigningConditions.
 */
function shouldAutoApproveByTrustLevel(
    trustLevel: TrustLevel,
    method: RpcMethod,
    payload?: string | NDKEvent | NostrEvent
): boolean {
    // Paranoid: never auto-approve anything
    if (trustLevel === 'paranoid') {
        return false;
    }

    // Full trust: approve everything
    if (trustLevel === 'full') {
        return true;
    }

    // Reasonable: approve based on method and kind
    switch (method) {
        case 'connect':
            // Connect was already approved when trust level was set
            return true;
        case 'ping':
            // Ping is always safe
            return true;
        case 'encrypt':
        case 'decrypt':
            // NIP-04 encryption/decryption is sensitive (DMs)
            return false;
        case 'sign_event':
            const kind = extractKind(payload);
            if (kind === undefined) {
                // Unknown kind, require approval
                return false;
            }
            return isKindSafe(kind);
        default:
            return false;
    }
}

export async function isRequestPermitted(
    keyName: string,
    remotePubkey: string,
    method: RpcMethod,
    payload?: string | NDKEvent | NostrEvent
): Promise<boolean | undefined> {
    // Try to get cached keyUser info
    let cached = getCachedEntry(keyName, remotePubkey);
    let keyUserId: number;
    let trustLevel: TrustLevel;

    if (cached) {
        // Use cached data for quick checks
        if (cached.keyUser.revokedAt) {
            return false;
        }
        if (cached.hasExplicitDeny) {
            return false;
        }
        keyUserId = cached.keyUser.id;
        trustLevel = (cached.keyUser.trustLevel as TrustLevel) ?? 'reasonable';
    } else {
        // Fetch from database and cache
        const keyUser = await prisma.keyUser.findUnique({
            where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
            select: { id: true, revokedAt: true, trustLevel: true },
        });

        if (!keyUser) {
            return undefined;
        }

        // Check if user is revoked
        if (keyUser.revokedAt) {
            return false;
        }

        // Check for explicit deny
        const explicitDeny = await prisma.signingCondition.findFirst({
            where: {
                keyUserId: keyUser.id,
                method: '*',
                allowed: false,
            },
        });

        // Cache the result
        setCachedEntry(keyName, remotePubkey, {
            keyUser,
            hasExplicitDeny: !!explicitDeny,
        });

        if (explicitDeny) {
            return false;
        }

        keyUserId = keyUser.id;
        trustLevel = (keyUser.trustLevel as TrustLevel) ?? 'reasonable';
    }

    // Check for explicit permission condition (not cached - method/kind specific)
    const query = buildConditionQuery(method, payload);
    const condition = await prisma.signingCondition.findFirst({
        where: {
            keyUserId,
            ...query,
        },
    });

    if (condition) {
        if (condition.allowed === true || condition.allowed === false) {
            return condition.allowed;
        }
    }

    // No explicit condition - check trust level for auto-approval
    if (shouldAutoApproveByTrustLevel(trustLevel, method, payload)) {
        // Update lastUsedAt for tracking (fire and forget to avoid blocking)
        prisma.keyUser.update({
            where: { id: keyUserId },
            data: { lastUsedAt: new Date() },
        }).catch(() => {
            // Ignore errors on lastUsedAt update
        });
        return true;
    }

    // No decision - will trigger approval request
    return undefined;
}

export function scopeToCondition(method: RpcMethod | string, scope?: AllowScope): SigningConditionQuery {
    if (!scope || scope.kind === undefined) {
        return { method };
    }

    return {
        method,
        kind: scope.kind.toString(),
    };
}

export async function permitAllRequests(
    remotePubkey: string,
    keyName: string,
    method: RpcMethod | string,
    description?: string,
    scope?: AllowScope
): Promise<void> {
    const keyUser = await prisma.keyUser.upsert({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
        update: {},
        create: { keyName, userPubkey: remotePubkey, description },
    });

    // Determine kind string from scope
    const kindValue = scope?.kind !== undefined ? scope.kind.toString() : undefined;

    await prisma.signingCondition.create({
        data: {
            keyUserId: keyUser.id,
            allowed: true,
            method,
            kind: kindValue,
        },
    });

    // Invalidate cache since permissions changed
    invalidateAclCache(keyName, remotePubkey);
}

export async function blockAllRequests(remotePubkey: string, keyName: string): Promise<void> {
    const keyUser = await prisma.keyUser.upsert({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
        update: {},
        create: { keyName, userPubkey: remotePubkey },
    });

    await prisma.signingCondition.create({
        data: {
            keyUserId: keyUser.id,
            allowed: false,
            method: '*',
        },
    });

    // Invalidate cache since permissions changed
    invalidateAclCache(keyName, remotePubkey);
}

/**
 * Grant permissions to an app based on trust level.
 * This is called when approving a connect request.
 * @returns The keyUser id for the granted app
 */
export async function grantPermissionsByTrustLevel(
    remotePubkey: string,
    keyName: string,
    trustLevel: TrustLevel,
    description?: string
): Promise<number> {
    // Create or update KeyUser with trust level
    const keyUser = await prisma.keyUser.upsert({
        where: { unique_key_user: { keyName, userPubkey: remotePubkey } },
        update: { trustLevel, description: description ?? undefined },
        create: { keyName, userPubkey: remotePubkey, trustLevel, description },
    });

    // Always grant connect permission explicitly
    await prisma.signingCondition.create({
        data: {
            keyUserId: keyUser.id,
            allowed: true,
            method: 'connect',
        },
    });

    // For 'full' trust, also grant explicit permissions for encrypt/decrypt
    // (sign_event and ping will be auto-approved by trust level check)
    if (trustLevel === 'full') {
        await prisma.signingCondition.createMany({
            data: [
                { keyUserId: keyUser.id, allowed: true, method: 'encrypt' },
                { keyUserId: keyUser.id, allowed: true, method: 'decrypt' },
                { keyUserId: keyUser.id, allowed: true, method: 'sign_event', kind: 'all' },
            ],
        });
    }

    // Invalidate cache since permissions changed
    invalidateAclCache(keyName, remotePubkey);

    return keyUser.id;
}

/**
 * Update the trust level for an existing app.
 */
export async function updateTrustLevel(
    keyUserId: number,
    trustLevel: TrustLevel
): Promise<void> {
    const keyUser = await prisma.keyUser.update({
        where: { id: keyUserId },
        data: { trustLevel },
        select: { keyName: true, userPubkey: true },
    });

    // If upgrading to full trust, add encrypt/decrypt permissions
    if (trustLevel === 'full') {
        const existingEncrypt = await prisma.signingCondition.findFirst({
            where: { keyUserId, method: 'encrypt', allowed: true },
        });
        if (!existingEncrypt) {
            await prisma.signingCondition.createMany({
                data: [
                    { keyUserId, allowed: true, method: 'encrypt' },
                    { keyUserId, allowed: true, method: 'decrypt' },
                ],
            });
        }
    }

    // Invalidate cache since trust level changed
    invalidateAclCache(keyUser.keyName, keyUser.userPubkey);
}

/**
 * Get trust level for an app.
 */
export async function getTrustLevel(keyUserId: number): Promise<TrustLevel> {
    const keyUser = await prisma.keyUser.findUnique({
        where: { id: keyUserId },
        select: { trustLevel: true },
    });
    return (keyUser?.trustLevel as TrustLevel) ?? 'reasonable';
}
