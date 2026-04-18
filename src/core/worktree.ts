import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface WorktreeEntry {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
}

/**
 * List all git worktrees for the repository at the given path
 */
export function listWorktrees(repoPath: string): WorktreeEntry[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const entries: WorktreeEntry[] = [];
    let current: Partial<WorktreeEntry> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) entries.push(current as WorktreeEntry);
        current = { path: line.slice(9), bare: false };
      } else if (line.startsWith('HEAD ')) {
        current.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        current.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        current.bare = true;
      } else if (line === '' && current.path) {
        entries.push(current as WorktreeEntry);
        current = {};
      }
    }
    if (current.path) entries.push(current as WorktreeEntry);

    return entries.filter((e) => !e.bare);
  } catch {
    return [];
  }
}

/**
 * Create a new worktree for a branch.
 * Returns the worktree path, or null if it already exists.
 */
export function createWorktree(
  repoPath: string,
  worktreePath: string,
  branch: string,
  createBranch: boolean = false
): { created: boolean; path: string; error?: string } {
  const absPath = resolve(worktreePath);

  if (existsSync(absPath)) {
    return { created: false, path: absPath, error: 'Directory already exists' };
  }

  // Check if branch is already checked out in another worktree
  const existing = listWorktrees(repoPath);
  const alreadyCheckedOut = existing.find((w) => w.branch === branch);
  if (alreadyCheckedOut) {
    return {
      created: false,
      path: alreadyCheckedOut.path,
      error: `Branch '${branch}' is already checked out at ${alreadyCheckedOut.path}`,
    };
  }

  try {
    const cmd = createBranch
      ? `git worktree add -b "${branch}" "${absPath}"`
      : `git worktree add "${absPath}" "${branch}"`;
    execSync(cmd, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { created: true, path: absPath };
  } catch (err: any) {
    return { created: false, path: absPath, error: err.stderr?.trim() || err.message };
  }
}

/**
 * Remove a worktree. Checks for uncommitted changes unless force=true.
 */
export function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean = false
): { removed: boolean; error?: string } {
  if (!existsSync(worktreePath)) {
    return { removed: true }; // Already gone
  }

  try {
    const flag = force ? '--force' : '';
    execSync(`git worktree remove ${flag} "${worktreePath}"`, {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { removed: true };
  } catch (err: any) {
    return { removed: false, error: err.stderr?.trim() || err.message };
  }
}

/**
 * Check if a git branch exists (locally)
 */
export function branchExists(repoPath: string, branch: string): boolean {
  try {
    execSync(`git rev-parse --verify "refs/heads/${branch}"`, {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}
