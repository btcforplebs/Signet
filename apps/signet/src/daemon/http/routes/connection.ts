import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RelayStatusResponse } from '@signet/types';
import type { ConnectionManager } from '../../connection-manager.js';
import type { RelayService } from '../../services/index.js';
import type { NostrConfig } from '../../../config/types.js';

export interface ConnectionRouteConfig {
    connectionManager: ConnectionManager;
    nostrConfig: NostrConfig;
    relayService: RelayService;
}

export function registerConnectionRoutes(
    fastify: FastifyInstance,
    config: ConnectionRouteConfig,
    preHandler: any[]
): void {
    fastify.get('/connection', { preHandler }, async (_request: FastifyRequest, reply: FastifyReply) => {
        await config.connectionManager.waitUntilReady();
        const info = config.connectionManager.getConnectionInfo();

        if (!info) {
            return reply.code(503).send({ error: 'connection info unavailable' });
        }

        return reply.send({
            npub: info.npub,
            pubkey: info.pubkey,
            npubUri: info.npubUri,
            hexUri: info.hexUri,
            relays: info.relays,
            nostrRelays: config.nostrConfig.relays,
        });
    });

    fastify.get('/relays', { preHandler }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const statuses = config.relayService.getStatus();
        const connected = config.relayService.getConnectedCount();

        const response: RelayStatusResponse = {
            connected,
            total: statuses.length,
            relays: statuses.map(s => ({
                url: s.url,
                connected: s.connected,
                lastConnected: s.lastConnected?.toISOString() ?? null,
                lastDisconnected: s.lastDisconnected?.toISOString() ?? null,
            })),
        };

        return reply.send(response);
    });
}
