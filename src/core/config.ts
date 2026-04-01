import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { parse as parseTOML } from 'smol-toml';
import type { StartoToml, PersonalConfig, ResolvedProject, Framework, ProjectConfig, DatabaseType } from '../types.js';
import { detectFramework, frameworkStartCommand, detectDatabaseType } from './detect.js';

const STARTO_TOML = 'starto.toml';
const PERSONAL_CONFIG_PATH = join(
  process.env.XDG_CONFIG_HOME || join(process.env.HOME || '~', '.config'),
  'starto',
  'config.toml'
);

/**
 * Find starto.toml by walking up from cwd
 */
export function findTomlPath(from: string = process.cwd()): string | null {
  let dir = resolve(from);
  while (true) {
    const candidate = join(dir, STARTO_TOML);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// @business-critical: config parsing drives all operations — wrong parse = wrong ports, paths, commands
// MUST have unit tests before deployment
/**
 * Load and parse starto.toml
 */
export function loadStartoToml(tomlPath: string): StartoToml {
  const raw = readFileSync(tomlPath, 'utf8');
  const parsed = parseTOML(raw) as unknown as StartoToml;

  if (!parsed.projects || typeof parsed.projects !== 'object') {
    throw new Error(`${tomlPath}: missing [projects] section`);
  }

  return parsed;
}

/**
 * Load personal config (~/.config/starto/config.toml)
 */
export function loadPersonalConfig(): PersonalConfig {
  if (!existsSync(PERSONAL_CONFIG_PATH)) return {};
  const raw = readFileSync(PERSONAL_CONFIG_PATH, 'utf8');
  return parseTOML(raw) as unknown as PersonalConfig;
}

/**
 * Resolve a project config into a fully-resolved runtime object.
 * Fills in defaults, detects framework, derives start command.
 */
export function resolveProject(
  slug: string,
  config: ProjectConfig,
  workspaceRoot: string
): ResolvedProject {
  const projectPath = resolve(workspaceRoot, config.path || slug);
  const framework = config.framework || detectFramework(projectPath);
  const startCommand = config.start || frameworkStartCommand(framework, config.port);

  // Resolve database: true → auto-detect type, string → explicit type, false/undefined → no db
  let database: DatabaseType | false = false;
  if (config.database === true) {
    database = detectDatabaseType(projectPath) || 'postgresql';
  } else if (typeof config.database === 'string') {
    database = config.database;
  }

  return {
    slug,
    path: projectPath,
    port: config.port,
    framework,
    startCommand,
    database,
    setup: config.setup || null,
    envOverrides: config.env || {},
  };
}

/**
 * Load everything: starto.toml + personal config → resolved projects
 */
export function loadConfig(from?: string): {
  tomlPath: string;
  workspaceRoot: string;
  toml: StartoToml;
  personal: PersonalConfig;
  projects: Record<string, ResolvedProject>;
} {
  const tomlPath = findTomlPath(from);
  if (!tomlPath) {
    throw new Error(
      'No starto.toml found. Run `starto init` to create one, or check your working directory.'
    );
  }

  const toml = loadStartoToml(tomlPath);
  const personal = loadPersonalConfig();
  const workspaceRoot = resolve(dirname(tomlPath), toml.workspace?.root || '.');

  const projects: Record<string, ResolvedProject> = {};
  for (const [slug, config] of Object.entries(toml.projects)) {
    projects[slug] = resolveProject(slug, config, workspaceRoot);
  }

  return { tomlPath, workspaceRoot, toml, personal, projects };
}
