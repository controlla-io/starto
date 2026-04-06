import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// Provider interface — three functions, that's the whole contract
// ============================================================================

export interface DatabaseProvider {
  create(dbName: string, opts: DbOpts): { created: boolean; error?: string };
  drop(dbName: string, opts: DbOpts): { dropped: boolean; error?: string };
  exists(dbName: string, opts: DbOpts): boolean;
  available(opts: DbOpts): boolean;
  list(prefix: string, opts: DbOpts): string[];
}

export interface DbOpts {
  host: string;
  port: number;
  /** For SQLite: directory where .db files are stored */
  dataDir?: string;
}

// ============================================================================
// Shared utilities
// ============================================================================

// @business-critical: database naming determines isolation — wrong name = data corruption or orphaned DBs
// MUST have unit tests before deployment
/**
 * Sanitize a name for use as a database name.
 * Replaces hyphens with underscores, lowercases, strips non-alphanumeric.
 */
export function sanitizeDbName(name: string): string {
  return name.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]/g, '');
}

// @business-critical: deterministic naming — same input must always produce same output
// MUST have unit tests before deployment
/**
 * Generate a deterministic database name from project + branch.
 * e.g. controlla-app + W208-client-portal-cms → controlla_app_w208_client_portal_cms
 */
export function generateDbName(projectSlug: string, branch: string): string {
  return `${sanitizeDbName(projectSlug)}_${sanitizeDbName(branch)}`;
}

// ============================================================================
// PostgreSQL provider
// ============================================================================

const postgres: DatabaseProvider = {
  exists(dbName, { host, port }) {
    try {
      const output = execSync(
        `psql -h ${host} -p ${port} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName}'"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      return output.trim() === '1';
    } catch {
      return false;
    }
  },

  create(dbName, opts) {
    if (this.exists(dbName, opts)) return { created: false };
    try {
      execSync(`createdb -h ${opts.host} -p ${opts.port} "${dbName}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { created: true };
    } catch (err: any) {
      const msg = err.stderr?.trim() || err.message;
      if (msg.includes('already exists')) return { created: false };
      return { created: false, error: msg };
    }
  },

  drop(dbName, opts) {
    if (!this.exists(dbName, opts)) return { dropped: true };
    try {
      execSync(`dropdb -h ${opts.host} -p ${opts.port} "${dbName}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { dropped: true };
    } catch (err: any) {
      return { dropped: false, error: err.stderr?.trim() || err.message };
    }
  },

  available({ host, port }) {
    try {
      execSync(`psql -h ${host} -p ${port} -d postgres -tAc "SELECT 1"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  },

  list(prefix, { host, port }) {
    try {
      const output = execSync(
        `psql -h ${host} -p ${port} -d postgres -tAc "SELECT datname FROM pg_database WHERE datname LIKE '${prefix}%'"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      return output.trim().split('\n').filter((d) => d.length > 0);
    } catch {
      return [];
    }
  },
};

// ============================================================================
// MySQL provider
// ============================================================================

const mysql: DatabaseProvider = {
  exists(dbName, { host, port }) {
    try {
      const output = execSync(
        `mysql -h ${host} -P ${port} -N -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${dbName}'"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      return output.trim() === dbName;
    } catch {
      return false;
    }
  },

  create(dbName, opts) {
    if (this.exists(dbName, opts)) return { created: false };
    try {
      execSync(`mysqladmin -h ${opts.host} -P ${opts.port} create "${dbName}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { created: true };
    } catch (err: any) {
      const msg = err.stderr?.trim() || err.message;
      if (msg.includes('already exists')) return { created: false };
      return { created: false, error: msg };
    }
  },

  drop(dbName, opts) {
    if (!this.exists(dbName, opts)) return { dropped: true };
    try {
      execSync(`mysqladmin -h ${opts.host} -P ${opts.port} -f drop "${dbName}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { dropped: true };
    } catch (err: any) {
      return { dropped: false, error: err.stderr?.trim() || err.message };
    }
  },

  available({ host, port }) {
    try {
      execSync(`mysqladmin -h ${host} -P ${port} ping`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return true;
    } catch {
      return false;
    }
  },

  list(prefix, { host, port }) {
    try {
      const output = execSync(
        `mysql -h ${host} -P ${port} -N -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE '${prefix}%'"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      );
      return output.trim().split('\n').filter((d) => d.length > 0);
    } catch {
      return [];
    }
  },
};

// ============================================================================
// SQLite provider
// ============================================================================

const sqlite: DatabaseProvider = {
  exists(dbName, { dataDir }) {
    return existsSync(join(dataDir || '.', `${dbName}.db`));
  },

  create(dbName, opts) {
    const dbPath = join(opts.dataDir || '.', `${dbName}.db`);
    if (existsSync(dbPath)) return { created: false };
    try {
      writeFileSync(dbPath, '');
      return { created: true };
    } catch (err: any) {
      return { created: false, error: err.message };
    }
  },

  drop(dbName, opts) {
    const dbPath = join(opts.dataDir || '.', `${dbName}.db`);
    if (!existsSync(dbPath)) return { dropped: true };
    try {
      unlinkSync(dbPath);
      return { dropped: true };
    } catch (err: any) {
      return { dropped: false, error: err.message };
    }
  },

  available() {
    return true; // SQLite is always available — it's just files
  },

  list(prefix, { dataDir }) {
    try {
      const dir = dataDir || '.';
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.db'))
        .map((f) => f.replace('.db', ''));
    } catch {
      return [];
    }
  },
};

// ============================================================================
// Provider registry
// ============================================================================

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite';

const providers: Record<DatabaseType, DatabaseProvider> = {
  postgresql: postgres,
  mysql,
  sqlite,
};

export function getProvider(type: DatabaseType): DatabaseProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Unknown database provider: ${type}`);
  return provider;
}

// ============================================================================
// Convenience wrappers — used by commands, delegate to the right provider
// ============================================================================

export function databaseExists(dbName: string, host: string = 'localhost', port: number = 5432, type: DatabaseType = 'postgresql', dataDir?: string): boolean {
  return getProvider(type).exists(dbName, { host, port, dataDir });
}

export function createDatabase(dbName: string, host: string = 'localhost', port: number = 5432, type: DatabaseType = 'postgresql', dataDir?: string): { created: boolean; error?: string } {
  return getProvider(type).create(dbName, { host, port, dataDir });
}

export function dropDatabase(dbName: string, host: string = 'localhost', port: number = 5432, type: DatabaseType = 'postgresql', dataDir?: string): { dropped: boolean; error?: string } {
  return getProvider(type).drop(dbName, { host, port, dataDir });
}

export function isPostgresAvailable(host: string = 'localhost', port: number = 5432): boolean {
  return getProvider('postgresql').available({ host, port });
}

export function isDatabaseAvailable(host: string = 'localhost', port: number = 5432, type: DatabaseType = 'postgresql', dataDir?: string): boolean {
  return getProvider(type).available({ host, port, dataDir });
}

export function listDatabases(prefix: string, host: string = 'localhost', port: number = 5432, type: DatabaseType = 'postgresql', dataDir?: string): string[] {
  return getProvider(type).list(prefix, { host, port, dataDir });
}
