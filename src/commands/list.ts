import { existsSync } from 'node:fs';
import { loadConfig } from '../core/config.js';
import { listWorktrees } from '../core/worktree.js';
import { listAllMetadata, removeMetadata } from '../core/metadata.js';
import { isPortInUseSync, getPortPid } from '../core/ports.js';
import { header, info, warn, c } from '../core/output.js';
import type { ListOutput, ListOutputEnvironment } from '../types.js';

export function commandList(args: string[]): void {
  const json = args.includes('--json');

  const { projects, personal } = loadConfig();
  const allMeta = listAllMetadata();

  const output: ListOutput = { projects: {} };

  for (const [slug, project] of Object.entries(projects)) {
    const portInUse = isPortInUseSync(project.port);
    const pid = portInUse ? getPortPid(project.port) : null;

    const environments: Record<string, ListOutputEnvironment> = {};

    // 1. Check metadata entries — verify each against reality
    const envMetas = allMeta.filter((m) => m.project === slug);
    for (const meta of envMetas) {
      const worktreeExists = existsSync(meta.path);

      if (!worktreeExists) {
        // Stale metadata — worktree was deleted outside starto
        if (!json) {
          warn(`${meta.branch}: metadata exists but worktree is gone (run starto gc to clean)`);
        }
        continue; // Don't show ghost environments
      }

      const envPortInUse = isPortInUseSync(meta.port);
      const envPid = envPortInUse ? getPortPid(meta.port) : null;

      environments[meta.branch] = {
        port: meta.port,
        path: meta.path,
        branch: meta.branch,
        database: meta.database,
        running: envPortInUse,
        pid: envPid,
      };
    }

    // 2. Discover worktrees from git that have no metadata
    const gitWorktrees = listWorktrees(project.path);
    const knownBranches = new Set(envMetas.map((m) => m.branch));

    for (const wt of gitWorktrees) {
      // Skip the main worktree (the project directory itself)
      if (wt.path === project.path) continue;
      // Skip if we already have metadata for this branch
      if (!wt.branch || knownBranches.has(wt.branch)) continue;

      // Discovered worktree with no starto metadata
      const envPortInUse = isPortInUseSync(0); // No known port
      environments[wt.branch] = {
        port: 0,
        path: wt.path,
        branch: wt.branch,
        database: null,
        running: false,
        pid: null,
      };

      if (!json) {
        warn(`${wt.branch}: git worktree exists but not managed by starto`);
      }
    }

    output.projects[slug] = {
      port: project.port,
      path: project.path,
      framework: project.framework,
      running: portInUse,
      pid,
      environments,
    };
  }

  if (json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  header('starto — workspace projects');
  console.log();
  info(
    `${c('dim', 'PROJECT'.padEnd(24))} ${c('dim', 'PORT'.padEnd(7))} ${c('dim', 'STATUS'.padEnd(10))} ${c('dim', 'FRAMEWORK')}`
  );
  info(c('dim', '─'.repeat(60)));

  for (const [slug, proj] of Object.entries(output.projects)) {
    const status = proj.running
      ? c('green', 'running')
      : c('dim', 'stopped');
    const fw = proj.framework ? c('cyan', proj.framework) : c('dim', '-');
    const pidStr = proj.pid ? c('dim', ` (${proj.pid})`) : '';

    info(`${c('bold', slug.padEnd(24))} ${String(proj.port).padEnd(7)} ${status.padEnd(19)}${pidStr} ${fw}`);

    // Show environments
    for (const [branch, env] of Object.entries(proj.environments)) {
      const envStatus = env.running
        ? c('green', 'running')
        : c('dim', 'stopped');
      const dbStr = env.database ? c('dim', ` db:${env.database}`) : '';
      const envPidStr = env.pid ? c('dim', ` (${env.pid})`) : '';
      const portStr = env.port > 0 ? String(env.port) : c('dim', '?');
      const unmanaged = env.port === 0 ? c('dim', ' (unmanaged)') : '';

      info(`  ${c('yellow', branch.padEnd(22))} ${portStr.padEnd(7)} ${envStatus.padEnd(19)}${envPidStr}${dbStr}${unmanaged}`);
    }
  }

  console.log();
}
