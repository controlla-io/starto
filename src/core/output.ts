const COLORS = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  cyan: '\x1b[0;36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
} as const;

type Color = keyof typeof COLORS;

export function c(color: Color, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function log(color: Color, message: string): void {
  console.log(c(color, message));
}

export function info(message: string): void {
  console.log(`  ${message}`);
}

export function success(message: string): void {
  console.log(`  ${c('green', '✓')} ${message}`);
}

export function warn(message: string): void {
  console.log(`  ${c('yellow', '!')} ${message}`);
}

export function error(message: string): void {
  console.error(`  ${c('red', '✗')} ${message}`);
}

export function header(title: string): void {
  console.log();
  log('bold', title);
  log('dim', '─'.repeat(Math.min(title.length + 4, 60)));
}
