import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../../db.js';

export function registerTokensRoutes(
    fastify: FastifyInstance,
    preHandler: { auth: any[]; csrf: any[]; rateLimit: any[] }
): void {
    // List all tokens (GET - no CSRF needed)
    fastify.get('/tokens', { preHandler: preHandler.auth }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { keyName } = request.query as { keyName?: string };

        const tokens = await prisma.token.findMany({
            where: keyName ? { keyName } : undefined,
            include: {
                policy: { include: { rules: true } },
                KeyUser: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const payload = tokens.map((token) => ({
            id: token.id,
            keyName: token.keyName,
            clientName: token.clientName,
            token: token.token,
            policyId: token.policyId,
            policyName: token.policy?.name,
            createdAt: token.createdAt.toISOString(),
            expiresAt: token.expiresAt?.toISOString() ?? null,
            redeemedAt: token.redeemedAt?.toISOString() ?? null,
            redeemedBy: token.KeyUser?.description ?? null,
        }));

        return reply.send({ tokens: payload });
    });

    // Create a new token (POST - needs CSRF)
    fastify.post('/tokens', { preHandler: [...preHandler.rateLimit, ...preHandler.auth, ...preHandler.csrf] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as {
            keyName?: string;
            clientName?: string;
            policyId?: number;
            expiresInHours?: number;
        };

        if (!body.keyName || !body.clientName || !body.policyId) {
            return reply.code(400).send({
                error: 'keyName, clientName, and policyId are required',
            });
        }

        const policy = await prisma.policy.findUnique({
            where: { id: body.policyId },
        });

        if (!policy) {
            return reply.code(404).send({ error: 'Policy not found' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = body.expiresInHours
            ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
            : undefined;

        const created = await prisma.token.create({
            data: {
                keyName: body.keyName,
                clientName: body.clientName,
                createdBy: 'web-admin',
                token,
                policyId: policy.id,
                expiresAt,
            },
        });

        return reply.send({
            ok: true,
            token: {
                id: created.id,
                token: created.token,
                expiresAt: created.expiresAt?.toISOString() ?? null,
            },
        });
    });

    // Delete a token (DELETE - needs CSRF)
    fastify.delete('/tokens/:id', { preHandler: [...preHandler.auth, ...preHandler.csrf] }, async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        try {
            await prisma.token.delete({
                where: { id: parseInt(id, 10) },
            });
            return reply.send({ ok: true });
        } catch (error) {
            return reply.code(404).send({ error: 'Token not found' });
        }
    });
}
