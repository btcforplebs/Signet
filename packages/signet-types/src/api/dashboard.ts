/**
 * Dashboard statistics summary
 */
export interface DashboardStats {
    totalKeys: number;
    activeKeys: number;
    connectedApps: number;
    pendingRequests: number;
    recentActivity24h: number;
}

/**
 * Approval type for activity tracking
 * - manual: User explicitly approved via web UI or API
 * - auto_trust: Auto-approved by trust level rules
 * - auto_permission: Auto-approved by previous "Always Allow" (SigningCondition)
 */
export type ApprovalType = 'manual' | 'auto_trust' | 'auto_permission';

/**
 * A single activity entry for the dashboard timeline
 */
export interface ActivityEntry {
    id: number;
    timestamp: string;
    type: string;
    method?: string;
    eventKind?: number;
    keyName?: string;
    userPubkey?: string;
    appName?: string;
    autoApproved: boolean;
    approvalType?: ApprovalType;
}

/**
 * Dashboard API response
 */
export interface DashboardResponse {
    stats: DashboardStats;
    activity: ActivityEntry[];
}
