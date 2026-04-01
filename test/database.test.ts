import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDbName, generateDbName } from '../src/core/database.js';

describe('sanitizeDbName', () => {
  it('replaces hyphens with underscores', () => {
    assert.equal(sanitizeDbName('my-project'), 'my_project');
  });

  it('lowercases everything', () => {
    assert.equal(sanitizeDbName('MyProject'), 'myproject');
  });

  it('strips non-alphanumeric characters', () => {
    assert.equal(sanitizeDbName('my project!@#'), 'myproject');
  });

  it('handles branch names with slashes', () => {
    assert.equal(sanitizeDbName('feature/auth-fix'), 'featureauth_fix');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeDbName(''), '');
  });

  it('preserves underscores', () => {
    assert.equal(sanitizeDbName('already_under_scored'), 'already_under_scored');
  });

  it('handles W-branch naming convention', () => {
    assert.equal(sanitizeDbName('W208-client-portal-cms'), 'w208_client_portal_cms');
  });
});

describe('generateDbName', () => {
  it('combines project and branch with underscore separator', () => {
    assert.equal(
      generateDbName('controlla-app', 'W208-client-portal-cms'),
      'controlla_app_w208_client_portal_cms'
    );
  });

  it('produces deterministic output', () => {
    const a = generateDbName('my-app', 'feature-x');
    const b = generateDbName('my-app', 'feature-x');
    assert.equal(a, b);
  });

  it('produces different names for different branches', () => {
    const a = generateDbName('my-app', 'branch-a');
    const b = generateDbName('my-app', 'branch-b');
    assert.notEqual(a, b);
  });

  it('produces different names for different projects', () => {
    const a = generateDbName('app-one', 'main');
    const b = generateDbName('app-two', 'main');
    assert.notEqual(a, b);
  });

  it('handles real workspace examples', () => {
    assert.equal(
      generateDbName('trenddojo-app', 'W500-new-feature'),
      'trenddojo_app_w500_new_feature'
    );
  });
});
