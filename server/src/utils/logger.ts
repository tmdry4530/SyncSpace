export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50
}

function shouldLog(configured: LogLevel, target: LogLevel): boolean {
  return levelOrder[target] >= levelOrder[configured]
}

function write(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {})
  }

  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.log(line)
}

export function createLogger(level: LogLevel = 'info'): Logger {
  return {
    debug(message, meta) {
      if (shouldLog(level, 'debug')) write('debug', message, meta)
    },
    info(message, meta) {
      if (shouldLog(level, 'info')) write('info', message, meta)
    },
    warn(message, meta) {
      if (shouldLog(level, 'warn')) write('warn', message, meta)
    },
    error(message, meta) {
      if (shouldLog(level, 'error')) write('error', message, meta)
    }
  }
}

export const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {}
}
