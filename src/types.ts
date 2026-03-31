// ============================================================================
// starto.toml — shared project registry (checked into repo)
// ============================================================================

export interface WorkspaceConfig {
  root?: string;
}

export interface PortsConfig {
  range?: [number, number];
}

export interface ProjectEnvOverrides {
  [key: string]: string;
}

export interface ProjectConfig {
  path?: string;
  port: number;
  framework?: Framework;
  start?: string;
  database?: boolean;
  setup?: string;
  env?: ProjectEnvOverrides;
}

export interface StartoToml {
  workspace?: WorkspaceConfig;
  ports?: PortsConfig;
  projects: Record<string, ProjectConfig>;
}

// ============================================================================
// ~/.config/starto/config.toml — personal preferences (not shared)
// ============================================================================

export interface DatabaseConfig {
  host?: string;
  port?: number;
}

export interface WorktreeConfig {
  dir_pattern?: string; // default: "${branch}"
}

export interface HooksConfig {
  pre_start?: string;
  post_start?: string;
  pre_new?: string;
  post_new?: string;
  pre_rm?: string;
  post_rm?: string;
}

export interface PersonalConfig {
  database?: DatabaseConfig;
  worktree?: WorktreeConfig;
  hooks?: HooksConfig;
}

// ============================================================================
// Runtime types
// ============================================================================

export type Framework = 'nextjs' | 'sveltekit' | 'vite' | 'vue' | 'django' | 'custom';

export interface ResolvedProject {
  slug: string;
  path: string;
  port: number;
  framework: Framework | null;
  startCommand: string | null;
  database: boolean;
  setup: string | null;
  envOverrides: ProjectEnvOverrides;
}

export interface EnvironmentMetadata {
  project: string;
  branch: string;
  port: number;
  path: string;
  database: string | null;
  createdAt: string;
  lastStarted: string | null;
}

export interface EnvironmentState {
  meta: EnvironmentMetadata;
  running: boolean;
  pid: number | null;
  worktreeExists: boolean;
  databaseExists: boolean;
}

export interface ProjectState {
  config: ResolvedProject;
  running: boolean;
  pid: number | null;
  environments: Record<string, EnvironmentState>;
}

// ============================================================================
// JSON output (for machine consumption — starto list --json)
// ============================================================================

export interface ListOutputProject {
  port: number;
  path: string;
  framework: string | null;
  running: boolean;
  pid: number | null;
  environments: Record<string, ListOutputEnvironment>;
}

export interface ListOutputEnvironment {
  port: number;
  path: string;
  branch: string;
  database: string | null;
  running: boolean;
  pid: number | null;
}

export interface ListOutput {
  projects: Record<string, ListOutputProject>;
}

// ============================================================================
// Hook context — variables passed to hook scripts
// ============================================================================

export interface HookContext {
  STARTO_PROJECT: string;
  STARTO_PORT: string;
  STARTO_DIR: string;
  STARTO_BRANCH: string;
  STARTO_DB: string;
  STARTO_PID: string;
}
