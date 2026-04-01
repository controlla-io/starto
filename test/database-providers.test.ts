import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProvider } from '../src/core/database.js';

const TMP = join(import.meta.dirname, '.tmp-db-provider-test');

describe('SQLite provider', () => {
  const sqlite = getProvider('sqlite');
  const opts = { host: 'localhost', port: 0, dataDir: TMP };

  beforeEach(() => {
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('is always available', () => {
    assert.equal(sqlite.available(opts), true);
  });

  it('creates a .db file', () => {
    const result = sqlite.create('test_db', opts);
    assert.equal(result.created, true);
    assert.ok(existsSync(join(TMP, 'test_db.db')));
  });

  it('reports exists after creation', () => {
    assert.equal(sqlite.exists('test_db', opts), false);
    sqlite.create('test_db', opts);
    assert.equal(sqlite.exists('test_db', opts), true);
  });

  it('is idempotent on create', () => {
    sqlite.create('test_db', opts);
    const result = sqlite.create('test_db', opts);
    assert.equal(result.created, false);
    assert.equal(result.error, undefined);
  });

  it('drops a database', () => {
    sqlite.create('test_db', opts);
    const result = sqlite.drop('test_db', opts);
    assert.equal(result.dropped, true);
    assert.equal(existsSync(join(TMP, 'test_db.db')), false);
  });

  it('is idempotent on drop', () => {
    const result = sqlite.drop('nonexistent', opts);
    assert.equal(result.dropped, true);
  });

  it('lists databases by prefix', () => {
    sqlite.create('myapp_feature_a', opts);
    sqlite.create('myapp_feature_b', opts);
    sqlite.create('other_db', opts);

    const list = sqlite.list('myapp_', opts);
    assert.equal(list.length, 2);
    assert.ok(list.includes('myapp_feature_a'));
    assert.ok(list.includes('myapp_feature_b'));
    assert.ok(!list.includes('other_db'));
  });
});

describe('Provider registry', () => {
  it('returns postgresql provider', () => {
    const pg = getProvider('postgresql');
    assert.equal(typeof pg.create, 'function');
    assert.equal(typeof pg.drop, 'function');
    assert.equal(typeof pg.exists, 'function');
    assert.equal(typeof pg.available, 'function');
    assert.equal(typeof pg.list, 'function');
  });

  it('returns mysql provider', () => {
    const my = getProvider('mysql');
    assert.equal(typeof my.create, 'function');
    assert.equal(typeof my.drop, 'function');
    assert.equal(typeof my.exists, 'function');
    assert.equal(typeof my.available, 'function');
    assert.equal(typeof my.list, 'function');
  });

  it('returns sqlite provider', () => {
    const sq = getProvider('sqlite');
    assert.equal(typeof sq.create, 'function');
  });

  it('throws on unknown provider', () => {
    assert.throws(() => getProvider('redis' as any), /Unknown database provider/);
  });
});
