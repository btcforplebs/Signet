import crypto from 'crypto';
import { finalizeEvent, verifyEvent, getPublicKey, type Event } from 'nostr-tools/pure';
import { npubEncode } from 'nostr-tools/nip19';
import { encrypt as nip44Encrypt, decrypt as nip44Decrypt, getConversationKey } from 'nostr-tools/nip44';
import createDebug from 'debug';
import prisma from '../db.js';
import { getEventService } from './services/event-service.js';
import { appService } from './services/app-service.js';
import type { RelayPool } from './lib/relay-pool.js';
import type { SubscriptionManager } from './lib/subscription-manager.js';

const debug = createDebug('signet:nip46');

// Default trust level for auto-approved connections via secret
const DEFAULT_TRUST_LEVEL = 'reasonable';

type Nip46Method =
    | 'connect'
    | 'sign_event'
    | 'get_public_key'
    | 'nip04_encrypt' | 'nip04_decrypt'
    | 'nip44_encrypt' | 'nip44_decrypt'
    | 'ping';

interface Nip46Request {
    id: string;
    method: Nip46Method;
    params: string[];
}

interface Nip46Response {
    id: string;
    result?: string;
    error?: string;
}

export interface PermitCallbackParams {
    id: string;
    method: Nip46Method;
    pubkey: string;
    params?: string[];
}

export type PermitCallback = (params: PermitCallbackParams) => Promise<boolean>;

export interface Nip46BackendConfig {
    keyName: string;
    nsec: Uint8Array;          // 32-byte secret key
    pool: RelayPool;
    subscriptionManager?: SubscriptionManager;
    permitCallback: PermitCallback;
    adminSecret?: string;
}

/**
 * NIP-46 Remote Signer Backend using nostr-tools.
 * Handles incoming signing requests and responds via Nostr relays.
 */
export class Nip46Backend {
    public readonly keyName: string;
    public readonly pubkey: string;

    private readonly nsec: Uint8Array;
    private readonly pool: RelayPool;
    private readonly subscriptionManager?: SubscriptionManager;
    private readonly permitCallback: PermitCallback;
    private readonly adminSecret?: string;

    private unsubscribe?: () => void;
    private isRunning = false;

    constructor(config: Nip46BackendConfig) {
        this.keyName = config.keyName;
        this.nsec = config.nsec;
        this.pubkey = getPublicKey(this.nsec);
        this.pool = config.pool;
        this.subscriptionManager = config.subscriptionManager;
        this.permitCallback = config.permitCallback;
        this.adminSecret = config.adminSecret;
    }

    /**
     * Start listening for NIP-46 requests.
     */
    public start(): void {
        if (this.isRunning) {
            console.log(`[${this.keyName}] Backend already running, ignoring duplicate start()`);
            return;
        }

        const npub = npubEncode(this.pubkey);
        console.log(`[${this.keyName}] Starting NIP-46 backend for ${npub}`);

        const subscriptionId = `nip46-${this.keyName}`;
        const filter = {
            kinds: [24133],
            '#p': [this.pubkey],
        };
        const onEvent = (event: Event) => {
            this.handleEvent(event).catch((err) => {
                console.error(`[${this.keyName}] Error handling event:`, err);
            });
        };

        // Use SubscriptionManager if available (provides auto-reconnect after sleep)
        // Otherwise fall back to direct pool subscription
        if (this.subscriptionManager) {
            this.unsubscribe = this.subscriptionManager.subscribe(subscriptionId, filter, onEvent);
            debug('[%s] using managed subscription', this.keyName);
        } else {
            this.unsubscribe = this.pool.subscribe(filter, onEvent, subscriptionId);
            debug('[%s] using direct pool subscription', this.keyName);
        }

        this.isRunning = true;
        console.log(`[${this.keyName}] NIP-46 subscription active`);
    }

    /**
     * Stop the backend.
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        console.log(`[${this.keyName}] Stopping NIP-46 backend`);
        this.unsubscribe?.();
        this.isRunning = false;
    }

    /**
     * Handle an incoming NIP-46 request event.
     */
    private async handleEvent(event: Event): Promise<void> {
        // Verify signature
        if (!verifyEvent(event)) {
            debug('[%s] invalid signature, ignoring', this.keyName);
            return;
        }

        // Decrypt and parse request
        const request = this.decryptRequest(event);
        if (!request) {
            return;
        }

        const { id, method, params } = request;
        const remotePubkey = event.pubkey;

        const humanPubkey = npubEncode(remotePubkey);
        debug('[%s] request %s: %s from %s', this.keyName, id, method, humanPubkey);
        console.log(`[${this.keyName}] Request ${id}: ${method} from ${humanPubkey}`);

        try {
            const result = await this.handleMethod(id, method, params, remotePubkey);

            if (result !== undefined) {
                await this.sendResponse(id, remotePubkey, result);
            } else {
                await this.sendError(id, remotePubkey, 'Not authorized');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[${this.keyName}] Error handling ${method}:`, message);
            await this.sendError(id, remotePubkey, message);
        }
    }

    /**
     * Decrypt an incoming NIP-46 request.
     */
    private decryptRequest(event: Event): Nip46Request | null {
        try {
            const conversationKey = getConversationKey(this.nsec, event.pubkey);
            const decrypted = nip44Decrypt(event.content, conversationKey);
            return JSON.parse(decrypted) as Nip46Request;
        } catch (err) {
            debug('[%s] failed to decrypt request: %s', this.keyName, err);
            return null;
        }
    }

    /**
     * Route request to appropriate handler.
     */
    private async handleMethod(
        id: string,
        method: Nip46Method,
        params: string[],
        remotePubkey: string
    ): Promise<string | undefined> {
        // Special handling for connect with secret
        if (method === 'connect') {
            return this.handleConnect(id, params, remotePubkey);
        }

        // Check permissions via callback
        const permitted = await this.permitCallback({
            id,
            method,
            pubkey: remotePubkey,
            params,
        });

        if (!permitted) {
            return undefined; // Will send "Not authorized"
        }

        // Dispatch to method handlers
        switch (method) {
            case 'get_public_key':
                return this.pubkey;

            case 'sign_event':
                return this.handleSignEvent(params);

            case 'nip44_encrypt':
                return this.handleNip44Encrypt(params);

            case 'nip44_decrypt':
                return this.handleNip44Decrypt(params);

            case 'nip04_encrypt':
            case 'nip04_decrypt':
                throw new Error('NIP-04 encryption is deprecated, use NIP-44');

            case 'ping':
                return 'pong';

            default:
                throw new Error(`Unsupported method: ${method}`);
        }
    }

    /**
     * Handle connect request, with optional secret-based auto-approval.
     */
    private async handleConnect(
        id: string,
        params: string[],
        remotePubkey: string
    ): Promise<string | undefined> {
        const providedSecret = params[1]?.trim().toLowerCase();
        const expectedSecret = this.adminSecret?.trim().toLowerCase();
        const humanPubkey = npubEncode(remotePubkey);

        // If no admin secret configured, fall through to normal flow
        if (!expectedSecret) {
            debug('[%s] no admin secret configured, using normal connect flow', this.keyName);
            const permitted = await this.permitCallback({
                id,
                method: 'connect',
                pubkey: remotePubkey,
                params,
            });
            return permitted ? 'ack' : undefined;
        }

        // If no secret provided in request, fall through to normal flow (manual approval)
        if (!providedSecret) {
            console.log(`[${this.keyName}] Connect from ${humanPubkey} without secret, requiring manual approval`);
            const permitted = await this.permitCallback({
                id,
                method: 'connect',
                pubkey: remotePubkey,
                params,
            });
            return permitted ? 'ack' : undefined;
        }

        // Validate the secret - silently drop invalid attempts (no response)
        // Use timing-safe comparison to prevent timing attacks
        const secretsMatch = providedSecret.length === expectedSecret.length &&
            crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret));
        if (!secretsMatch) {
            debug('[%s] connect with invalid secret from %s', this.keyName, humanPubkey);
            return undefined; // Silent rejection - no response sent
        }

        // Secret matches - auto-approve and create KeyUser
        console.log(`[${this.keyName}] Connect from ${humanPubkey} with valid secret - auto-approving`);

        try {
            await this.createKeyUserForConnect(remotePubkey);
            return 'ack';
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[${this.keyName}] Failed to create KeyUser: ${errorMessage}`);
            throw e;
        }
    }

    /**
     * Create or update KeyUser for an auto-approved connection.
     */
    private async createKeyUserForConnect(remotePubkey: string): Promise<void> {
        const keyUser = await prisma.keyUser.upsert({
            where: {
                unique_key_user: {
                    keyName: this.keyName,
                    userPubkey: remotePubkey,
                },
            },
            update: {
                lastUsedAt: new Date(),
            },
            create: {
                keyName: this.keyName,
                userPubkey: remotePubkey,
                trustLevel: DEFAULT_TRUST_LEVEL,
                description: 'Auto-approved via bunker secret',
            },
        });

        // Create connect signing condition if not exists
        const existingCondition = await prisma.signingCondition.findFirst({
            where: {
                keyUserId: keyUser.id,
                method: 'connect',
            },
        });

        if (!existingCondition) {
            await prisma.signingCondition.create({
                data: {
                    keyUserId: keyUser.id,
                    method: 'connect',
                    allowed: true,
                },
            });
        }

        console.log(`[${this.keyName}] KeyUser created/updated for ${npubEncode(remotePubkey)} with trust level: ${keyUser.trustLevel}`);

        // Emit app:connected event for real-time updates
        const app = await appService.getAppById(keyUser.id);
        if (app) {
            getEventService().emitAppConnected(app);
        }
    }

    /**
     * Sign an event.
     */
    private handleSignEvent(params: string[]): string {
        const eventJson = params[0];
        if (!eventJson) {
            throw new Error('Missing event to sign');
        }

        const unsigned = JSON.parse(eventJson);
        const signed = finalizeEvent(unsigned, this.nsec);
        return JSON.stringify(signed);
    }

    /**
     * NIP-44 encrypt for third party.
     */
    private handleNip44Encrypt(params: string[]): string {
        const [thirdPartyPubkey, plaintext] = params;
        if (!thirdPartyPubkey || !plaintext) {
            throw new Error('Missing parameters for nip44_encrypt');
        }
        const conversationKey = getConversationKey(this.nsec, thirdPartyPubkey);
        return nip44Encrypt(plaintext, conversationKey);
    }

    /**
     * NIP-44 decrypt from third party.
     */
    private handleNip44Decrypt(params: string[]): string {
        const [thirdPartyPubkey, ciphertext] = params;
        if (!thirdPartyPubkey || !ciphertext) {
            throw new Error('Missing parameters for nip44_decrypt');
        }
        const conversationKey = getConversationKey(this.nsec, thirdPartyPubkey);
        return nip44Decrypt(ciphertext, conversationKey);
    }

    /**
     * Send a success response.
     */
    private async sendResponse(id: string, remotePubkey: string, result: string): Promise<void> {
        const response: Nip46Response = { id, result };
        await this.sendEncryptedResponse(remotePubkey, response);
    }

    /**
     * Send an error response.
     */
    private async sendError(id: string, remotePubkey: string, error: string): Promise<void> {
        const response: Nip46Response = { id, result: 'error', error };
        await this.sendEncryptedResponse(remotePubkey, response);
    }

    /**
     * Encrypt and publish a response.
     */
    private async sendEncryptedResponse(remotePubkey: string, response: Nip46Response): Promise<void> {
        // Encrypt with NIP-44
        const conversationKey = getConversationKey(this.nsec, remotePubkey);
        const encrypted = nip44Encrypt(JSON.stringify(response), conversationKey);

        // Create and sign event
        const event = finalizeEvent({
            kind: 24133,
            content: encrypted,
            tags: [['p', remotePubkey]],
            created_at: Math.floor(Date.now() / 1000),
        }, this.nsec);

        // Publish
        debug('[%s] sending response %s to %s', this.keyName, response.id, npubEncode(remotePubkey));
        await this.pool.publish(event);
    }

    /**
     * Apply a token to grant permissions to a remote pubkey.
     * This is used for token-based authorization flow.
     *
     * Uses atomic token claiming to prevent race conditions where
     * two requests could redeem the same token simultaneously.
     */
    public async applyToken(remotePubkey: string, token: string): Promise<void> {
        // Validate token exists and get its data
        const record = await this.fetchTokenRecord(token);

        // Atomically claim the token - only succeeds if redeemedAt is still null
        // This prevents race conditions where two requests pass validation simultaneously
        const claimed = await prisma.token.updateMany({
            where: {
                id: record.id,
                redeemedAt: null, // Only claim if not already redeemed
            },
            data: {
                redeemedAt: new Date(),
            },
        });

        if (claimed.count === 0) {
            throw new Error('Token already redeemed');
        }

        // Token successfully claimed - now create permissions
        try {
            const keyUser = await prisma.keyUser.upsert({
                where: { unique_key_user: { keyName: record.keyName, userPubkey: remotePubkey } },
                update: {},
                create: {
                    keyName: record.keyName,
                    userPubkey: remotePubkey,
                    description: record.clientName,
                },
            });

            // Link token to keyUser
            await prisma.token.update({
                where: { id: record.id },
                data: { keyUserId: keyUser.id },
            });

            await prisma.signingCondition.create({
                data: {
                    keyUserId: keyUser.id,
                    method: 'connect',
                    allowed: true,
                },
            });

            for (const rule of record.policy!.rules) {
                await prisma.signingCondition.create({
                    data: {
                        keyUserId: keyUser.id,
                        method: rule.method,
                        allowed: true,
                        kind: rule.kind !== null && rule.kind !== undefined ? rule.kind.toString() : undefined,
                    },
                });
            }
        } catch (error) {
            // If permission creation fails, unclaim the token so it can be retried
            await prisma.token.update({
                where: { id: record.id },
                data: { redeemedAt: null, keyUserId: null },
            });
            throw error;
        }
    }

    /**
     * Fetch and validate a token record.
     * Does NOT check redeemedAt - that's handled atomically in applyToken.
     */
    private async fetchTokenRecord(token: string) {
        const record = await prisma.token.findUnique({
            where: { token },
            include: { policy: { include: { rules: true } } },
        });

        if (!record) {
            throw new Error('Token not found');
        }

        if (record.redeemedAt) {
            throw new Error('Token already redeemed');
        }

        if (!record.policy) {
            throw new Error('Token policy missing');
        }

        if (record.expiresAt && record.expiresAt < new Date()) {
            throw new Error('Token expired');
        }

        return record;
    }
}
