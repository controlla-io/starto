import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { EnvironmentMetadata } from '../types.js';

const ENVS_DIR = join(
  process.env.XDG_CONFIG_HOME || join(process.env.HOME || '~', '.config'),
  'starto',
  'envs'
);

function ensureDir(): void {
  if (!existsSync(ENVS_DIR)) {
    mkdirSync(ENVS_DIR, { recursive: true });
  }
}

function envFilePath(branch: string): string {
  // Sanitize branch name for filesystem
  const safe = branch.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(ENVS_DIR, `${safe}.json`);
}

/**
 * Save environment metadata. Atomic write (temp + rename).
 */
export function saveMetadata(meta: EnvironmentMetadata): void {
  ensureDir();
  const filePath = envFilePath(meta.branch);
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(meta, null, 2));
  renameSync(tmpPath, filePath);
}

/**
 * Load environment metadata. Returns null if not found.
 */
export function loadMetadata(branch: string): EnvironmentMetadata | null {
  const filePath = envFilePath(branch);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Remove environment metadata file.
 */
export function removeMetadata(branch: string): void {
  const filePath = envFilePath(branch);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * List all environment metadata files.
 */
export function listAllMetadata(): EnvironmentMetadata[] {
  ensureDir();
  const files = readdirSync(ENVS_DIR).filter((f) => f.endsWith('.json'));
  const results: EnvironmentMetadata[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(ENVS_DIR, file), 'utf8'));
      results.push(data);
    } catch {
      // Skip corrupt files
    }
  }
  return results;
}
