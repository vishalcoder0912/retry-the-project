const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel;

  private constructor() {
    this.minLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    if (import.meta.env.PROD) {
      return "error";
    }
    if (import.meta.env.DEV) {
      return "debug";
    }
    return "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
    };

    const formatted = this.formatEntry(entry);

    if (level === "error" || level === "warn") {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  error(message: string, context?: Record<string, unknown>, error?: Error) {
    this.log("error", message, context, error);
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log("warn", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
}

export const logger = Logger.getInstance();
export default logger;