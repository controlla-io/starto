import { resolve, join, dirname } from 'node:path';
import { existsSync as fileExists, readFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadConfig } from '../core/config.js';
import { branchExists, createWorktree } from '../core/worktree.js';
import { generateDbName, createDatabase, isDatabaseAvailable } from '../core/database.js';
import { setupEnvFile, loadEnvFile } from '../core/env.js';
import { findAvailablePort } from '../core/ports.js';
import { saveMetadata, loadMetadata, listAllMetadata } from '../core/metadata.js';
import { detectPackageManager } from '../core/detect.js';
import { runHook, buildHookContext } from '../core/hooks.js';
import { header, success, warn, error, info, c } from '../core/output.js';
import type { EnvironmentMetadata } from '../types.js';

export async function commandNew(args: string[]): Promise<void> {
  const createBranch = args.includes('--create');
  const noInstall = args.includes('--no-install');
  const noSetup = args.includes('--no-setup');
  const positional = args.filter((a) => !a.startsWith('-'));

  if (positional.length < 1) {
    error('Usage: starto new <branch> [--project <slug>] [--create] [--no-install] [--no-setup]');
    process.exit(1);
  }

  const branch = positional[0];
  const { projects, personal, workspaceRoot, toml } = loadConfig();

  // Determine which project this is for
  // If in a project directory, use that. Otherwise require --project.
  let slug: string | null = null;
  const projectArg = args.indexOf('--project');
  if (projectArg >= 0 && args[projectArg + 1]) {
    slug = args[projectArg + 1];
  } else {
    // Detect from cwd
    const cwd = process.cwd();
    for (const [s, p] of Object.entries(projects)) {
      if (cwd.startsWith(p.path)) {
        slug = s;
        break;
      }
    }
  }

  if (!slug || !projects[slug]) {
    error('Could not determine project. Run from a project directory or use --project <slug>.');
    info(`Available: ${Object.keys(projects).join(', ')}`);
    process.exit(1);
  }

  const project = projects[slug];

  // Check for existing environment
  const existingMeta = loadMetadata(branch);
  if (existingMeta) {
    warn(`Environment already exists for ${branch}`);
    info(`Path: ${existingMeta.path}`);
    info(`Port: ${existingMeta.port}`);
    process.exit(0);
  }

  header(`starto new — ${slug} → ${branch}`);

  // Run pre_new hook
  runHook(personal.hooks, 'pre_new', buildHookContext({ project: slug, branch }));

  // Resolve worktree directory — default: project/.starto/branch
  const dirPattern = personal.worktree?.dir_pattern || '${project}/.starto/${branch}';
  const dirName = dirPattern.replace('${branch}', branch).replace('${project}', slug);
  const worktreePath = resolve(workspaceRoot, dirName);

  // Step 1: Validate branch
  if (!createBranch && !branchExists(project.path, branch)) {
    error(`Branch '${branch}' does not exist. Use --create to create it.`);
    process.exit(1);
  }

  // Step 2: Create worktree
  info(`Creating worktree at ${c('cyan', worktreePath)}...`);
  const wt = createWorktree(project.path, worktreePath, branch, createBranch);
  if (wt.error && !wt.created) {
    error(`Worktree: ${wt.error}`);
    process.exit(1);
  }
  success('Worktree created.');

  // Ensure .starto/ is in the project's .gitignore
  const gitignorePath = join(project.path, '.gitignore');
  if (fileExists(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.starto')) {
      appendFileSync(gitignorePath, '\n# Starto parallel environments\n.starto/\n');
      success('Added .starto/ to .gitignore');
    }
  }

  // Step 3: Database (if configured)
  let dbName: string | null = null;
  if (project.database) {
    const dbType = project.database;
    const dbHost = personal.database?.host || 'localhost';
    const dbPort = personal.database?.port || 5432;
    const dataDir = worktreePath; // SQLite files live in the worktree

    if (!isDatabaseAvailable(dbHost, dbPort, dbType, dataDir)) {
      warn(`${dbType} not available. Skipping database creation.`);
    } else {
      dbName = generateDbName(slug, branch);
      info(`Creating ${dbType} database ${c('cyan', dbName)}...`);
      const db = createDatabase(dbName, dbHost, dbPort, dbType, dataDir);
      if (db.error) {
        warn(`Database: ${db.error}`);
      } else if (db.created) {
        success('Database created.');
      } else {
        info('Database already exists.');
      }
    }
  }

  // Step 4: Assign port
  const portRange = toml.ports?.range || [project.port + 1, project.port + 99];
  // Collect ALL used ports: every project's main port + every environment's port
  const allExistingMeta = listAllMetadata();
  const usedPorts = new Set(allExistingMeta.map((m) => m.port));
  for (const p of Object.values(projects)) {
    usedPorts.add(p.port);
  }

  const assignedPort = await findAvailablePort(portRange[0], portRange[1], usedPorts);
  if (!assignedPort) {
    warn(`No available ports in range ${portRange[0]}-${portRange[1]}. Using main port +1.`);
  }
  const envPort = assignedPort || project.port + 1;

  // Step 5: Env file — only apply DB overrides if we actually created a database
  info('Setting up environment...');
  const envVars: Record<string, string> = {
    port: String(envPort),
    user: process.env.USER || process.env.USERNAME || 'postgres',
  };
  const activeOverrides = { ...project.envOverrides };
  if (dbName) {
    envVars.db = dbName;
  } else {
    // Remove any overrides that reference ${db} — they'd resolve to empty
    for (const [key, val] of Object.entries(activeOverrides)) {
      if (val.includes('${db}')) delete activeOverrides[key];
    }
  }
  const envResult = setupEnvFile(project.path, worktreePath, activeOverrides, envVars);
  if (envResult.copied) {
    success('.env.local copied from main project.');
  }
  if (envResult.overridden.length > 0) {
    success(`Overridden: ${envResult.overridden.join(', ')}`);
  }

  // Step 6: Install dependencies
  if (!noInstall) {
    const pm = detectPackageManager(worktreePath) || detectPackageManager(project.path);
    if (pm) {
      info(`Installing dependencies (${pm})...`);
      try {
        execSync(`${pm} install`, {
          cwd: worktreePath,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 120000,
        });
        success('Dependencies installed.');
      } catch (err: any) {
        warn(`Install failed: ${err.stderr?.split('\n')[0] || err.message}`);
        warn('You can run it manually later.');
      }
    }
  }

  // Step 7: Run setup command
  if (!noSetup && project.setup) {
    info(`Running setup: ${c('dim', project.setup)}...`);
    try {
      execSync(project.setup, {
        cwd: worktreePath,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000,
        env: {
          ...process.env,
          STARTO_DB: dbName || '',
          // Read DATABASE_URL and DIRECT_URL from the .env.local we just wrote
          // rather than constructing URLs (which miss username, socket path, etc.)
          ...loadEnvFile(join(worktreePath, '.env.local')),
        },
      });
      success('Setup complete.');
    } catch (err: any) {
      warn(`Setup failed: ${err.stderr?.split('\n')[0] || err.message}`);
      warn('You can run it manually later.');
    }
  }

  // Step 8: Save metadata
  const meta: EnvironmentMetadata = {
    project: slug,
    branch,
    port: envPort,
    path: worktreePath,
    database: dbName,
    createdAt: new Date().toISOString(),
    lastStarted: null,
  };
  saveMetadata(meta);

  // Run post_new hook
  runHook(personal.hooks, 'post_new', buildHookContext({
    project: slug, port: envPort, dir: worktreePath, branch, db: dbName,
  }));

  // Summary
  console.log();
  success(`Environment ready: ${c('bold', branch)}`);
  info(`${c('dim', 'path')}  ${worktreePath}`);
  info(`${c('dim', 'port')}  ${envPort}`);
  if (dbName) info(`${c('dim', 'db')}    ${dbName}`);
  info(`\nRun ${c('cyan', `cd ${worktreePath} && starto`)} to start the dev server.`);
}
