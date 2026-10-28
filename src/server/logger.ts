type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = {
  debug: 10, info: 20, warn: 30, error: 40,
};

function currentLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (env in LEVELS) ? (env as LogLevel) : 'info';
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (LEVELS[level] < LEVELS[currentLevel()]) return;
  const entry = { ts: new Date().toISOString(), level, msg, ...(ctx ?? {}) };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};