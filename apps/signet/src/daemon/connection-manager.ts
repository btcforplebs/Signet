import 'websocket-polyfill';
import NDK, { NDKNostrRpc, NDKPrivateKeySigner, NDKUser } from '@nostr-dev-kit/ndk';
import createDebug from 'debug';
import fs from 'fs';
import path from 'path';
import type { ConnectionInfo } from '@signet/types';
import type { ConfigFile } from '../config/types.js';
import { loadConfig } from '../config/config.js';

const debug = createDebug('signet:connection');

export interface ConnectionManagerConfig {
    key: string;
    relays: string[];
    secret?: string;
}

/**
 * Manages connection information and NIP-46 RPC communication.
 * This is a minimal replacement for AdminInterface that only handles:
 * - Generating bunker connection URIs
 * - Providing RPC for auth_url responses to clients
 */
export class ConnectionManager {
    public readonly configFile: string;
    public rpc: NDKNostrRpc;

    private readonly ndk: NDK;
    private readonly secret?: string;
    private readonly relays: string[];
    private signerUser?: NDKUser;
    private connectionInfo?: ConnectionInfo;
    private readyResolver?: () => void;
    private readonly readyPromise: Promise<void>;

    constructor(config: ConnectionManagerConfig, configFile: string) {
        this.configFile = configFile;
        this.secret = config.secret;
        this.relays = config.relays;

        this.ndk = new NDK({
            explicitRelayUrls: config.relays,
            signer: new NDKPrivateKeySigner(config.key),
        });
        // Pass relay URLs so RPC creates its own connected pool for publishing
        this.rpc = new NDKNostrRpc(this.ndk, this.ndk.signer!, debug, config.relays);
        // NIP-46 spec requires NIP-44 encryption (NDK defaults to nip04)
        this.rpc.encryptionType = 'nip44';

        this.readyPromise = new Promise((resolve) => {
            this.readyResolver = resolve;
        });

        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Connect to relays so RPC responses can be sent
            await this.ndk.connect();

            this.signerUser = await this.ndk.signer?.user();
            if (!this.signerUser) {
                throw new Error('Unable to derive signer user');
            }

            this.writeConnectionStrings(this.signerUser);
        } catch (error) {
            console.log(`Failed to initialize connection manager: ${(error as Error).message}`);
            this.readyResolver?.();
            this.readyResolver = undefined;
        }
    }

    public async config(): Promise<ConfigFile> {
        return loadConfig(this.configFile);
    }

    public async waitUntilReady(): Promise<void> {
        if (this.connectionInfo) {
            return;
        }
        await this.readyPromise;
    }

    public getConnectionInfo(): ConnectionInfo | undefined {
        return this.connectionInfo;
    }

    /**
     * Ensure relay connections are active before sending.
     * Call this before using rpc.sendResponse() to handle disconnections.
     */
    public async ensureConnected(): Promise<void> {
        await this.ndk.pool.connect();
    }

    private writeConnectionStrings(user: NDKUser): void {
        const relays = this.resolveConnectionRelays();
        const secret = this.secret?.trim().toLowerCase() || undefined;

        const hexUri = this.buildBunkerUri(user.pubkey, relays, secret);
        const npubUri = this.buildBunkerUri(user.npub, relays, secret);

        console.log(`\nConnection URI (hex): ${hexUri}\n`);

        const folder = path.dirname(this.configFile);
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, 'connection.txt'), `${hexUri}\n`);

        this.connectionInfo = {
            npub: user.npub,
            pubkey: user.pubkey,
            npubUri,
            hexUri,
            relays,
            secret,
        };

        this.readyResolver?.();
        this.readyResolver = undefined;
    }

    private resolveConnectionRelays(): string[] {
        let relaySources: string[] = [];
        try {
            const rawConfig = fs.readFileSync(this.configFile, 'utf8');
            const parsed = JSON.parse(rawConfig);
            if (Array.isArray(parsed?.nostr?.relays)) {
                relaySources = parsed.nostr.relays as string[];
            }
        } catch {
            relaySources = [];
        }

        if (relaySources.length === 0) {
            relaySources = [...this.relays];
        }

        const normalised = relaySources
            .map((relay) => this.normaliseRelay(relay))
            .filter((relay): relay is string => Boolean(relay));

        return Array.from(new Set(normalised));
    }

    private normaliseRelay(relay: string): string | null {
        const trimmed = relay?.trim();
        if (!trimmed) {
            return null;
        }

        const withoutScheme = trimmed.replace(/^[a-z]+:\/\//i, '').replace(/^\/+/, '');
        if (!withoutScheme) {
            return null;
        }

        return `wss://${withoutScheme}`;
    }

    private buildBunkerUri(identifier: string, relays: string[], secret?: string): string {
        const fragments: string[] = [];

        for (const relay of relays) {
            const value = relay.trim();
            if (!value) {
                continue;
            }
            fragments.push(`relay=${encodeURIComponent(value)}`);
        }

        const query = fragments.length ? `?${fragments.join('&')}` : '';
        const secretFragment = secret ? `${query ? '&' : '?'}secret=${encodeURIComponent(secret)}` : '';
        return `bunker://${identifier}${query}${secretFragment}`;
    }
}
