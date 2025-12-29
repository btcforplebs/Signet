import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent, NDKRelay } from '@nostr-dev-kit/ndk';

/**
 * Logs NIP-46 response publishing for debugging.
 * Hooks into NDK's event publishing to track success/failure.
 */
export class PublishLogger {
    private readonly ndk: NDK;
    private enabled = false;

    // Track publish stats
    private stats = {
        totalPublished: 0,
        totalFailed: 0,
        byRelay: new Map<string, { published: number; failed: number }>(),
    };

    constructor(ndk: NDK) {
        this.ndk = ndk;
    }

    /**
     * Start logging publish events
     */
    public start(): void {
        if (this.enabled) {
            return;
        }

        this.enabled = true;
        this.setupListeners();
        console.log('📝 Publish logging enabled');
    }

    /**
     * Stop logging publish events
     */
    public stop(): void {
        this.enabled = false;
        console.log('📝 Publish logging disabled');
    }

    /**
     * Get publish statistics
     */
    public getStats(): typeof this.stats {
        return {
            ...this.stats,
            byRelay: new Map(this.stats.byRelay),
        };
    }

    /**
     * Reset statistics
     */
    public resetStats(): void {
        this.stats = {
            totalPublished: 0,
            totalFailed: 0,
            byRelay: new Map(),
        };
    }

    private setupListeners(): void {
        // Listen to relay-level events
        console.log(`📝 Attaching publish listeners to ${this.ndk.pool.relays.size} relays`);
        for (const [url, relay] of this.ndk.pool.relays) {
            this.attachRelayListeners(relay);
        }

        // Also listen for new relays being added
        this.ndk.pool.on('relay:connect', (relay: NDKRelay) => {
            console.log(`📝 New relay connected, attaching listeners: ${relay.url}`);
            this.attachRelayListeners(relay);
        });
    }

    private attachRelayListeners(relay: NDKRelay): void {
        const url = relay.url;

        // Initialize stats for this relay
        if (!this.stats.byRelay.has(url)) {
            this.stats.byRelay.set(url, { published: 0, failed: 0 });
        }

        relay.on('published', (event: NDKEvent) => {
            if (!this.enabled) return;

            this.stats.totalPublished++;
            const relayStat = this.stats.byRelay.get(url);
            if (relayStat) {
                relayStat.published++;
            }

            // Log all published events for debugging
            console.log(`📤 Published kind ${event.kind} to ${url} (id: ${event.id?.slice(0, 8)}...)`);
        });

        relay.on('publish:failed', (event: NDKEvent, error: Error) => {
            if (!this.enabled) return;

            this.stats.totalFailed++;
            const relayStat = this.stats.byRelay.get(url);
            if (relayStat) {
                relayStat.failed++;
            }

            // Log all failed events for debugging
            console.log(`❌ FAILED kind ${event.kind} to ${url}: ${error.message} (id: ${event.id?.slice(0, 8)}...)`);
        });
    }

    /**
     * Print a summary of publish stats
     */
    public printSummary(): void {
        console.log('\n📊 Publish Statistics:');
        console.log(`   Total published: ${this.stats.totalPublished}`);
        console.log(`   Total failed: ${this.stats.totalFailed}`);
        console.log('   By relay:');
        for (const [url, stat] of this.stats.byRelay) {
            console.log(`     ${url}: ${stat.published} published, ${stat.failed} failed`);
        }
        console.log('');
    }
}
