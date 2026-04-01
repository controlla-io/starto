# starto

One codebase. Work on multiple branches at the same time. No stashing. No conflicts. No leaked state.

```
~/my-app/                    ← main branch, running on :3000
~/fix-auth-bug/              ← hotfix branch, running on :3001, own database
~/new-dashboard/             ← feature branch, running on :3002, own database
```

Three branches. Three running servers. Three isolated databases. One codebase. Zero conflicts.

## The problem

You're mid-feature on branch A, dev server running. A bug report comes in — you need branch B running too. Your options are all bad:

- `git stash` and switch — kills your running server, risky stash conflicts
- Commit half-done work — pollutes history, may not even build
- Clone the repo again — 15 minutes of npm install, env setup, port juggling
- Docker Compose — heavy, slow startup, complex config for local dev
- Raw `git worktree` — handles code, but not your database, ports, or env files

## The solution

```bash
starto new fix-auth-bug
```

One command. Creates a git worktree, a local database, copies your env config, installs dependencies, and assigns a free port. Your original branch keeps running untouched. Both branches serve simultaneously on different ports.

Think of it as `docker-compose` for local branch development — but instant, no containers, no YAML, and it uses your actual local tools (Node, Postgres, etc.).

## Install

```bash
npm install -g @controlla/starto
```

Requires Node.js 18+ and git. PostgreSQL optional (only needed if your project uses a database).

## Quick start

```bash
# Generate config from your workspace
starto init

# See your projects
starto list

# Start dev server (correct port, every time)
starto

# Create a parallel environment
starto new feature-branch

# Clean up when done
starto rm feature-branch
```

## Commands

| Command | What it does |
|---|---|
| `starto` | Start dev server for current project |
| `starto new <branch>` | Create parallel environment (worktree + db + env) |
| `starto list` | Show all projects and environments |
| `starto stop [name]` | Stop a running dev server |
| `starto rm <branch>` | Tear down environment completely |
| `starto gc` | Find and clean orphaned resources |
| `starto init` | Scan workspace, generate starto.toml |

## Configuration

### starto.toml (checked into your repo)

```toml
[projects.my-app]
port = 3000
database = true
setup = "npx prisma migrate deploy"

[projects.my-app.env]
DATABASE_URL = "postgresql://localhost:5432/${db}"
```

### ~/.config/starto/config.toml (personal, not shared)

```toml
[database]
host = "localhost"
port = 5432

[hooks]
post_start = "my-script.sh $STARTO_PROJECT $STARTO_PORT"
post_new = "my-script.sh $STARTO_PROJECT $STARTO_BRANCH"
```

## How it works

**`starto new feature-x`** does this:

1. `git worktree add` — parallel checkout, no stashing
2. `createdb` — isolated local database (if configured)
3. Copy `.env.local` from main project, override DB URL and port
4. `npm install` — fresh dependencies
5. Run your setup command (migrations, seed, etc.)
6. Assign an available port from your range

**`starto rm feature-x`** reverses everything:

1. Check nothing is using the environment (refuse if in use)
2. Stop dev server
3. `dropdb` — remove the local database
4. `git worktree remove` — clean up the directory
5. Remove metadata

## Safety

- **Refuse-by-default**: `starto rm` won't remove an environment with running processes
- **Idempotent**: Running `starto new` twice for the same branch is safe
- **No state drift**: Starto discovers state from git, the OS, and Postgres — no state file to corrupt
- **Race-condition safe**: `createdb` and `git worktree add` fail atomically on collision
- **`starto gc`**: Finds orphaned databases, worktrees, and metadata. Dry-run by default.

## Machine-readable output

```bash
starto list --json
```

Returns structured JSON with all projects, environments, ports, PIDs, and database names. Useful for integrating with other tools.

## Hook variables

All hooks receive these environment variables:

| Variable | Description |
|---|---|
| `$STARTO_PROJECT` | Project slug |
| `$STARTO_PORT` | Assigned port |
| `$STARTO_DIR` | Environment directory path |
| `$STARTO_BRANCH` | Git branch name |
| `$STARTO_DB` | Database name (if applicable) |
| `$STARTO_PID` | Process ID (post_start only) |

## License

MIT
