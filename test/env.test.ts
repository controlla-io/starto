import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { setupEnvFile } from '../src/core/env.js';

const TMP = join(import.meta.dirname, '.tmp-env-test');
const SRC = join(TMP, 'source');
const TGT = join(TMP, 'target');

describe('setupEnvFile', () => {
  beforeEach(() => {
    mkdirSync(SRC, { recursive: true });
    mkdirSync(TGT, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it('copies .env.local from source to target', () => {
    writeFileSync(join(SRC, '.env.local'), 'API_KEY=secret123\nPORT=3000\n');

    const result = setupEnvFile(SRC, TGT, {}, {});
    assert.equal(result.copied, true);

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('API_KEY=secret123'));
  });

  it('overrides existing keys in copied file', () => {
    writeFileSync(join(SRC, '.env.local'), 'DATABASE_URL=prod-url\nAPI_KEY=secret\n');

    const result = setupEnvFile(SRC, TGT, { DATABASE_URL: 'local-url' }, {});
    assert.ok(result.overridden.includes('DATABASE_URL'));

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('DATABASE_URL=local-url'));
    assert.ok(content.includes('API_KEY=secret'));
    assert.ok(!content.includes('prod-url'));
  });

  it('appends new keys not in original file', () => {
    writeFileSync(join(SRC, '.env.local'), 'API_KEY=secret\n');

    const result = setupEnvFile(SRC, TGT, { NEW_VAR: 'new-value' }, {});
    assert.ok(result.overridden.includes('NEW_VAR'));

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('NEW_VAR=new-value'));
    assert.ok(content.includes('API_KEY=secret'));
  });

  it('resolves ${db} variable in override values', () => {
    writeFileSync(join(SRC, '.env.local'), 'DATABASE_URL=old\n');

    setupEnvFile(SRC, TGT, { DATABASE_URL: 'postgresql://localhost:5432/${db}' }, { db: 'my_test_db' });

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('DATABASE_URL=postgresql://localhost:5432/my_test_db'));
  });

  it('handles missing source .env.local gracefully', () => {
    const result = setupEnvFile(SRC, TGT, { DATABASE_URL: 'some-url' }, {});
    assert.equal(result.copied, false);

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('DATABASE_URL=some-url'));
  });

  it('preserves non-overridden keys exactly', () => {
    writeFileSync(join(SRC, '.env.local'), 'SECRET_A=aaa\nSECRET_B=bbb\nDATABASE_URL=old\n');

    setupEnvFile(SRC, TGT, { DATABASE_URL: 'new' }, {});

    const content = readFileSync(join(TGT, '.env.local'), 'utf8');
    assert.ok(content.includes('SECRET_A=aaa'));
    assert.ok(content.includes('SECRET_B=bbb'));
    assert.ok(content.includes('DATABASE_URL=new'));
  });
});
