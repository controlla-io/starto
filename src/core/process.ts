import { spawn, execSync } from 'node:child_process';
import { openSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Start a dev server in the background.
 * Returns the child PID.
 */
export function startServer(
  cwd: string,
  command: string,
  port: number
): { pid: number; logFile: string } {
  const logFile = join(cwd, 'server.log');
  const [cmd, ...args] = command.split(' ');

  const out = openSync(logFile, 'w');
  const child = spawn(cmd, args, {
    cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PORT: String(port) },
  });

  child.unref();

  return { pid: child.pid!, logFile };
}

/**
 * Check if a PID is still running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop a process by PID (graceful SIGTERM, then SIGKILL after timeout)
 */
export function stopProcess(pid: number): boolean {
  if (!isProcessRunning(pid)) return true;

  try {
    process.kill(pid, 'SIGTERM');

    // Wait up to 3 seconds for graceful shutdown
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && isProcessRunning(pid)) {
      const start = Date.now();
      while (Date.now() - start < 100) { /* busy wait */ }
    }

    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }

    return true;
  } catch {
    return false;
  }
}

// @business-critical: safety gate for starto rm — false negative = files deleted from under running process
// MUST have unit tests before deployment
/**
 * Check if any process has files open in a directory (safety check for rm)
 */
export function isDirectoryInUse(dirPath: string): { inUse: boolean; pids: number[] } {
  try {
    const output = execSync(`lsof +D "${dirPath}" 2>/dev/null | awk 'NR>1{print $2}' | sort -u`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000,
    });
    const pids = output
      .trim()
      .split('\n')
      .filter((p) => p.length > 0)
      .map((p) => parseInt(p, 10))
      .filter((p) => !isNaN(p));
    return { inUse: pids.length > 0, pids };
  } catch {
    return { inUse: false, pids: [] };
  }
}
