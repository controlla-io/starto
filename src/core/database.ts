import { execSync } from 'node:child_process';

/**
 * Sanitize a name for use as a Postgres database name.
 * Replaces hyphens with underscores, lowercases, strips non-alphanumeric.
 */
export function sanitizeDbName(name: string): string {
  return name.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Generate a deterministic database name from project + branch.
 * e.g. controlla-app + W208-client-portal-cms → controlla_app_w208_client_portal_cms
 */
export function generateDbName(projectSlug: string, branch: string): string {
  return `${sanitizeDbName(projectSlug)}_${sanitizeDbName(branch)}`;
}

/**
 * Check if a database exists in local Postgres
 */
export function databaseExists(dbName: string, host: string = 'localhost', port: number = 5432): boolean {
  try {
    const output = execSync(
      `psql -h ${host} -p ${port} -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return output.trim() === '1';
  } catch {
    return false;
  }
}

/**
 * Create a local Postgres database.
 * Returns success status. Idempotent — returns true if already exists.
 */
export function createDatabase(dbName: string, host: string = 'localhost', port: number = 5432): { created: boolean; error?: string } {
  if (databaseExists(dbName, host, port)) {
    return { created: false };
  }

  try {
    execSync(`createdb -h ${host} -p ${port} "${dbName}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { created: true };
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.message;
    if (msg.includes('already exists')) return { created: false };
    return { created: false, error: msg };
  }
}

/**
 * Drop a local Postgres database.
 * Idempotent — returns true if already gone.
 */
export function dropDatabase(dbName: string, host: string = 'localhost', port: number = 5432): { dropped: boolean; error?: string } {
  if (!databaseExists(dbName, host, port)) {
    return { dropped: true };
  }

  try {
    execSync(`dropdb -h ${host} -p ${port} "${dbName}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { dropped: true };
  } catch (err: any) {
    return { dropped: false, error: err.stderr?.trim() || err.message };
  }
}

/**
 * Check if local Postgres is running and accessible
 */
export function isPostgresAvailable(host: string = 'localhost', port: number = 5432): boolean {
  try {
    execSync(`psql -h ${host} -p ${port} -tAc "SELECT 1"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List databases matching a prefix (for gc/orphan detection)
 */
export function listDatabases(prefix: string, host: string = 'localhost', port: number = 5432): string[] {
  try {
    const output = execSync(
      `psql -h ${host} -p ${port} -tAc "SELECT datname FROM pg_database WHERE datname LIKE '${prefix}%'"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return output.trim().split('\n').filter((d) => d.length > 0);
  } catch {
    return [];
  }
}
