const winston = require('winston');

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

// Define custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const isProduction = process.env.NODE_ENV === 'production';

// Redact stack traces in production to prevent internal/PHI leakage
const stripStackInProd = winston.format((info) => {
  if (isProduction && 'stack' in info) {
    delete info.stack;
  }
  return info;
});

const globalFormat = combine(
  errors({ stack: !isProduction }),
  stripStackInProd(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json()
);

const transports = [];

if (isProduction) {
  // Log structured JSON to stdout so --read-only rootfs works and Docker's
  // bounded local log driver manages rotation without container disk growth.
  transports.push(
    new winston.transports.Console({
      format: globalFormat,
    })
  );
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
