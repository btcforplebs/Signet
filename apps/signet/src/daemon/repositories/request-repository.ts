import prisma from '../../db.js';

export type RequestStatus = 'pending' | 'approved' | 'expired';

export interface RequestQueryOptions {
    status: RequestStatus;
    limit: number;
    offset: number;
}

export interface RequestRecord {
    id: string;
    keyName: string | null;
    method: string;
    remotePubkey: string;
    params: string | null;
    allowed: boolean | null;
    createdAt: Date;
    processedAt: Date | null;
}

export class RequestRepository {
    private readonly REQUEST_TTL_MS = 60_000;

    async findById(id: string): Promise<RequestRecord | null> {
        return prisma.request.findUnique({ where: { id } });
    }

    async findPending(id: string): Promise<RequestRecord | null> {
        const record = await prisma.request.findUnique({ where: { id } });
        if (!record || record.allowed !== null) {
            return null;
        }
        return record;
    }

    async findMany(options: RequestQueryOptions): Promise<RequestRecord[]> {
        const now = new Date();
        const expiryThreshold = new Date(now.getTime() - this.REQUEST_TTL_MS);

        let where: any;
        if (options.status === 'approved') {
            where = { allowed: true };
        } else if (options.status === 'expired') {
            where = {
                allowed: null,
                createdAt: { lt: expiryThreshold },
            };
        } else {
            // pending
            where = {
                allowed: null,
                createdAt: { gte: expiryThreshold },
            };
        }

        return prisma.request.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: options.offset,
            take: options.limit,
        });
    }

    async countPending(): Promise<number> {
        return prisma.request.count({ where: { allowed: null } });
    }

    async approve(id: string): Promise<void> {
        await prisma.request.update({
            where: { id },
            data: {
                allowed: true,
                processedAt: new Date(),
            },
        });
    }

    async deny(id: string): Promise<void> {
        await prisma.request.update({
            where: { id },
            data: {
                allowed: false,
                processedAt: new Date(),
            },
        });
    }

    async create(data: {
        id: string;
        requestId: string;
        keyName: string;
        method: string;
        remotePubkey: string;
        params?: string;
    }): Promise<RequestRecord> {
        return prisma.request.create({ data });
    }

    async cleanupExpired(maxAge: Date): Promise<number> {
        const result = await prisma.request.deleteMany({
            where: {
                allowed: null,
                createdAt: { lt: maxAge },
            },
        });
        return result.count;
    }
}

export const requestRepository = new RequestRepository();
