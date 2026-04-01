import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { detectFramework, detectPackageManager, detectDatabaseType, frameworkStartCommand } from '../src/core/detect.js';

const TMP = join(import.meta.dirname, '.tmp-detect-test');

describe('detectFramework', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('detects Next.js', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { next: '14.0.0' } }));
    assert.equal(detectFramework(TMP), 'nextjs');
  });

  it('detects SvelteKit', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ devDependencies: { '@sveltejs/kit': '2.0.0' } }));
    assert.equal(detectFramework(TMP), 'sveltekit');
  });

  it('detects Vite', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ devDependencies: { vite: '5.0.0' } }));
    assert.equal(detectFramework(TMP), 'vite');
  });

  it('detects Vue', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { vue: '3.0.0' }, devDependencies: { vite: '5.0.0' } }));
    assert.equal(detectFramework(TMP), 'vue');
  });

  it('returns null for unknown framework', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { express: '4.0.0' } }));
    assert.equal(detectFramework(TMP), null);
  });

  it('returns null when no package.json', () => {
    assert.equal(detectFramework(TMP), null);
  });
});

describe('detectPackageManager', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('detects npm from package-lock.json', () => {
    writeFileSync(join(TMP, 'package-lock.json'), '{}');
    assert.equal(detectPackageManager(TMP), 'npm');
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    writeFileSync(join(TMP, 'pnpm-lock.yaml'), '');
    assert.equal(detectPackageManager(TMP), 'pnpm');
  });

  it('detects bun from bun.lockb', () => {
    writeFileSync(join(TMP, 'bun.lockb'), '');
    assert.equal(detectPackageManager(TMP), 'bun');
  });

  it('falls back to npm if only package.json exists', () => {
    writeFileSync(join(TMP, 'package.json'), '{}');
    assert.equal(detectPackageManager(TMP), 'npm');
  });

  it('returns null when nothing exists', () => {
    assert.equal(detectPackageManager(TMP), null);
  });
});

describe('frameworkStartCommand', () => {
  it('generates Next.js command with port', () => {
    assert.equal(frameworkStartCommand('nextjs', 3000), 'npx next dev --port 3000');
  });

  it('generates SvelteKit command with port', () => {
    assert.equal(frameworkStartCommand('sveltekit', 3021), 'npm run dev -- --port 3021');
  });

  it('returns null for unknown framework', () => {
    assert.equal(frameworkStartCommand(null, 3000), null);
  });

  it('returns null for custom framework', () => {
    assert.equal(frameworkStartCommand('custom', 3000), null);
  });
});

describe('detectDatabaseType', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('detects postgresql from Prisma schema', () => {
    mkdirSync(join(TMP, 'prisma'), { recursive: true });
    writeFileSync(join(TMP, 'prisma', 'schema.prisma'), `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`);
    assert.equal(detectDatabaseType(TMP), 'postgresql');
  });

  it('detects mysql from Prisma schema', () => {
    mkdirSync(join(TMP, 'prisma'), { recursive: true });
    writeFileSync(join(TMP, 'prisma', 'schema.prisma'), `
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
`);
    assert.equal(detectDatabaseType(TMP), 'mysql');
  });

  it('detects sqlite from Prisma schema', () => {
    mkdirSync(join(TMP, 'prisma'), { recursive: true });
    writeFileSync(join(TMP, 'prisma', 'schema.prisma'), `
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
`);
    assert.equal(detectDatabaseType(TMP), 'sqlite');
  });

  it('detects postgresql from pg dependency', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { pg: '8.0.0' } }));
    assert.equal(detectDatabaseType(TMP), 'postgresql');
  });

  it('detects mysql from mysql2 dependency', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { mysql2: '3.0.0' } }));
    assert.equal(detectDatabaseType(TMP), 'mysql');
  });

  it('detects sqlite from better-sqlite3 dependency', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { 'better-sqlite3': '9.0.0' } }));
    assert.equal(detectDatabaseType(TMP), 'sqlite');
  });

  it('returns null when no database detected', () => {
    writeFileSync(join(TMP, 'package.json'), JSON.stringify({ dependencies: { express: '4.0.0' } }));
    assert.equal(detectDatabaseType(TMP), null);
  });

  it('returns null for empty directory', () => {
    assert.equal(detectDatabaseType(TMP), null);
  });
});
