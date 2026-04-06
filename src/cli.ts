#!/usr/bin/env node

import { commandInit } from './commands/init.js';
import { commandList } from './commands/list.js';
import { commandStart } from './commands/start.js';
import { commandNew } from './commands/new.js';
import { commandRm } from './commands/rm.js';
import { commandStop } from './commands/stop.js';
import { commandGc } from './commands/gc.js';
import { c } from './core/output.js';

const VERSION = '0.1.2';
const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

function showHelp(): void {
  console.log(`
${c('bold', 'starto')} ${c('dim', `v${VERSION}`)} — local dev environment multiplexing

${c('bold', 'USAGE')}
  starto                    Start dev server for current project
  starto new <branch>       Create parallel environment (worktree + db + env)
  starto list [--json]      Show all projects and environments
  starto stop [name]        Stop a running dev server
  starto rm <branch>        Tear down environment completely
  starto gc [--yes]         Find and clean orphaned resources
  starto init               Scan workspace, generate starto.toml

${c('bold', 'OPTIONS')}
  starto new <branch>
    --project <slug>        Target project (auto-detected from cwd)
    --create                Create the git branch if it doesn't exist
    --no-install            Skip npm/pnpm/bun install
    --no-setup              Skip setup command

  starto start
    --live, -l              Foreground with live output

  starto rm <branch>
    --force, -f             Remove even if in use

  starto gc
    --yes, -y               Execute cleanup (default: dry run)
    --stop                  Also stop running servers

${c('bold', 'EXAMPLES')}
  starto                                  # Start current project
  starto new W208-client-portal-cms       # Parallel environment
  starto list --json                      # Machine-readable state
  starto rm W208-client-portal-cms        # Full teardown
  starto gc --yes                         # Clean orphaned resources

${c('dim', 'Config: starto.toml (shared) + ~/.config/starto/config.toml (personal)')}
`);
}

async function main(): Promise<void> {
  try {
    switch (command) {
      case undefined:
      case 'start':
        commandStart(command === 'start' ? commandArgs : args);
        break;
      case 'new':
        await commandNew(commandArgs);
        break;
      case 'list':
      case 'ls':
        commandList(commandArgs);
        break;
      case 'stop':
        commandStop(commandArgs);
        break;
      case 'rm':
      case 'remove':
        commandRm(commandArgs);
        break;
      case 'gc':
        commandGc(commandArgs);
        break;
      case 'init':
        commandInit(commandArgs);
        break;
      case '--version':
      case '-v':
        console.log(VERSION);
        break;
      case '--help':
      case '-h':
      case 'help':
        showHelp();
        break;
      default:
        // If argument looks like a path, treat as start
        if (!command.startsWith('-')) {
          commandStart(args);
        } else {
          console.error(`Unknown command: ${command}`);
          showHelp();
          process.exit(1);
        }
    }
  } catch (err: any) {
    console.error(`\n  ${c('red', '✗')} ${err.message}`);
    process.exit(1);
  }
}

main();
