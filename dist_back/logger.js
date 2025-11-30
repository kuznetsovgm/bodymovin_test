"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.logRedisOperation = exports.logCacheOperation = exports.logUpload = exports.logStickerGeneration = exports.logInlineQuery = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_loki_1 = __importDefault(require("winston-loki"));
const { combine, timestamp, printf, errors, json } = winston_1.default.format;
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
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: combine(winston_1.default.format.colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), consoleFormat),
    }),
];
// Add Loki transport if in production or explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_LOKI === 'true') {
    transports.push(new winston_loki_1.default({
        host: LOKI_HOST,
        labels: {
            app: 'bodymovin-bot',
            environment: process.env.NODE_ENV || 'development',
        },
        json: true,
        format: json(),
        replaceTimestamp: true,
        onConnectionError: (err) => console.error('Loki connection error:', err),
    }));
}
// Create logger instance
exports.logger = winston_1.default.createLogger({
    level: LOG_LEVEL,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), json()),
    defaultMeta: { service: 'bodymovin-bot' },
    transports,
});
// Helper functions for structured logging
const logInlineQuery = (query, userId, success, duration) => {
    exports.logger.info('Inline query processed', {
        event: 'inline_query',
        query,
        userId,
        success,
        duration,
    });
};
exports.logInlineQuery = logInlineQuery;
const logStickerGeneration = (animationType, text, success, duration, error) => {
    exports.logger.info('Sticker generation', {
        event: 'sticker_generation',
        animationType,
        text,
        success,
        duration,
        error,
    });
};
exports.logStickerGeneration = logStickerGeneration;
const logUpload = (fileId, chatId, success, duration, error) => {
    exports.logger.info('Sticker upload', {
        event: 'sticker_upload',
        fileId,
        chatId,
        success,
        duration,
        error,
    });
};
exports.logUpload = logUpload;
const logCacheOperation = (operation, key, hit, cacheType = 'sticker') => {
    exports.logger.debug('Cache operation', {
        event: 'cache_operation',
        operation,
        key,
        hit,
        cacheType,
    });
};
exports.logCacheOperation = logCacheOperation;
const logRedisOperation = (operation, success, duration, error) => {
    exports.logger.debug('Redis operation', {
        event: 'redis_operation',
        operation,
        success,
        duration,
        error,
    });
};
exports.logRedisOperation = logRedisOperation;
const logError = (error, context) => {
    exports.logger.error('Error occurred', {
        event: 'error',
        message: error.message,
        stack: error.stack,
        ...context,
    });
};
exports.logError = logError;
// Log startup
exports.logger.info('Logger initialized', {
    level: LOG_LEVEL,
    environment: process.env.NODE_ENV || 'development',
    lokiEnabled: transports.length > 1,
});
//# sourceMappingURL=logger.js.map