"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthStatus = exports.workerTasksCompletedTotal = exports.workerTaskDuration = exports.workerPoolQueueSize = exports.workerPoolActiveWorkers = exports.queueSize = exports.activeUsers = exports.telegramApiDuration = exports.telegramApiCalls = exports.redisConnectionStatus = exports.redisOperationsTotal = exports.cacheSize = exports.cacheMissesTotal = exports.cacheHitsTotal = exports.uploadDuration = exports.stickerGenerationDuration = exports.errorsTotal = exports.stickersGeneratedTotal = exports.inlineQueriesTotal = exports.register = void 0;
const prom_client_1 = require("prom-client");
// Create a Registry to register the metrics
exports.register = new prom_client_1.Registry();
// Collect default metrics (CPU, memory, etc.)
(0, prom_client_1.collectDefaultMetrics)({ register: exports.register });
// Custom metrics for the bot
// Counter: Total number of inline queries
exports.inlineQueriesTotal = new prom_client_1.Counter({
    name: 'bot_inline_queries_total',
    help: 'Total number of inline queries received',
    labelNames: ['status'], // success, error, debounced
    registers: [exports.register],
});
// Counter: Total number of stickers generated
exports.stickersGeneratedTotal = new prom_client_1.Counter({
    name: 'bot_stickers_generated_total',
    help: 'Total number of stickers generated',
    labelNames: ['animation_type', 'status'], // animation type (slide, rotate, etc), success/error
    registers: [exports.register],
});
// Counter: Total number of errors
exports.errorsTotal = new prom_client_1.Counter({
    name: 'bot_errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type'], // generation_error, upload_error, cache_error, etc.
    registers: [exports.register],
});
// Histogram: Sticker generation duration
exports.stickerGenerationDuration = new prom_client_1.Histogram({
    name: 'bot_sticker_generation_duration_seconds',
    help: 'Duration of sticker generation in seconds',
    labelNames: ['animation_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10], // 100ms, 500ms, 1s, 2s, 5s, 10s
    registers: [exports.register],
});
// Histogram: Upload duration
exports.uploadDuration = new prom_client_1.Histogram({
    name: 'bot_upload_duration_seconds',
    help: 'Duration of sticker upload to Telegram in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30], // 500ms to 30s
    registers: [exports.register],
});
// Cache metrics
exports.cacheHitsTotal = new prom_client_1.Counter({
    name: 'bot_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type'], // sticker, config, etc.
    registers: [exports.register],
});
exports.cacheMissesTotal = new prom_client_1.Counter({
    name: 'bot_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type'],
    registers: [exports.register],
});
exports.cacheSize = new prom_client_1.Gauge({
    name: 'bot_cache_size_bytes',
    help: 'Current size of cache in bytes',
    labelNames: ['cache_type'],
    registers: [exports.register],
});
// Redis metrics
exports.redisOperationsTotal = new prom_client_1.Counter({
    name: 'bot_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'], // get/set/del, success/error
    registers: [exports.register],
});
exports.redisConnectionStatus = new prom_client_1.Gauge({
    name: 'bot_redis_connection_status',
    help: 'Redis connection status (1 = connected, 0 = disconnected)',
    registers: [exports.register],
});
// Telegram API metrics
exports.telegramApiCalls = new prom_client_1.Counter({
    name: 'bot_telegram_api_calls_total',
    help: 'Total number of Telegram API calls',
    labelNames: ['method', 'status'], // sendSticker, answerInlineQuery, etc.
    registers: [exports.register],
});
exports.telegramApiDuration = new prom_client_1.Histogram({
    name: 'bot_telegram_api_duration_seconds',
    help: 'Duration of Telegram API calls in seconds',
    labelNames: ['method'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [exports.register],
});
// Active users gauge
exports.activeUsers = new prom_client_1.Gauge({
    name: 'bot_active_users',
    help: 'Number of active users in the last period',
    registers: [exports.register],
});
// Queue metrics (if you implement a queue system)
exports.queueSize = new prom_client_1.Gauge({
    name: 'bot_queue_size',
    help: 'Current size of the processing queue',
    labelNames: ['queue_name'],
    registers: [exports.register],
});
// Worker pool metrics
exports.workerPoolActiveWorkers = new prom_client_1.Gauge({
    name: 'bot_worker_pool_active_workers',
    help: 'Number of active workers in the worker pool',
    registers: [exports.register],
});
exports.workerPoolQueueSize = new prom_client_1.Gauge({
    name: 'bot_worker_pool_queue_size',
    help: 'Number of tasks waiting in the worker pool queue',
    registers: [exports.register],
});
exports.workerTaskDuration = new prom_client_1.Histogram({
    name: 'bot_worker_task_duration_seconds',
    help: 'Duration of worker task processing in seconds',
    labelNames: ['status'], // success, error
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [exports.register],
});
exports.workerTasksCompletedTotal = new prom_client_1.Counter({
    name: 'bot_worker_tasks_completed_total',
    help: 'Total number of tasks completed by workers',
    labelNames: ['worker_id', 'status'], // success, error
    registers: [exports.register],
});
// Health check
exports.healthStatus = new prom_client_1.Gauge({
    name: 'bot_health_status',
    help: 'Health status of the bot (1 = healthy, 0 = unhealthy)',
    registers: [exports.register],
});
// Initialize health status as healthy
exports.healthStatus.set(1);
//# sourceMappingURL=metrics.js.map