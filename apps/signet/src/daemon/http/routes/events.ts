import createDebug from 'debug';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { EventService, ServerEvent } from '../../services/event-service.js';

const debug = createDebug('signet:sse');

export interface EventsRouteConfig {
    eventService: EventService;
}

/**
 * Register SSE (Server-Sent Events) routes for real-time updates
 */
export function registerEventsRoutes(
    fastify: FastifyInstance,
    config: EventsRouteConfig,
    preHandler: any[]
): void {
    /**
     * SSE endpoint for real-time events
     * GET /events
     *
     * Streams server-sent events to connected clients.
     * Sends keep-alive pings every 30 seconds.
     */
    fastify.get('/events', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
        debug('SSE client connecting, current subscribers: %d', config.eventService.getSubscriberCount());

        // Set SSE headers
        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        });

        // Send initial connection event
        reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

        // Event callback to send events to client
        const eventCallback = (event: ServerEvent) => {
            try {
                debug('Sending SSE event: %s', event.type);
                reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
            } catch (error) {
                debug('Error sending SSE event: %o', error);
            }
        };

        // Subscribe to events
        const unsubscribe = config.eventService.subscribe(eventCallback);
        debug('SSE client subscribed, total subscribers: %d', config.eventService.getSubscriberCount());

        // Keep-alive ping every 30 seconds
        const keepAliveInterval = setInterval(() => {
            try {
                reply.raw.write(': keep-alive\n\n');
            } catch (error) {
                // Connection may be closed
            }
        }, 30000);

        // Cleanup on client disconnect
        request.raw.on('close', () => {
            debug('SSE client disconnected');
            clearInterval(keepAliveInterval);
            unsubscribe();
            debug('Remaining subscribers: %d', config.eventService.getSubscriberCount());
        });

        // Don't return anything - keep the connection open
        await new Promise(() => {});
    });

    /**
     * Get current subscriber count (useful for debugging)
     * GET /events/status
     */
    fastify.get('/events/status', { preHandler }, async (_request: FastifyRequest, reply: FastifyReply) => {
        return reply.send({
            subscribers: config.eventService.getSubscriberCount(),
        });
    });
}
