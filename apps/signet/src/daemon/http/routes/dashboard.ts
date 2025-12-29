import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DashboardService } from '../../services/index.js';

export interface DashboardRouteConfig {
    dashboardService: DashboardService;
}

export function registerDashboardRoutes(
    fastify: FastifyInstance,
    config: DashboardRouteConfig,
    preHandler: any[]
): void {
    fastify.get('/dashboard', { preHandler }, async (_request: FastifyRequest, reply: FastifyReply) => {
        const data = await config.dashboardService.getDashboardData();
        return reply.send(data);
    });
}
