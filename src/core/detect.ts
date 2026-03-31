import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Framework } from '../types.js';

/**
 * Detect framework from package.json dependencies
 */
export function detectFramework(projectPath: string): Framework | null {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['next']) return 'nextjs';
    if (deps['@sveltejs/kit']) return 'sveltekit';
    if (deps['svelte'] && deps['vite']) return 'sveltekit';
    if (deps['vite'] && deps['vue']) return 'vue';
    if (deps['vite']) return 'vite';
    return null;
  } catch {
    return null;
  }
}

/**
 * Derive start command from framework and port
 */
export function frameworkStartCommand(framework: Framework | null, port: number): string | null {
  switch (framework) {
    case 'nextjs':
      return `npx next dev --port ${port}`;
    case 'sveltekit':
      return `npm run dev -- --port ${port}`;
    case 'vite':
      return `npx vite dev --port ${port}`;
    case 'vue':
      return `npm run dev -- --port ${port}`;
    case 'django':
      return `python manage.py runserver 0.0.0.0:${port}`;
    case 'custom':
      return null;
    default:
      return null;
  }
}

/**
 * Detect package manager from lockfile
 */
export function detectPackageManager(projectPath: string): 'npm' | 'pnpm' | 'bun' | 'yarn' | null {
  if (existsSync(join(projectPath, 'bun.lockb')) || existsSync(join(projectPath, 'bun.lock'))) return 'bun';
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(projectPath, 'package-lock.json'))) return 'npm';
  if (existsSync(join(projectPath, 'package.json'))) return 'npm';
  return null;
}

/**
 * Detect if project uses a database (via Prisma schema)
 */
export function detectDatabase(projectPath: string): boolean {
  return existsSync(join(projectPath, 'prisma', 'schema.prisma'));
}
