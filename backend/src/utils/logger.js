import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const LOG_DIR = process.env.LOG_DIR || '/var/log/udpst';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    try {
      mkdirSync(LOG_DIR, { recursive: true });
    } catch (error) {
      console.warn(`Could not create log directory ${LOG_DIR}: ${error.message}`);
      console.warn('Logging will be console-only');
      return false;
    }
  }
  return true;
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0 && meta.constructor === Object) {
      log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  })
];

const canWriteLogs = ensureLogDir();

if (canWriteLogs) {
  transports.push(
    new DailyRotateFile({
      filename: `${LOG_DIR}/udpst-api-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: customFormat,
      level: 'info'
    })
  );

  transports.push(
    new DailyRotateFile({
      filename: `${LOG_DIR}/udpst-api-error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat,
      level: 'error'
    })
  );
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports,
  exitOnError: false
});

export function logRequest(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    logger.info(`${method} ${originalUrl}`, {
      statusCode,
      duration: `${duration}ms`,
      ip: ip || req.connection.remoteAddress
    });
  });

  next();
}

logger.info(`Logger initialized (level: ${LOG_LEVEL}, directory: ${LOG_DIR}, file logging: ${canWriteLogs})`);
