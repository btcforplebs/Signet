import type NDK from '@nostr-dev-kit/ndk';
import type { NDKRelay } from '@nostr-dev-kit/ndk';
import {
    HEALTH_CHECK_INTERVAL_MS,
    RECONNECT_INITIAL_DELAY_MS,
    RECONNECT_MAX_DELAY_MS,
    RECONNECT_MULTIPLIER,
} from '../constants.js';

// NDK relay status codes
const NDK_STATUS = {
    DISCONNECTED: 1,
    RECONNECTING: 2,
    FLAPPING: 3,
    CONNECTING: 4,
    CONNECTED: 5,
    AUTHENTICATED: 8,
} as const;

interface RelayStatus {
    url: string;
    connected: boolean;
    lastConnected: Date | null;
    lastDisconnected: Date | null;
    reconnectAttempts: number;
}

/**
 * Monitors relay health and ensures connections stay alive.
 * This helps prevent failed NIP-46 response delivery due to relay disconnections.
 */
export class RelayService {
    private readonly ndk: NDK;
    private readonly relayStatus: Map<string, RelayStatus> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(ndk: NDK) {
        this.ndk = ndk;
    }

    /**
     * Start monitoring relay health
     */
    public start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.setupEventListeners();
        this.initializeRelayStatus();
        this.startHealthCheck();

        console.log('📡 Relay health monitoring started');
    }

    /**
     * Stop monitoring relay health
     */
    public stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        console.log('📡 Relay health monitoring stopped');
    }

    /**
     * Get current status of all relays
     */
    public getStatus(): RelayStatus[] {
        return Array.from(this.relayStatus.values());
    }

    /**
     * Get count of connected relays
     */
    public getConnectedCount(): number {
        let count = 0;
        for (const status of this.relayStatus.values()) {
            if (status.connected) {
                count++;
            }
        }
        return count;
    }

    /**
     * Check if any relay is connected
     */
    public hasConnectedRelay(): boolean {
        return this.getConnectedCount() > 0;
    }

    /**
     * Force reconnect all disconnected relays
     */
    public async reconnectAll(): Promise<void> {
        const disconnected = Array.from(this.relayStatus.entries())
            .filter(([_, status]) => !status.connected)
            .map(([url]) => url);

        if (disconnected.length === 0) {
            return;
        }

        console.log(`📡 Reconnecting ${disconnected.length} relay(s)...`);

        for (const url of disconnected) {
            await this.reconnectRelay(url);
        }
    }

    private setupEventListeners(): void {
        this.ndk.pool.on('relay:connect', (relay: NDKRelay) => {
            this.updateRelayStatus(relay.url, true);
            console.log(`✅ Connected to ${relay.url}`);
        });

        this.ndk.pool.on('relay:disconnect', (relay: NDKRelay) => {
            this.updateRelayStatus(relay.url, false);
            console.log(`🚫 Disconnected from ${relay.url}`);

            // Schedule reconnection attempt with exponential backoff
            if (this.isRunning) {
                const delay = this.getReconnectDelay(relay.url);
                console.log(`📡 Scheduling reconnect to ${relay.url} in ${delay / 1000}s`);
                setTimeout(() => {
                    this.reconnectRelay(relay.url).catch((err) => {
                        console.log(`❌ Failed to reconnect to ${relay.url}: ${err.message}`);
                    });
                }, delay);
            }
        });
    }

    /**
     * Calculate reconnect delay using exponential backoff based on attempt count
     */
    private getReconnectDelay(url: string): number {
        const status = this.relayStatus.get(url);
        const attempts = status?.reconnectAttempts ?? 0;
        const delay = RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_MULTIPLIER, attempts);
        return Math.min(delay, RECONNECT_MAX_DELAY_MS);
    }

    private initializeRelayStatus(): void {
        // Get configured relays from NDK
        const relays = this.ndk.pool.relays;

        for (const [url, relay] of relays) {
            const isConnected = relay.status >= NDK_STATUS.CONNECTED;
            this.relayStatus.set(url, {
                url,
                connected: isConnected,
                lastConnected: isConnected ? new Date() : null,
                lastDisconnected: null,
                reconnectAttempts: 0,
            });
        }
    }

    private updateRelayStatus(url: string, connected: boolean): void {
        const existing = this.relayStatus.get(url);
        const now = new Date();

        this.relayStatus.set(url, {
            url,
            connected,
            lastConnected: connected ? now : (existing?.lastConnected ?? null),
            lastDisconnected: connected ? (existing?.lastDisconnected ?? null) : now,
            reconnectAttempts: connected ? 0 : (existing?.reconnectAttempts ?? 0),
        });
    }

    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, HEALTH_CHECK_INTERVAL_MS);
    }

    private performHealthCheck(): void {
        const disconnected: string[] = [];
        const connected: string[] = [];

        for (const [url, relay] of this.ndk.pool.relays) {
            const isConnected = relay.status >= NDK_STATUS.CONNECTED;
            const status = this.relayStatus.get(url);

            // Update status if it changed
            if (status && status.connected !== isConnected) {
                this.updateRelayStatus(url, isConnected);
            }

            if (isConnected) {
                connected.push(url);
            } else {
                disconnected.push(url);
            }
        }

        // Log status if there are disconnected relays
        if (disconnected.length > 0) {
            console.log(`📡 Relay status: ${connected.length} connected, ${disconnected.length} disconnected`);

            // Try to reconnect disconnected relays
            for (const url of disconnected) {
                this.reconnectRelay(url).catch((err) => {
                    console.log(`❌ Health check reconnect failed for ${url}: ${err.message}`);
                });
            }
        }
    }

    private async reconnectRelay(url: string): Promise<void> {
        const status = this.relayStatus.get(url);
        if (status) {
            status.reconnectAttempts++;
            this.relayStatus.set(url, status);
        }

        const relay = this.ndk.pool.relays.get(url);
        if (!relay) {
            return;
        }

        if (relay.status >= NDK_STATUS.CONNECTED) {
            // Already connected
            return;
        }

        try {
            await relay.connect();
        } catch (err) {
            // Connection failed, will retry on next health check
            throw err;
        }
    }
}
