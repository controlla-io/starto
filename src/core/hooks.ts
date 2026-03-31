import { execSync } from 'node:child_process';
import type { HooksConfig, HookContext } from '../types.js';

type HookName = keyof HooksConfig;

/**
 * Execute a hook script with starto environment variables injected.
 * Hooks are fire-and-forget — failures are warned, not fatal.
 */
export function runHook(
  hooks: HooksConfig | undefined,
  hookName: HookName,
  context: Partial<HookContext>
): void {
  if (!hooks) return;
  const command = hooks[hookName];
  if (!command) return;

  // Build environment with STARTO_ prefix
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      env[key] = String(value);
    }
  }

  // Substitute $STARTO_* variables in the command string
  let resolved = command;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      resolved = resolved.replace(new RegExp(`\\$${key}`, 'g'), String(value));
    }
  }

  try {
    execSync(resolved, {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
  } catch (err: any) {
    // Hooks failing is a warning, not a fatal error
    const stderr = err.stderr?.trim();
    if (stderr) {
      console.error(`  hook ${hookName} warning: ${stderr}`);
    }
  }
}

/**
 * Build a hook context object from available data
 */
export function buildHookContext(data: {
  project?: string;
  port?: number;
  dir?: string;
  branch?: string;
  db?: string | null;
  pid?: number | null;
}): Partial<HookContext> {
  const ctx: Partial<HookContext> = {};
  if (data.project) ctx.STARTO_PROJECT = data.project;
  if (data.port) ctx.STARTO_PORT = String(data.port);
  if (data.dir) ctx.STARTO_DIR = data.dir;
  if (data.branch) ctx.STARTO_BRANCH = data.branch;
  if (data.db) ctx.STARTO_DB = data.db;
  if (data.pid) ctx.STARTO_PID = String(data.pid);
  return ctx;
}
