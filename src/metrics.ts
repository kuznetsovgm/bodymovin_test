import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Create a Registry to register the metrics
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// Custom metrics for the bot

// Counter: Total number of inline queries
export const inlineQueriesTotal = new Counter({
    name: 'bot_inline_queries_total',
    help: 'Total number of inline queries received',
    labelNames: ['status'], // success, error, debounced
    registers: [register],
});

// Counter: Total number of stickers generated
export const stickersGeneratedTotal = new Counter({
    name: 'bot_stickers_generated_total',
    help: 'Total number of stickers generated',
    labelNames: ['animation_type', 'status'], // animation type (slide, rotate, etc), success/error
    registers: [register],
});

// Counter: Total number of errors
export const errorsTotal = new Counter({
    name: 'bot_errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type'], // generation_error, upload_error, cache_error, etc.
    registers: [register],
});

// Histogram: Sticker generation duration
export const stickerGenerationDuration = new Histogram({
    name: 'bot_sticker_generation_duration_seconds',
    help: 'Duration of sticker generation in seconds',
    labelNames: ['animation_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10], // 100ms, 500ms, 1s, 2s, 5s, 10s
    registers: [register],
});

// Histogram: Upload duration
export const uploadDuration = new Histogram({
    name: 'bot_upload_duration_seconds',
    help: 'Duration of sticker upload to Telegram in seconds',
    buckets: [0.5, 1, 2, 5, 10, 30], // 500ms to 30s
    registers: [register],
});

// Cache metrics
export const cacheHitsTotal = new Counter({
    name: 'bot_cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['cache_type'], // sticker, config, etc.
    registers: [register],
});

export const cacheMissesTotal = new Counter({
    name: 'bot_cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['cache_type'],
    registers: [register],
});

export const cacheSize = new Gauge({
    name: 'bot_cache_size_bytes',
    help: 'Current size of cache in bytes',
    labelNames: ['cache_type'],
    registers: [register],
});

// Redis metrics
export const redisOperationsTotal = new Counter({
    name: 'bot_redis_operations_total',
    help: 'Total number of Redis operations',
    labelNames: ['operation', 'status'], // get/set/del, success/error
    registers: [register],
});

export const redisConnectionStatus = new Gauge({
    name: 'bot_redis_connection_status',
    help: 'Redis connection status (1 = connected, 0 = disconnected)',
    registers: [register],
});

// Telegram API metrics
export const telegramApiCalls = new Counter({
    name: 'bot_telegram_api_calls_total',
    help: 'Total number of Telegram API calls',
    labelNames: ['method', 'status'], // sendSticker, answerInlineQuery, etc.
    registers: [register],
});

export const telegramApiDuration = new Histogram({
    name: 'bot_telegram_api_duration_seconds',
    help: 'Duration of Telegram API calls in seconds',
    labelNames: ['method'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
});

// Active users gauge
export const activeUsers = new Gauge({
    name: 'bot_active_users',
    help: 'Number of active users in the last period',
    registers: [register],
});

// Queue metrics (if you implement a queue system)
export const queueSize = new Gauge({
    name: 'bot_queue_size',
    help: 'Current size of the processing queue',
    labelNames: ['queue_name'],
    registers: [register],
});

// Worker pool metrics
export const workerPoolActiveWorkers = new Gauge({
    name: 'bot_worker_pool_active_workers',
    help: 'Number of active workers in the worker pool',
    registers: [register],
});

export const workerPoolQueueSize = new Gauge({
    name: 'bot_worker_pool_queue_size',
    help: 'Number of tasks waiting in the worker pool queue',
    registers: [register],
});

export const workerTaskDuration = new Histogram({
    name: 'bot_worker_task_duration_seconds',
    help: 'Duration of worker task processing in seconds',
    labelNames: ['status'], // success, error
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [register],
});

export const workerTasksCompletedTotal = new Counter({
    name: 'bot_worker_tasks_completed_total',
    help: 'Total number of tasks completed by workers',
    labelNames: ['worker_id', 'status'], // success, error
    registers: [register],
});

// Health check
export const healthStatus = new Gauge({
    name: 'bot_health_status',
    help: 'Health status of the bot (1 = healthy, 0 = unhealthy)',
    registers: [register],
});

// Initialize health status as healthy
healthStatus.set(1);
