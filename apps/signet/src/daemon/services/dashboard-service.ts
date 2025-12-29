import type { DashboardStats, ActivityEntry } from '@signet/types';
import type { StoredKey } from '../../config/types.js';
import { appRepository, logRepository, requestRepository } from '../repositories/index.js';

export interface DashboardServiceConfig {
    allKeys: Record<string, StoredKey>;
    getActiveKeyCount: () => number;
}

export interface DashboardData {
    stats: DashboardStats;
    activity: ActivityEntry[];
    hourlyActivity: Array<{ hour: number; type: string; count: number }>;
}

export class DashboardService {
    private readonly config: DashboardServiceConfig;

    constructor(config: DashboardServiceConfig) {
        this.config = config;
    }

    async getDashboardData(): Promise<DashboardData> {
        const totalKeys = Object.keys(this.config.allKeys).length;
        const activeKeys = this.config.getActiveKeyCount();

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Run all independent queries in parallel (5 queries -> 1 round trip)
        const [
            connectedApps,
            pendingRequests,
            recentActivity24h,
            hourlyActivity,
            recentLogs,
        ] = await Promise.all([
            appRepository.countActive(),
            requestRepository.countPending(),
            logRepository.countSince(yesterday),
            logRepository.getHourlyActivityRaw(),
            logRepository.findRecent(5),
        ]);

        const activity = recentLogs.map(log => logRepository.toActivityEntry(log));

        return {
            stats: {
                totalKeys,
                activeKeys,
                connectedApps,
                pendingRequests,
                recentActivity24h,
            },
            activity,
            hourlyActivity,
        };
    }
}
