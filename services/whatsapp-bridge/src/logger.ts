import { config } from './config.js';

const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof levels;

function shouldLog(level: Level): boolean {
  return levels[level] >= levels[config.LOG_LEVEL];
}

function stamp(): string {
  return new Date().toISOString();
}

export const log = {
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) console.log(`[${stamp()}] [debug]`, ...args);
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) console.log(`[${stamp()}] [info]`, ...args);
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) console.warn(`[${stamp()}] [warn]`, ...args);
  },
  error: (...args: unknown[]) => {
    if (shouldLog('error')) console.error(`[${stamp()}] [error]`, ...args);
  },
};
