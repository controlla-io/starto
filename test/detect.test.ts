import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { detectFramework, detectPackageManager, frameworkStartCommand } from '../src/core/detect.js';

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
