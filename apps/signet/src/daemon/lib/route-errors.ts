import type { FastifyReply } from 'fastify';

/**
 * Error message to HTTP status code mappings for common application errors.
 */
const errorStatusMap: Array<{ pattern: RegExp | string; status: number }> = [
    // 400 Bad Request
    { pattern: 'Invalid', status: 400 },
    { pattern: 'required', status: 400 },
    { pattern: 'not a valid', status: 400 },
    { pattern: 'Passphrase required', status: 400 },
    { pattern: 'Nothing to update', status: 400 },
    // 404 Not Found
    { pattern: 'not found', status: 404 },
    { pattern: 'Not found', status: 404 },
    // 409 Conflict
    { pattern: 'already exists', status: 409 },
];

/**
 * Get the appropriate HTTP status code for an error message.
 * Returns 500 if no specific pattern matches.
 */
export function getErrorStatus(message: string): number {
    for (const { pattern, status } of errorStatusMap) {
        if (typeof pattern === 'string') {
            if (message.includes(pattern)) {
                return status;
            }
        } else if (pattern.test(message)) {
            return status;
        }
    }
    return 500;
}

/**
 * Send an error response with the appropriate status code.
 * Uses getErrorStatus to determine the status code from the error message.
 */
export function sendError(reply: FastifyReply, error: unknown): FastifyReply {
    const message = error instanceof Error ? error.message : String(error);
    const status = getErrorStatus(message);
    return reply.code(status).send({ error: message });
}

/**
 * Higher-order function to wrap a route handler with error handling.
 * Automatically catches errors and sends appropriate responses.
 */
export function withErrorHandler<T>(
    handler: (request: any, reply: FastifyReply) => Promise<T>
): (request: any, reply: FastifyReply) => Promise<T | FastifyReply> {
    return async (request, reply) => {
        try {
            return await handler(request, reply);
        } catch (error) {
            const status = getErrorStatus((error as Error).message);
            if (status === 500) {
                console.error('Unhandled route error:', error);
            }
            return sendError(reply, error);
        }
    };
}
