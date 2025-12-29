import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const DEFAULT_DB_PATH = '/app/config/signet.db';

/**
 * Normalize DATABASE_URL to a file path.
 * - Strips 'file:' prefix if present
 * - Uses default Docker path if not specified
 * - In Docker: normalizes ~/.signet-config paths to /app/config
 * - In local dev (SIGNET_LOCAL=1): uses path as-is
 */
function normaliseDatabasePath(url: string | undefined): string {
    if (!url || url.trim() === '') {
        return DEFAULT_DB_PATH;
    }

    // Strip file: prefix if present
    let path = url.startsWith('file:') ? url.slice(5) : url;

    // In local development mode, use path as-is
    if (process.env.SIGNET_LOCAL === '1' || process.env.NODE_ENV === 'development') {
        return path;
    }

    // In Docker: map ~/.signet-config to /app/config (mounted volume)
    if (path.includes('.signet-config')) {
        const match = path.match(/\.signet-config(.*)$/);
        if (match) {
            return `/app/config${match[1]}`;
        }
    }

    // Relative paths go under /app
    if (!path.startsWith('/')) {
        return `/app/${path.replace(/^\.\//, '')}`;
    }

    return path;
}

const dbPath = normaliseDatabasePath(process.env.DATABASE_URL);

if (dbPath !== process.env.DATABASE_URL) {
    console.log(`Using database: ${dbPath}`);
}

// Ensure database directory exists
const dir = dirname(dbPath);
if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
}

// Prisma 7 with client engine requires driver adapter
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

export default prisma;
