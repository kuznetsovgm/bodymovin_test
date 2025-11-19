import winston from 'winston';
import LokiTransport from 'winston-loki';

const { combine, timestamp, printf, errors, json } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

// Determine log level from environment variable
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOKI_HOST = process.env.LOKI_HOST || 'http://loki:3100';

// Create transports array
const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
        format: combine(
            winston.format.colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            consoleFormat
        ),
    }),
];

// Add Loki transport if in production or explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_LOKI === 'true') {
    transports.push(
        new LokiTransport({
            host: LOKI_HOST,
            labels: {
                app: 'bodymovin-bot',
                environment: process.env.NODE_ENV || 'development',
            },
            json: true,
            format: json(),
            replaceTimestamp: true,
            onConnectionError: (err) => console.error('Loki connection error:', err),
        })
    );
}

// Create logger instance
export const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        json()
    ),
    defaultMeta: { service: 'bodymovin-bot' },
    transports,
});

// Helper functions for structured logging
export const logInlineQuery = (query: string, userId: number, success: boolean, duration?: number) => {
    logger.info('Inline query processed', {
        event: 'inline_query',
        query,
        userId,
        success,
        duration,
    });
};

export const logStickerGeneration = (
    animationType: string,
    text: string,
    success: boolean,
    duration: number,
    error?: string
) => {
    logger.info('Sticker generation', {
        event: 'sticker_generation',
        animationType,
        text,
        success,
        duration,
        error,
    });
};

export const logUpload = (fileId: string, chatId: string, success: boolean, duration: number, error?: string) => {
    logger.info('Sticker upload', {
        event: 'sticker_upload',
        fileId,
        chatId,
        success,
        duration,
        error,
    });
};

export const logCacheOperation = (operation: string, key: string, hit: boolean, cacheType: string = 'sticker') => {
    logger.debug('Cache operation', {
        event: 'cache_operation',
        operation,
        key,
        hit,
        cacheType,
    });
};

export const logRedisOperation = (operation: string, success: boolean, duration?: number, error?: string) => {
    logger.debug('Redis operation', {
        event: 'redis_operation',
        operation,
        success,
        duration,
        error,
    });
};

export const logError = (error: Error, context?: Record<string, any>) => {
    logger.error('Error occurred', {
        event: 'error',
        message: error.message,
        stack: error.stack,
        ...context,
    });
};

// Log startup
logger.info('Logger initialized', {
    level: LOG_LEVEL,
    environment: process.env.NODE_ENV || 'development',
    lokiEnabled: transports.length > 1,
});
