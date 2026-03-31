import { loadConfig } from '../core/config.js';
import { loadMetadata, listAllMetadata } from '../core/metadata.js';
import { isPortInUseSync, getPortPid } from '../core/ports.js';
import { stopProcess } from '../core/process.js';
import { header, success, warn, error, info, c } from '../core/output.js';

export function commandStop(args: string[]): void {
  const positional = args.filter((a) => !a.startsWith('-'));
  const { projects } = loadConfig();

  if (positional.length === 0) {
    // Stop the current directory's project
    const cwd = process.cwd();
    let found = false;

    for (const [slug, project] of Object.entries(projects)) {
      if (cwd.startsWith(project.path)) {
        stopByPort(slug, project.port);
        found = true;
        break;
      }
    }

    // Check environments too
    if (!found) {
      for (const meta of listAllMetadata()) {
        if (cwd.startsWith(meta.path)) {
          stopByPort(`${meta.project} (${meta.branch})`, meta.port);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      error('Not in a starto project directory.');
      process.exit(1);
    }
    return;
  }

  // Stop a named environment or project
  const target = positional[0];

  // Check if it's an environment (branch name)
  const meta = loadMetadata(target);
  if (meta) {
    stopByPort(`${meta.project} (${meta.branch})`, meta.port);
    return;
  }

  // Check if it's a project slug
  if (projects[target]) {
    stopByPort(target, projects[target].port);
    return;
  }

  error(`Unknown project or environment: ${target}`);
  info(`Run ${c('cyan', 'starto list')} to see available targets.`);
  process.exit(1);
}

function stopByPort(name: string, port: number): void {
  if (!isPortInUseSync(port)) {
    info(`${name} is not running (port ${port}).`);
    return;
  }

  const pid = getPortPid(port);
  if (!pid) {
    warn(`Port ${port} in use but could not identify process.`);
    return;
  }

  info(`Stopping ${c('bold', name)} (PID ${pid}, port ${port})...`);
  if (stopProcess(pid)) {
    success('Stopped.');
  } else {
    error('Failed to stop process.');
  }
}
