const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Global format setup
const globalFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json()
);

const transports = [];

if (process.env.NODE_ENV === 'production') {
  // Production Environment: File Logging only (suppress console to save CPU and avoid stdout leakage)
  const fileRotateTransport = new winston.transports.DailyRotateFile({
    dirname: path.resolve(process.cwd(), 'logs'),
    filename: 'care-path-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
  });
  
  transports.push(fileRotateTransport);
} else {
  // Development Environment: Console Logging only
  const devFormat = combine(
    colorize({ all: true }),
    printf(
      (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
    )
  );

  transports.push(
    new winston.transports.Console({
      format: devFormat,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format: globalFormat,
  transports,
});

module.exports = logger;
