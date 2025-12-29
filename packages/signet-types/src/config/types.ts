/**
 * Encrypted or plain-text key storage format
 */
export interface StoredKey {
    /** Initialization vector for encrypted keys (hex) */
    iv?: string;
    /** Encrypted key data (hex) */
    data?: string;
    /** Plain-text nsec (if not encrypted) */
    key?: string;
}

/**
 * Admin interface configuration
 */
export interface AdminConfig {
    /** Private key for bunker signer (hex) */
    key: string;
    /** Secret for bunker URI authentication */
    secret?: string;
}

/**
 * Nostr relay configuration
 */
export interface NostrConfig {
    relays: string[];
}

/**
 * Main Signet configuration file structure
 */
export interface ConfigFile {
    /** Nostr relay configuration */
    nostr: NostrConfig;
    /** Admin interface configuration */
    admin: AdminConfig;
    /** HTTP server port for REST API */
    authPort?: number;
    /** HTTP server host binding */
    authHost?: string;
    /** Public base URL for callbacks */
    baseUrl?: string;
    /** Database connection string */
    database?: string;
    /** Log file path */
    logs?: string;
    /** Stored keys (encrypted or plain) */
    keys: Record<string, StoredKey>;
    /** Enable verbose logging */
    verbose: boolean;
    /** Secret key for signing JWT tokens (auto-generated if not provided) */
    jwtSecret?: string;
    /** List of allowed CORS origins */
    allowedOrigins?: string[];
    /** Require authentication for API access (default: false for local use) */
    requireAuth?: boolean;
}
