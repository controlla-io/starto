# starto

Run multiple branches of your project at the same time — each with its own server, database, and port.

```bash
$ starto new fix-auth
  ✓ Worktree created
  ✓ Database created: my_app_fix_auth
  ✓ Port assigned: 3001
  ✓ Ready: ~/fix-auth on :3001

$ starto new redesign
  ✓ Worktree created
  ✓ Database created: my_app_redesign
  ✓ Port assigned: 3002
  ✓ Ready: ~/redesign on :3002

$ starto list
  PROJECT    PORT   STATUS
  my-app     3000   running     ← your main branch, untouched
    fix-auth    3001   running     ← isolated hotfix
    redesign    3002   stopped     ← isolated feature
```

One codebase. Concurrent branches. Isolated databases. Managed ports. No conflicts.

## What it does

Starto manages the full lifecycle of parallel development environments:

- **Concurrent branches** — multiple branches of the same project checked out and running simultaneously, via git worktrees
- **Instant databases** — each branch gets its own local Postgres database, created and migrated automatically
- **Intelligent ports** — automatic assignment from a configurable range, no conflicts, persistent across restarts
- **Environment isolation** — each branch gets its own `.env.local` with the correct database URL and port
- **Complete cleanup** — one command tears down everything: server, database, worktree, config. Nothing leaked.

Think of it as Docker-level isolation for local development — but instant, no containers, and using your actual tools (Node, Postgres, git).

## The problem it solves

You're mid-feature, dev server running. A bug report comes in. You need that fix running too — on a different branch, with its own database, at the same time.

Your options today are all bad:

- **`git stash` and switch** — kills your running server, risks stash conflicts
- **Commit half-done work** — pollutes history, may not build
- **Clone the repo again** — 15 minutes of npm install, env files, port juggling
- **Docker Compose** — heavy, slow startup, complex YAML for local dev
- **Raw `git worktree`** — handles code, but not your database, port, or env files

Starto handles all of it. One command up, one command down.

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

**`starto new feature-x`** creates a fully isolated environment:

1. `git worktree add` — parallel checkout, no stashing
2. `createdb` — isolated local database
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

Returns structured JSON with all projects, environments, ports, PIDs, and database names. Built for integration with other tools.

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
