import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ListOutput } from '../src/types.js';

describe('ListOutput JSON contract', () => {
  it('has the expected shape for machine consumers', () => {
    // This test documents the JSON output contract that Controlla depends on.
    // Changing this shape is a breaking change for all integrations.
    const output: ListOutput = {
      projects: {
        'my-app': {
          port: 3000,
          path: '/workspace/my-app',
          framework: 'nextjs',
          running: true,
          pid: 12345,
          environments: {
            'W208-feature': {
              port: 3007,
              path: '/workspace/W208-feature',
              branch: 'W208-feature',
              database: 'my_app_w208_feature',
              running: false,
              pid: null,
            },
          },
        },
      },
    };

    // Verify required fields exist at project level
    const project = output.projects['my-app'];
    assert.equal(typeof project.port, 'number');
    assert.equal(typeof project.path, 'string');
    assert.equal(typeof project.running, 'boolean');

    // Verify required fields exist at environment level
    const env = project.environments['W208-feature'];
    assert.equal(typeof env.port, 'number');
    assert.equal(typeof env.path, 'string');
    assert.equal(typeof env.branch, 'string');
    assert.equal(typeof env.running, 'boolean');

    // Verify nullable fields
    assert.ok(project.framework === null || typeof project.framework === 'string');
    assert.ok(project.pid === null || typeof project.pid === 'number');
    assert.ok(env.database === null || typeof env.database === 'string');
    assert.ok(env.pid === null || typeof env.pid === 'number');
  });
});
