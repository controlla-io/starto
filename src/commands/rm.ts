import { loadConfig } from '../core/config.js';
import { loadMetadata, removeMetadata } from '../core/metadata.js';
import { removeWorktree } from '../core/worktree.js';
import { dropDatabase } from '../core/database.js';
import { isPortInUseSync, getPortPid } from '../core/ports.js';
import { stopProcess, isDirectoryInUse } from '../core/process.js';
import { runHook, buildHookContext } from '../core/hooks.js';
import { header, success, warn, error, info, c } from '../core/output.js';

export function commandRm(args: string[]): void {
  const force = args.includes('--force') || args.includes('-f');
  const positional = args.filter((a) => !a.startsWith('-'));

  if (positional.length < 1) {
    error('Usage: starto rm <branch> [--force]');
    process.exit(1);
  }

  const branch = positional[0];
  const { projects, personal } = loadConfig();
  const meta = loadMetadata(branch);

  if (!meta) {
    error(`No environment found for branch '${branch}'.`);
    info(`Run ${c('cyan', 'starto list')} to see environments.`);
    process.exit(1);
  }

  const project = projects[meta.project];
  const dbHost = personal.database?.host || 'localhost';
  const dbPort = personal.database?.port || 5432;

  header(`starto rm — ${branch}`);
  info(`${c('dim', 'project')}  ${meta.project}`);
  info(`${c('dim', 'path')}     ${meta.path}`);
  info(`${c('dim', 'port')}     ${meta.port}`);
  if (meta.database) info(`${c('dim', 'db')}       ${meta.database}`);
  console.log();

  // Safety check: is the environment in use?
  if (!force) {
    // Check for running dev server
    if (isPortInUseSync(meta.port)) {
      const pid = getPortPid(meta.port);
      error(`Dev server running on port ${meta.port} (PID ${pid}).`);
      info(`Use ${c('yellow', 'starto rm ' + branch + ' --force')} to stop and remove.`);
      process.exit(1);
    }

    // Check for any processes using the directory
    const dirUse = isDirectoryInUse(meta.path);
    if (dirUse.inUse) {
      error(`Directory in use by PIDs: ${dirUse.pids.join(', ')}`);
      info(`Use ${c('yellow', 'starto rm ' + branch + ' --force')} to remove anyway.`);
      process.exit(1);
    }
  }

  // Run pre_rm hook
  runHook(personal.hooks, 'pre_rm', buildHookContext({
    project: meta.project, port: meta.port, dir: meta.path, branch, db: meta.database,
  }));

  // Step 1: Stop running server
  if (isPortInUseSync(meta.port)) {
    const pid = getPortPid(meta.port);
    if (pid) {
      info('Stopping dev server...');
      stopProcess(pid);
      success('Server stopped.');
    }
  }

  // Step 2: Drop database
  if (meta.database) {
    info(`Dropping database ${c('cyan', meta.database)}...`);
    const db = dropDatabase(meta.database, dbHost, dbPort);
    if (db.error) {
      warn(`Database: ${db.error}`);
    } else {
      success('Database dropped.');
    }
  }

  // Step 3: Remove worktree
  if (project) {
    info('Removing worktree...');
    const wt = removeWorktree(project.path, meta.path, force);
    if (wt.error) {
      warn(`Worktree: ${wt.error}`);
      if (!force) {
        info(`Use ${c('yellow', '--force')} to override.`);
        process.exit(1);
      }
    } else {
      success('Worktree removed.');
    }
  }

  // Step 4: Remove metadata
  removeMetadata(branch);
  success('Metadata cleaned.');

  // Run post_rm hook
  runHook(personal.hooks, 'post_rm', buildHookContext({
    project: meta.project, branch,
  }));

  console.log();
  success(`Environment ${c('bold', branch)} removed.`);
}
