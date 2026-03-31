import { loadConfig } from '../core/config.js';
import { listWorktrees } from '../core/worktree.js';
import { listAllMetadata } from '../core/metadata.js';
import { isPortInUseSync, getPortPid } from '../core/ports.js';
import { isProcessRunning } from '../core/process.js';
import { databaseExists } from '../core/database.js';
import { header, info, c } from '../core/output.js';
import type { ListOutput, ListOutputProject, ListOutputEnvironment, EnvironmentMetadata } from '../types.js';

export function commandList(args: string[]): void {
  const json = args.includes('--json');

  const { projects, workspaceRoot, personal } = loadConfig();
  const allMeta = listAllMetadata();
  const dbHost = personal.database?.host || 'localhost';
  const dbPort = personal.database?.port || 5432;

  const output: ListOutput = { projects: {} };

  for (const [slug, project] of Object.entries(projects)) {
    const portInUse = isPortInUseSync(project.port);
    const pid = portInUse ? getPortPid(project.port) : null;

    // Find environments for this project
    const envMetas = allMeta.filter((m) => m.project === slug);
    const environments: Record<string, ListOutputEnvironment> = {};

    for (const meta of envMetas) {
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

      info(`  ${c('yellow', branch.padEnd(22))} ${String(env.port).padEnd(7)} ${envStatus.padEnd(19)}${envPidStr}${dbStr}`);
    }
  }

  console.log();
}
