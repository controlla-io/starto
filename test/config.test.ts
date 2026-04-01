import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadStartoToml, resolveProject } from '../src/core/config.js';

const TMP = join(import.meta.dirname, '.tmp-config-test');

describe('loadStartoToml', () => {
  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('parses a minimal starto.toml', () => {
    const toml = `
[projects.my-app]
port = 3000
`;
    writeFileSync(join(TMP, 'starto.toml'), toml);

    const config = loadStartoToml(join(TMP, 'starto.toml'));
    assert.equal(config.projects['my-app'].port, 3000);
  });

  it('parses database and setup fields', () => {
    const toml = `
[projects.my-app]
port = 3000
database = true
setup = "npx prisma migrate deploy"
`;
    writeFileSync(join(TMP, 'starto.toml'), toml);

    const config = loadStartoToml(join(TMP, 'starto.toml'));
    assert.equal(config.projects['my-app'].database, true);
    assert.equal(config.projects['my-app'].setup, 'npx prisma migrate deploy');
  });

  it('parses env overrides', () => {
    const toml = `
[projects.my-app]
port = 3000

[projects.my-app.env]
DATABASE_URL = "postgresql://localhost:5432/\${db}"
`;
    writeFileSync(join(TMP, 'starto.toml'), toml);

    const config = loadStartoToml(join(TMP, 'starto.toml'));
    assert.equal(config.projects['my-app'].env?.DATABASE_URL, 'postgresql://localhost:5432/${db}');
  });

  it('parses multiple projects', () => {
    const toml = `
[projects.app-one]
port = 3000

[projects.app-two]
port = 3001
`;
    writeFileSync(join(TMP, 'starto.toml'), toml);

    const config = loadStartoToml(join(TMP, 'starto.toml'));
    assert.equal(Object.keys(config.projects).length, 2);
    assert.equal(config.projects['app-one'].port, 3000);
    assert.equal(config.projects['app-two'].port, 3001);
  });

  it('throws on missing projects section', () => {
    writeFileSync(join(TMP, 'starto.toml'), '[workspace]\nroot = "."');

    assert.throws(() => loadStartoToml(join(TMP, 'starto.toml')), /missing \[projects\]/);
  });

  it('parses workspace and ports config', () => {
    const toml = `
[workspace]
root = "./code"

[ports]
range = [4000, 4099]

[projects.my-app]
port = 4000
`;
    writeFileSync(join(TMP, 'starto.toml'), toml);

    const config = loadStartoToml(join(TMP, 'starto.toml'));
    assert.equal(config.workspace?.root, './code');
    assert.deepEqual(config.ports?.range, [4000, 4099]);
  });
});

describe('resolveProject', () => {
  it('uses slug as default path', () => {
    const resolved = resolveProject('my-app', { port: 3000 }, '/workspace');
    assert.equal(resolved.path, '/workspace/my-app');
  });

  it('uses explicit path when provided', () => {
    const resolved = resolveProject('my-app', { port: 3000, path: 'custom-dir' }, '/workspace');
    assert.equal(resolved.path, '/workspace/custom-dir');
  });

  it('defaults database to false', () => {
    const resolved = resolveProject('my-app', { port: 3000 }, '/workspace');
    assert.equal(resolved.database, false);
  });

  it('preserves env overrides', () => {
    const resolved = resolveProject('my-app', {
      port: 3000,
      env: { DATABASE_URL: 'test' }
    }, '/workspace');
    assert.equal(resolved.envOverrides.DATABASE_URL, 'test');
  });
});
