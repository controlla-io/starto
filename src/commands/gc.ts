import { existsSync } from 'node:fs';
import { loadConfig } from '../core/config.js';
import { listAllMetadata, removeMetadata } from '../core/metadata.js';
import { branchExists, listWorktrees } from '../core/worktree.js';
import { databaseExists, dropDatabase, listDatabases, sanitizeDbName } from '../core/database.js';
import { isPortInUseSync, getPortPid } from '../core/ports.js';
import { stopProcess } from '../core/process.js';
import { removeWorktree } from '../core/worktree.js';
import { header, success, warn, info, c } from '../core/output.js';

interface StaleItem {
  type: 'metadata' | 'database' | 'worktree' | 'process';
  name: string;
  reason: string;
  cleanup: () => void;
}

export function commandGc(args: string[]): void {
  const execute = args.includes('--yes') || args.includes('-y');
  const stopStale = args.includes('--stop');

  const { projects, personal, workspaceRoot } = loadConfig();
  const allMeta = listAllMetadata();
  const dbHost = personal.database?.host || 'localhost';
  const dbPort = personal.database?.port || 5432;

  header('starto gc — garbage collection');
  console.log();

  const stale: StaleItem[] = [];

  // 1. Metadata files with no corresponding worktree
  for (const meta of allMeta) {
    if (!existsSync(meta.path)) {
      stale.push({
        type: 'metadata',
        name: `${meta.branch} (metadata)`,
        reason: `Worktree directory missing: ${meta.path}`,
        cleanup: () => {
          removeMetadata(meta.branch);
          if (meta.database && databaseExists(meta.database, dbHost, dbPort)) {
            dropDatabase(meta.database, dbHost, dbPort);
          }
        },
      });
    }
  }

  // 2. Metadata for branches that no longer exist in git
  for (const meta of allMeta) {
    const project = projects[meta.project];
    if (!project) continue;
    if (!branchExists(project.path, meta.branch)) {
      // Only if worktree also doesn't exist (already covered above)
      if (existsSync(meta.path)) {
        stale.push({
          type: 'worktree',
          name: `${meta.branch} (merged)`,
          reason: `Branch '${meta.branch}' no longer exists (likely merged)`,
          cleanup: () => {
            if (meta.database && databaseExists(meta.database, dbHost, dbPort)) {
              dropDatabase(meta.database, dbHost, dbPort);
            }
            removeWorktree(project.path, meta.path, true);
            removeMetadata(meta.branch);
          },
        });
      }
    }
  }

  // 3. Orphaned databases (match naming pattern but no metadata)
  for (const [slug, project] of Object.entries(projects)) {
    if (!project.database) continue;
    const prefix = sanitizeDbName(slug) + '_';
    const databases = listDatabases(prefix, dbHost, dbPort);
    const knownDbs = new Set(allMeta.filter((m) => m.project === slug).map((m) => m.database));

    for (const db of databases) {
      if (!knownDbs.has(db)) {
        stale.push({
          type: 'database',
          name: db,
          reason: `No matching environment metadata`,
          cleanup: () => dropDatabase(db, dbHost, dbPort),
        });
      }
    }
  }

  // 4. Stopped but port-holding servers (informational with --stop)
  if (stopStale) {
    for (const meta of allMeta) {
      if (isPortInUseSync(meta.port)) {
        const pid = getPortPid(meta.port);
        if (pid) {
          stale.push({
            type: 'process',
            name: `${meta.branch} (port ${meta.port}, PID ${pid})`,
            reason: 'Running server — will be stopped',
            cleanup: () => stopProcess(pid),
          });
        }
      }
    }
  }

  // Report
  if (stale.length === 0) {
    success('No stale resources found. Workspace is clean.');
    return;
  }

  info(`Found ${c('yellow', String(stale.length))} stale resource(s):\n`);

  for (const item of stale) {
    const icon = item.type === 'database' ? 'db' : item.type === 'process' ? 'pid' : item.type;
    info(`  ${c('yellow', icon.padEnd(10))} ${c('bold', item.name)}`);
    info(`  ${c('dim', ' '.repeat(10) + item.reason)}`);
  }

  console.log();

  if (!execute) {
    info(`Dry run. Run ${c('cyan', 'starto gc --yes')} to clean up.`);
    return;
  }

  // Execute cleanup
  info('Cleaning up...\n');
  for (const item of stale) {
    try {
      item.cleanup();
      success(`Cleaned: ${item.name}`);
    } catch (err: any) {
      warn(`Failed to clean ${item.name}: ${err.message}`);
    }
  }

  console.log();
  success('Garbage collection complete.');
}
