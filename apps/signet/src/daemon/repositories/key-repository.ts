import prisma from '../../db.js';

export interface KeyStats {
    userCount: number;
    tokenCount: number;
    requestCount: number;
    lastUsedAt: Date | null;
}

export class KeyRepository {
    async getKeyStats(keyName: string): Promise<KeyStats> {
        // Get all keyUsers for this key to aggregate stats
        const keyUsers = await prisma.keyUser.findMany({
            where: { keyName, revokedAt: null },
            select: { id: true, lastUsedAt: true }
        });

        const keyUserIds = keyUsers.map(ku => ku.id);

        const [userCount, tokenCount, requestCount] = await Promise.all([
            Promise.resolve(keyUsers.length),
            prisma.token.count({ where: { keyName } }),
            keyUserIds.length > 0
                ? prisma.log.count({ where: { keyUserId: { in: keyUserIds } } })
                : Promise.resolve(0),
        ]);

        // Find the most recent lastUsedAt from all keyUsers
        const lastUsedAt = keyUsers.reduce<Date | null>((latest, ku) => {
            if (!ku.lastUsedAt) return latest;
            if (!latest) return ku.lastUsedAt;
            return ku.lastUsedAt > latest ? ku.lastUsedAt : latest;
        }, null);

        return { userCount, tokenCount, requestCount, lastUsedAt };
    }

    /**
     * Get stats for multiple keys in batch queries instead of N individual queries
     */
    async getKeyStatsBatch(keyNames: string[]): Promise<Map<string, KeyStats>> {
        if (keyNames.length === 0) {
            return new Map();
        }

        // Initialize results with zeros
        const result = new Map<string, KeyStats>();
        for (const keyName of keyNames) {
            result.set(keyName, {
                userCount: 0,
                tokenCount: 0,
                requestCount: 0,
                lastUsedAt: null,
            });
        }

        // Batch 1: Get keyUsers grouped by keyName (userCount + lastUsedAt)
        const keyUsers = await prisma.keyUser.findMany({
            where: { keyName: { in: keyNames }, revokedAt: null },
            select: { id: true, keyName: true, lastUsedAt: true },
        });

        // Build keyUser counts and track lastUsedAt per key
        const keyUserIdsByKey = new Map<string, number[]>();
        for (const ku of keyUsers) {
            const stats = result.get(ku.keyName);
            if (stats) {
                stats.userCount++;
                if (ku.lastUsedAt) {
                    if (!stats.lastUsedAt || ku.lastUsedAt > stats.lastUsedAt) {
                        stats.lastUsedAt = ku.lastUsedAt;
                    }
                }
            }
            const ids = keyUserIdsByKey.get(ku.keyName) ?? [];
            ids.push(ku.id);
            keyUserIdsByKey.set(ku.keyName, ids);
        }

        // Batch 2: Get token counts grouped by keyName
        const tokenCounts = await prisma.token.groupBy({
            by: ['keyName'],
            where: { keyName: { in: keyNames } },
            _count: { keyName: true },
        });

        for (const entry of tokenCounts) {
            const stats = result.get(entry.keyName);
            if (stats) {
                stats.tokenCount = entry._count.keyName;
            }
        }

        // Batch 3: Get log counts for all keyUserIds
        const allKeyUserIds = keyUsers.map((ku) => ku.id);
        if (allKeyUserIds.length > 0) {
            const logCounts = await prisma.log.groupBy({
                by: ['keyUserId'],
                where: { keyUserId: { in: allKeyUserIds } },
                _count: { keyUserId: true },
            });

            // Map log counts back to keys
            const logCountByKeyUserId = new Map<number, number>();
            for (const entry of logCounts) {
                if (entry.keyUserId !== null) {
                    logCountByKeyUserId.set(entry.keyUserId, entry._count.keyUserId);
                }
            }

            // Sum up log counts per key
            for (const [keyName, keyUserIds] of keyUserIdsByKey) {
                const stats = result.get(keyName);
                if (stats) {
                    for (const kuId of keyUserIds) {
                        stats.requestCount += logCountByKeyUserId.get(kuId) ?? 0;
                    }
                }
            }
        }

        return result;
    }

    async findKeyRecord(keyName: string) {
        return prisma.key.findUnique({ where: { keyName } });
    }

    async createKeyRecord(keyName: string, pubkey: string) {
        return prisma.key.create({
            data: { keyName, pubkey },
        });
    }

    /**
     * Rename a key across all database tables
     */
    async renameKey(oldName: string, newName: string): Promise<void> {
        await prisma.$transaction([
            // Update KeyUser records
            prisma.keyUser.updateMany({
                where: { keyName: oldName },
                data: { keyName: newName },
            }),
            // Update Request records
            prisma.request.updateMany({
                where: { keyName: oldName },
                data: { keyName: newName },
            }),
            // Update Token records
            prisma.token.updateMany({
                where: { keyName: oldName },
                data: { keyName: newName },
            }),
            // Update Key record if exists
            prisma.key.updateMany({
                where: { keyName: oldName },
                data: { keyName: newName },
            }),
        ]);
    }
}

export const keyRepository = new KeyRepository();
