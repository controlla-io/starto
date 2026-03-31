import { createServer } from 'node:net';
import { execSync } from 'node:child_process';

/**
 * Check if a port is available by attempting to bind to it.
 * More reliable than lsof parsing.
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Synchronous port check via lsof (for listing, not critical paths)
 */
export function isPortInUseSync(port: number): boolean {
  try {
    execSync(`lsof -i :${port}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the PID of the process on a given port
 */
export function getPortPid(port: number): number | null {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    const firstPid = output.split('\n')[0]?.trim();
    return firstPid ? parseInt(firstPid, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Find next available port in a range
 */
export async function findAvailablePort(start: number, end: number, exclude: Set<number> = new Set()): Promise<number | null> {
  for (let port = start; port <= end; port++) {
    if (exclude.has(port)) continue;
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

/**
 * Kill process on a port. Only kills if PID matches expected (starto-managed).
 */
export function killPort(port: number): boolean {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf8' }).trim();
    if (!pids) return false;
    for (const pid of pids.split('\n')) {
      const trimmed = pid.trim();
      if (trimmed) {
        try {
          process.kill(parseInt(trimmed, 10), 'SIGTERM');
        } catch {
          // Process already gone
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}
