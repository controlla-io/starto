import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../core/config.js';
import { isPortInUseSync, getPortPid, killPort } from '../core/ports.js';
import { startServer } from '../core/process.js';
import { listAllMetadata } from '../core/metadata.js';
import { frameworkStartCommand } from '../core/detect.js';
import { runHook, buildHookContext } from '../core/hooks.js';
import { header, success, warn, error, info, c } from '../core/output.js';

export function commandStart(args: string[]): void {
  const live = args.includes('--live') || args.includes('-l');
  const positional = args.filter((a) => !a.startsWith('-'));
  const targetPath = positional[0] ? resolve(positional[0]) : process.cwd();

  const { projects, personal } = loadConfig();

  // Determine which project we're starting
  let slug: string | null = null;
  let port: number | null = null;
  let startCommand: string | null = null;
  let projectPath: string = targetPath;
  let branch: string | null = null;
  let dbName: string | null = null;

  // First check: is this an environment (worktree)?
  const allMeta = listAllMetadata();
  for (const meta of allMeta) {
    if (resolve(meta.path) === targetPath) {
      slug = meta.project;
      port = meta.port;
      branch = meta.branch;
      dbName = meta.database;
      projectPath = meta.path;
      const project = projects[meta.project];
      if (project) {
        startCommand = project.startCommand?.replace(/\d+$/, String(port)) ||
          frameworkStartCommand(project.framework, port);
      }
      break;
    }
  }

  // Second check: is this a main project directory?
  if (!slug) {
    for (const [s, p] of Object.entries(projects)) {
      if (resolve(p.path) === targetPath) {
        slug = s;
        port = p.port;
        startCommand = p.startCommand;
        projectPath = p.path;
        break;
      }
    }
  }

  if (!slug || !port) {
    error(`Not a starto project: ${targetPath}`);
    info(`Run ${c('cyan', 'starto list')} to see registered projects.`);
    process.exit(1);
  }

  if (!startCommand) {
    error(`No start command for ${slug}. Set 'start' in starto.toml or ensure framework is detected.`);
    process.exit(1);
  }

  if (!existsSync(projectPath)) {
    error(`Project directory not found: ${projectPath}`);
    process.exit(1);
  }

  header(`starto — ${slug}${branch ? ` (${branch})` : ''}`);
  info(`${c('dim', 'port')}  ${c('bold', String(port))}`);
  info(`${c('dim', 'path')}  ${projectPath}`);
  info(`${c('dim', 'cmd')}   ${startCommand}`);
  console.log();

  // Handle port conflicts
  if (isPortInUseSync(port)) {
    const existingPid = getPortPid(port);
    warn(`Port ${port} in use (PID ${existingPid}). Killing...`);
    killPort(port);

    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && isPortInUseSync(port)) {
      const start = Date.now();
      while (Date.now() - start < 100) { /* busy wait */ }
    }

    if (isPortInUseSync(port)) {
      error(`Could not free port ${port}. Try: lsof -ti :${port} | xargs kill -9`);
      process.exit(1);
    }
    success('Port freed.');
  }

  // Run pre_start hook
  runHook(personal.hooks, 'pre_start', buildHookContext({
    project: slug, port, dir: projectPath, branch: branch || undefined, db: dbName,
  }));

  if (live) {
    info('Starting with live output (Ctrl+C to stop)...');
    const [cmd, ...cmdArgs] = startCommand.split(' ');
    spawnSync(cmd, cmdArgs, {
      cwd: projectPath,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    });
  } else {
    const { pid, logFile } = startServer(projectPath, startCommand, port);
    success(`Started ${c('bold', slug)} on ${c('cyan', `http://localhost:${port}`)}`);
    info(`${c('dim', 'pid')}  ${pid}`);
    info(`${c('dim', 'log')}  tail -f ${logFile}`);

    // Run post_start hook
    runHook(personal.hooks, 'post_start', buildHookContext({
      project: slug, port, dir: projectPath, branch: branch || undefined, db: dbName, pid,
    }));
  }
}
