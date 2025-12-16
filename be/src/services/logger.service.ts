/**
 * @fileoverview Centralized logging service using Winston.
 * 
 * This module provides structured logging with:
 * - Console output with colors (development) or plain (production)
 * - Daily rotating file logs (logs_YYYYMMDD.log)
 * - Separate error log files (error_YYYYMMDD.log)
 * - Automatic log rotation and compression
 * - 1 year log retention policy
 * - Configurable log levels via LOG_LEVEL env variable
 * 
 * Log Levels (in order of severity):
 * - error: Error conditions requiring immediate attention
 * - warn: Warning conditions that should be reviewed
 * - info: Informational messages about normal operation
 * - debug: Detailed debugging information (development only)
 * 
 * @module services/logger
 * @example
 * import { log } from './services/logger.service.js';
 * 
 * log.info('User logged in', { userId: '123', email: 'user@example.com' });
 * log.error('Database connection failed', { error: err.message });
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { config } from '../config/index.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Log directory - relative to backend working directory */
const logDir = join(process.cwd(), 'logs');

/**
 * Custom log format for file output.
 * Format: [TIMESTAMP] [LEVEL] message {metadata}
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),  // Include stack traces for errors
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

/**
 * Console format with colors for better readability.
 * Shorter timestamp format for console output.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level} ${message}${metaStr}`;
  })
);

// ============================================================================
// LOG LEVEL CONFIGURATION
// ============================================================================

/**
 * Determine the log level based on environment configuration.
 * 
 * Priority:
 * 1. LOG_LEVEL environment variable (if valid)
 * 2. 'info' for production (less verbose)
 * 3. 'debug' for development (full details)
 * 
 * @returns The log level to use
 */
const getLogLevel = (): string => {
  const envLevel = process.env['LOG_LEVEL']?.toLowerCase();
  if (envLevel && ['error', 'warn', 'info', 'debug'].includes(envLevel)) {
    return envLevel;
  }
  return config.nodeEnv === 'production' ? 'info' : 'debug';
};

// ============================================================================
// FILE TRANSPORTS
// ============================================================================

/**
 * Daily rotating transport for all log messages.
 * Creates files like: logs_20240115.log
 * 
 * Features:
 * - Rotates daily at midnight
 * - Compresses old files with gzip
 * - Max 20MB per file
 * - Keeps 1 year (365 days) of logs
 */
const allLogsTransport: DailyRotateFile = new DailyRotateFile({
  dirname: logDir,
  filename: 'logs_%DATE%.log',
  datePattern: 'YYYYMMDD',
  zippedArchive: true,     // Compress old logs
  maxSize: '20m',          // Rotate at 20MB
  maxFiles: '365d',        // Keep 1 year of logs
  level: getLogLevel(),
  format: logFormat,
});

/**
 * Daily rotating transport for error-level logs only.
 * Creates files like: error_20240115.log
 * 
 * Separate error logs make it easier to find and analyze
 * critical issues without sifting through info/debug logs.
 * Keeps 1 year (365 days) of error logs.
 */
const errorLogsTransport: DailyRotateFile = new DailyRotateFile({
  dirname: logDir,
  filename: 'error_%DATE%.log',
  datePattern: 'YYYYMMDD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '365d',        // Keep 1 year of error logs
  level: 'error',          // Only capture error level
  format: logFormat,
});

// ============================================================================
// LOGGER INSTANCE
// ============================================================================

/**
 * Main Winston logger instance.
 * Configured with file and console transports.
 */
const logger = winston.createLogger({
  level: getLogLevel(),
  format: logFormat,
  defaultMeta: { service: 'knowledge-base-backend' },
  transports: [
    allLogsTransport,    // All logs to app-*.log
    errorLogsTransport,  // Errors only to error-*.log
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add console transport based on environment
if (config.nodeEnv !== 'production') {
  // Development: Full console output with colors
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: getLogLevel(),
  }));
} else {
  // Production: Console output at info level (for container logs)
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'info',
  }));
}

// ============================================================================
// TRANSPORT EVENT HANDLERS
// ============================================================================

// Handle file write errors (disk full, permissions, etc.)
allLogsTransport.on('error', (error) => {
  console.error('Error writing to log file:', error);
});

errorLogsTransport.on('error', (error) => {
  console.error('Error writing to error log file:', error);
});

// Log when files are rotated (for monitoring)
allLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Convenience logging methods.
 * Provides a simpler API than the full Winston logger.
 * 
 * @example
 * log.info('Server started', { port: 3001 });
 * log.error('Failed to connect', { error: err.message });
 * log.debug('Processing request', { path: '/api/data' });
 * log.warn('Rate limit approaching', { current: 95, limit: 100 });
 */
export const log = {
  /**
   * Log debug-level message (development details).
   * @param message - Log message
   * @param meta - Optional metadata object
   */
  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, meta);
  },
  /**
   * Log info-level message (normal operations).
   * @param message - Log message
   * @param meta - Optional metadata object
   */
  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, meta);
  },
  /**
   * Log warning-level message (potential issues).
   * @param message - Log message
   * @param meta - Optional metadata object
   */
  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, meta);
  },
  /**
   * Log error-level message (errors and failures).
   * @param message - Log message
   * @param meta - Optional metadata object
   */
  error: (message: string, meta?: Record<string, unknown>) => {
    logger.error(message, meta);
  },
};

/** Full Winston logger instance for advanced usage */
export { logger };

/** Default export for compatibility */
export default logger;
