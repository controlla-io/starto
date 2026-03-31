import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectEnvOverrides } from '../types.js';

/**
 * Copy .env.local from source project to worktree, then apply overrides.
 * This preserves secrets/API keys while replacing DB URLs and ports.
 */
export function setupEnvFile(
  sourceDir: string,
  targetDir: string,
  overrides: ProjectEnvOverrides,
  variables: Record<string, string>
): { copied: boolean; overridden: string[] } {
  const sourceEnv = join(sourceDir, '.env.local');
  const targetEnv = join(targetDir, '.env.local');
  const result: { copied: boolean; overridden: string[] } = { copied: false, overridden: [] };

  // Copy base env file if it exists
  if (existsSync(sourceEnv)) {
    copyFileSync(sourceEnv, targetEnv);
    result.copied = true;
  }

  // Apply overrides
  if (Object.keys(overrides).length === 0) return result;

  // Read existing content (may be empty if no source .env.local)
  let content = existsSync(targetEnv) ? readFileSync(targetEnv, 'utf8') : '';
  const lines = content.split('\n');

  // Resolve override values — replace ${db}, ${port}, etc.
  const resolvedOverrides: Record<string, string> = {};
  for (const [key, template] of Object.entries(overrides)) {
    let value = template;
    for (const [varName, varValue] of Object.entries(variables)) {
      value = value.replace(new RegExp(`\\$\\{${varName}\\}`, 'g'), varValue);
    }
    resolvedOverrides[key] = value;
  }

  // Replace existing keys or append new ones
  const handled = new Set<string>();
  const newLines = lines.map((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match && resolvedOverrides[match[1]] !== undefined) {
      handled.add(match[1]);
      result.overridden.push(match[1]);
      return `${match[1]}=${resolvedOverrides[match[1]]}`;
    }
    return line;
  });

  // Append any overrides that weren't in the original file
  for (const [key, value] of Object.entries(resolvedOverrides)) {
    if (!handled.has(key)) {
      newLines.push(`${key}=${value}`);
      result.overridden.push(key);
    }
  }

  writeFileSync(targetEnv, newLines.join('\n'));
  return result;
}
