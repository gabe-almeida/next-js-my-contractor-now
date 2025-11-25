import winston from 'winston';
import { sanitizeLogData } from './security';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: process.env.NODE_ENV !== 'production' }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // Sanitize all log data to remove sensitive information
      const sanitizedMeta = sanitizeLogData(meta);
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...sanitizedMeta
      });
    })
  ),
  defaultMeta: {
    service: 'contractor-platform-api'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  );
}

// Request logger middleware helper
export function logRequest(req: any, res: any, duration?: number) {
  const logData = {
    method: req.method,
    url: req.url,
    userAgent: req.headers?.['user-agent'] ? 'present' : 'missing', // Don't log full user agent
    ip: req.ip ? 'present' : 'missing', // Don't log actual IP
    duration: duration ? `${duration}ms` : undefined,
    statusCode: res.statusCode,
    requestId: req.headers?.['x-request-id']
  };
  
  if (res.statusCode >= 400) {
    logger.warn('HTTP Request Error', sanitizeLogData(logData));
  } else {
    logger.info('HTTP Request', sanitizeLogData(logData));
  }
}

// API error logger
export function logApiError(error: Error, context: any = {}) {
  const errorData = {
    message: error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    ...context
  };
  
  logger.error('API Error', sanitizeLogData(errorData));
}

// Lead processing logger
export function logLeadProcessing(leadId: string, action: string, details: any = {}) {
  logger.info('Lead Processing', sanitizeLogData({
    leadId: leadId ? 'present' : 'missing', // Don't log actual lead ID
    action,
    ...details
  }));
}

// Buyer interaction logger
export function logBuyerInteraction(buyerId: string, action: string, details: any = {}) {
  logger.info('Buyer Interaction', sanitizeLogData({
    buyerId: buyerId ? 'present' : 'missing', // Don't log actual buyer ID
    action,
    ...details
  }));
}

export default logger;