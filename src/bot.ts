import 'reflect-metadata';
import { Telegraf } from 'telegraf';
import {
  InlineQueryResult,
  InlineQueryResultCachedSticker,
} from 'telegraf/types';
import { Input } from 'telegraf';
import * as crypto from 'crypto';
import * as http from 'http';
import { stickerToBuffer } from './index';
import { stickerCache } from './cache';
import {
  StickerConfigManager,
  STICKER_CONFIG_SCORE_ZSET_KEY,
} from './config-manager';
import {
  logger,
  logError,
  logInlineQuery,
  logStickerGeneration,
  logUpload,
} from './logger';
import {
  register,
  inlineQueriesTotal,
  stickersGeneratedTotal,
  errorsTotal,
  stickerGenerationDuration,
  uploadDuration,
  cacheHitsTotal,
  cacheMissesTotal,
  redisConnectionStatus,
  healthStatus,
} from './metrics';
import { StickerWorkerPool } from './worker/worker-pool';
import { StickerGenerationTask, StickerGenerationResult } from './worker/types';
import { UserService } from './db/user-service';
import { createSaveUserMiddleware } from './db/user-middleware';
import { getDataSource } from './db/data-source';
import { UploadOwnerSelector } from './upload-owner-selector';
import { toSafeErrorDetails } from './safe-error-log';
import { BotFloodWaitError, SerialUploadQueue } from './serial-upload-queue';
import { WorkerBotPool } from './worker-bot-pool';
import { WorkerBotTokenService } from './db/worker-bot-token-service';
import {
  buildInlineNextOffset,
  getUndeliveredInlineResults,
  parseInlineProgressOffset,
  shouldAnswerInlineBatch,
} from './inline-next-offset';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN environment variable is required');
}

const bot = new Telegraf(BOT_TOKEN);
const userService = new UserService();
const uploadOwnerSelector = new UploadOwnerSelector(userService);
const workerBotTokenService = new WorkerBotTokenService();
bot.use(createSaveUserMiddleware(userService));

// Worker pool configuration
const WORKER_POOL_SIZE =
  parseInt(process.env.WORKER_POOL_SIZE || '0', 10) || undefined;
const WORKER_QUEUE_SIZE = parseInt(process.env.WORKER_QUEUE_SIZE || '100', 10);

const STICKER_STATS_HASH_KEY = 'sticker:stats';
const STICKER_STATS_ZSET_KEY = 'sticker:stats:zset';
const USER_RECENT_KEY_PREFIX = 'user';
const MAX_UPLOAD_ATTEMPTS = 5;
const STICKER_GENERATION_BATCH_SIZE =
  parseInt(process.env.STICKERS_PER_GENERATION_BATCH || '10', 10) || 10;
const STICKERS_PER_PAGE_CACHED =
  parseInt(process.env.STICKERS_PER_PAGE_CACHED || '20', 10) || 20;
const INLINE_FIRST_RESULT_WAIT_MS =
  parseInt(process.env.INLINE_FIRST_RESULT_WAIT_MS || '7000', 10) || 7000;
const ACTIVE_STICKER_JOB_TTL_MS =
  parseInt(process.env.ACTIVE_STICKER_JOB_TTL_MS || '300000', 10) || 300000;
const MAX_ACTIVE_STICKER_JOBS =
  parseInt(process.env.MAX_ACTIVE_STICKER_JOBS || '50', 10) || 50;
const MAX_UPLOAD_QUEUE_SIZE =
  parseInt(process.env.MAX_UPLOAD_QUEUE_SIZE || '100', 10) || 100;
const UPLOAD_MIN_INTERVAL_MS = Math.max(
  0,
  parseInt(process.env.UPLOAD_MIN_INTERVAL_MS || '0', 10) || 0,
);

// Initialize worker pool
const workerPool = new StickerWorkerPool(WORKER_POOL_SIZE, WORKER_QUEUE_SIZE);
const telegramUploadQueue = new SerialUploadQueue({
  maxQueueSize: MAX_UPLOAD_QUEUE_SIZE,
  minIntervalMs: UPLOAD_MIN_INTERVAL_MS,
});

const WORKER_CHANNEL_ID = parseInt(process.env.WORKER_CHANNEL_ID || '0', 10) || null;
const workerBotPool = WORKER_CHANNEL_ID
  ? new WorkerBotPool(WORKER_CHANNEL_ID, {
      maxQueueSize: MAX_UPLOAD_QUEUE_SIZE,
      minIntervalMs: UPLOAD_MIN_INTERVAL_MS,
    })
  : null;

async function resolveResultStickerBuffer(
  result: StickerGenerationResult,
): Promise<Buffer | null> {
  if (result.stickerBuffer) {
    return Buffer.from(
      result.stickerBuffer.buffer,
      result.stickerBuffer.byteOffset,
      result.stickerBuffer.byteLength,
    );
  }

  if (result.sticker) {
    return stickerToBuffer(result.sticker);
  }

  return null;
}

// HTTP server for metrics and health checks
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '3099', 10);
const metricsServer = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } else if (req.url === '/health') {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(health));
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

metricsServer.listen(METRICS_PORT, () => {
  logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  logger.info(`Metrics available at http://localhost:${METRICS_PORT}/metrics`);
  logger.info(
    `Health check available at http://localhost:${METRICS_PORT}/health`,
  );
});

// Initialize sticker config manager
const stickerConfigManager = new StickerConfigManager(stickerCache.getRedis());

// Initialize debounce delay from environment variable (if provided)
const DEBOUNCE_DELAY_ENV = parseInt(process.env.DEBOUNCE_DELAY || '2000', 10);
if (DEBOUNCE_DELAY_ENV > 0) {
  stickerConfigManager
    .getDebounceDelay()
    .then(async (redisDelay) => {
      if (redisDelay === 2000) {
        // Default value means not configured
        console.log(
          `Initializing debounce delay from environment variable: ${DEBOUNCE_DELAY_ENV}ms`,
        );
        await stickerConfigManager.setDebounceDelay(DEBOUNCE_DELAY_ENV);
      }
    })
    .catch((err) => {
      console.error('Error initializing debounce delay:', err);
    });
}

// Admin user IDs (comma-separated environment variable)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0)
  .map((id) => parseInt(id));

function isAdmin(userId: number): boolean {
  return ADMIN_USER_IDS.includes(userId);
}

type StickerUploadAttemptResult = {
  fileId: string | null;
  retryable: boolean;
  rateLimited?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getTelegramRetryAfterSeconds(error: unknown): number | null {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord?.response);
  const parameters =
    asRecord(errorRecord?.parameters) ?? asRecord(response?.parameters);
  const errorCode =
    typeof errorRecord?.code === 'number'
      ? errorRecord.code
      : typeof response?.error_code === 'number'
        ? response.error_code
        : null;

  if (errorCode !== 429) {
    return null;
  }

  return typeof parameters?.retry_after === 'number'
    ? parameters.retry_after
    : 300;
}

async function uploadStickerOnce(
  stickerBuffer: Buffer,
): Promise<StickerUploadAttemptResult> {
  if (workerBotPool?.isAvailable()) {
    const startTime = Date.now();
    const result = await workerBotPool.sendStickerViaChannel(stickerBuffer);
    const duration = (Date.now() - startTime) / 1000;
    if (result.fileId) {
      uploadDuration.observe(duration);
      logUpload(result.fileId, 'worker_pool', true, duration);
    } else {
      logUpload('', 'worker_pool', false, duration, result.rateLimited ? 'rate_limited' : 'failed');
      if (result.rateLimited) {
        errorsTotal.inc({ error_type: 'upload_rate_limited' });
      }
    }
    return result;
  }

  const ownerId = await uploadOwnerSelector.getNextOwnerId();

  if (!ownerId) {
    logger.error('Cannot upload sticker: no users found in database.');
    errorsTotal.inc({ error_type: 'no_upload_users' });
    return { fileId: null, retryable: false };
  }

  const startTime = Date.now();

  try {
    const file = await bot.telegram.uploadStickerFile(
      ownerId,
      Input.fromBuffer(stickerBuffer, 'sticker.tgs'),
      'animated',
    );
    const fileId = file.file_id;
    const duration = (Date.now() - startTime) / 1000;

    if (fileId) {
      uploadDuration.observe(duration);
      logUpload(fileId, ownerId.toString(), true, duration);
      logger.info(`Uploaded sticker for user ${ownerId}, file_id: ${fileId}`);
      return { fileId, retryable: false };
    }

    logUpload('', ownerId.toString(), false, duration, 'Missing file_id');
    logger.error(
      `Failed to upload sticker for user ${ownerId}: missing file_id`,
    );
    return { fileId: null, retryable: true };
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    const retryAfterSeconds = getTelegramRetryAfterSeconds(error);
    const safeError = toSafeErrorDetails(error);

    if (retryAfterSeconds !== null) {
      telegramUploadQueue.setBotFloodWait(retryAfterSeconds);
      errorsTotal.inc({ error_type: 'upload_rate_limited' });
      logUpload('', ownerId.toString(), false, duration, safeError.message);
      logger.warn(
        `Telegram bot-wide upload flood wait: ${retryAfterSeconds}s`,
        safeError,
      );
      return { fileId: null, retryable: false, rateLimited: true };
    }

    errorsTotal.inc({ error_type: 'upload_error' });
    logUpload('', ownerId.toString(), false, duration, safeError.message);
    logger.error(`Failed to upload sticker for user ${ownerId}`, safeError);
    return { fileId: null, retryable: true };
  }
}

async function uploadStickerToTelegram(
  stickerBuffer: Buffer,
): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const result = await telegramUploadQueue.enqueue(() =>
        uploadStickerOnce(stickerBuffer),
      );

      if (result.fileId) {
        return result.fileId;
      }

      if (!result.retryable || result.rateLimited) {
        return null;
      }
    } catch (error) {
      if (error instanceof BotFloodWaitError) {
        errorsTotal.inc({ error_type: 'upload_rate_limited' });
        logger.warn(
          `Skipping sticker upload during bot-wide flood wait: ${error.retryAfterSeconds}s`,
        );
        return null;
      }

      errorsTotal.inc({ error_type: 'upload_queue_error' });
      logger.error('Failed to enqueue sticker upload', toSafeErrorDetails(error));
      return null;
    }
  }

  errorsTotal.inc({ error_type: 'upload_failed_all_users' });
  return null;
}

type EnabledStickerConfig = Awaited<
  ReturnType<StickerConfigManager['getEnabledConfigs']>
>[number];

type PreloadedConfigData = {
  enabledConfigs: EnabledStickerConfig[];
  cachedFileIds?: (string | null)[];
};

type StickerBatchJob = {
  key: string;
  normalizedText: string;
  offset: number;
  limit: number;
  totalEnabled: number;
  results: (InlineQueryResult | null)[];
  publishedResults: InlineQueryResult[];
  pendingCount: number;
  completed: boolean;
  startedAt: number;
  lastAccessAt: number;
  waiters: Set<() => void>;
};

const activeStickerJobs = new Map<string, StickerBatchJob>();

function buildStickerBatchJobKey(normalizedText: string, offset: number): string {
  const textHash = crypto.createHash('sha1').update(normalizedText).digest('hex');
  return `${offset}:${textHash}`;
}

function buildCachedStickerResult(
  configId: string,
  fileId: string,
): InlineQueryResultCachedSticker {
  return {
    type: 'sticker',
    id: configId,
    sticker_file_id: fileId,
  } as InlineQueryResultCachedSticker;
}

function getReadyJobResults(job: StickerBatchJob): InlineQueryResult[] {
  return job.publishedResults;
}

function notifyStickerBatchJob(job: StickerBatchJob): void {
  if (!job.completed && getReadyJobResults(job).length === 0) {
    return;
  }

  const waiters = Array.from(job.waiters);
  job.waiters.clear();
  for (const waiter of waiters) {
    waiter();
  }
}

function waitForJobReadyResults(
  job: StickerBatchJob,
  timeoutMs: number,
  deliveredCount = 0,
): Promise<void> {
  if (
    job.completed ||
    getReadyJobResults(job).length > deliveredCount ||
    timeoutMs <= 0
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const waiter = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      job.waiters.delete(waiter);
      resolve();
    }, timeoutMs);

    job.waiters.add(waiter);
  });
}

function cleanupActiveStickerJobs(): void {
  const now = Date.now();

  for (const [key, job] of activeStickerJobs) {
    if (now - job.lastAccessAt > ACTIVE_STICKER_JOB_TTL_MS) {
      activeStickerJobs.delete(key);
    }
  }

  while (activeStickerJobs.size > MAX_ACTIVE_STICKER_JOBS) {
    let oldestKey: string | null = null;
    let oldestAccessAt = Number.POSITIVE_INFINITY;

    for (const [key, job] of activeStickerJobs) {
      if (job.lastAccessAt < oldestAccessAt) {
        oldestKey = key;
        oldestAccessAt = job.lastAccessAt;
      }
    }

    if (!oldestKey) {
      return;
    }

    activeStickerJobs.delete(oldestKey);
  }
}

function buildCachedPartialResults(
  enabledConfigs: EnabledStickerConfig[],
  cachedFileIds: (string | null)[],
  offset: number,
  limit: number,
): InlineQueryResult[] {
  const endIndex = Math.min(offset + limit, enabledConfigs.length);
  const results: InlineQueryResult[] = [];

  for (let i = offset; i < endIndex; i++) {
    const fileId = cachedFileIds[i];
    if (!fileId) {
      continue;
    }

    results.push(buildCachedStickerResult(enabledConfigs[i].id, fileId));
  }

  return results;
}

async function getOrCreateStickerBatchJob(
  text: string,
  offset: number,
  limit: number,
  preloaded?: PreloadedConfigData,
): Promise<StickerBatchJob | null> {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return null;
  }

  cleanupActiveStickerJobs();

  const key = buildStickerBatchJobKey(normalizedText, offset);
  const existingJob = activeStickerJobs.get(key);
  if (existingJob) {
    existingJob.lastAccessAt = Date.now();
    return existingJob;
  }

  if (telegramUploadQueue.isFloodLimited()) {
    logger.warn('Skipping sticker generation while bot-wide upload flood wait is active');
    return null;
  }

  const enabledConfigs =
    preloaded?.enabledConfigs ??
    (await stickerConfigManager.getEnabledConfigs());

  if (!enabledConfigs.length) {
    logger.warn('No enabled sticker configurations found in Redis');
    return null;
  }

  const endIndex = Math.min(offset + limit, enabledConfigs.length);
  if (offset >= endIndex) {
    return null;
  }

  const cachedFileIds = preloaded?.cachedFileIds
    ? preloaded.cachedFileIds
    : await stickerCache.getBatch(
        normalizedText,
        enabledConfigs.map((c) => c.config),
      );

  const totalItems = endIndex - offset;
  const job: StickerBatchJob = {
    key,
    normalizedText,
    offset,
    limit: totalItems,
    totalEnabled: enabledConfigs.length,
    results: new Array(totalItems).fill(null),
    publishedResults: [],
    pendingCount: 0,
    completed: false,
    startedAt: Date.now(),
    lastAccessAt: Date.now(),
    waiters: new Set(),
  };
  const tasks: StickerGenerationTask[] = [];

  for (let i = offset; i < endIndex; i++) {
    const { config: variant, id: configId } = enabledConfigs[i];
    const batchIndex = i - offset;
    const fileId = cachedFileIds[i];

    if (fileId) {
      cacheHitsTotal.inc({ cache_type: 'sticker' });
      const cachedResult = buildCachedStickerResult(configId, fileId);
      job.results[batchIndex] = cachedResult;
      job.publishedResults.push(cachedResult);
      logger.debug(
        `[${i + 1}/${enabledConfigs.length}] Using cached sticker for "${normalizedText}" (config: ${configId})`,
      );
      continue;
    }

    cacheMissesTotal.inc({ cache_type: 'sticker' });
    const task: StickerGenerationTask = {
      id: crypto.randomBytes(8).toString('hex'),
      text: normalizedText,
      variant,
      configId,
      index: i,
    };

    tasks.push(task);
    logger.info(
      `[${i + 1}/${enabledConfigs.length}] Queuing task for "${normalizedText}" (config: ${configId})...`,
    );
  }

  job.pendingCount = tasks.length;
  job.completed = tasks.length === 0;
  activeStickerJobs.set(key, job);
  cleanupActiveStickerJobs();

  for (const task of tasks) {
    void processStickerGenerationTask(job, task);
  }

  notifyStickerBatchJob(job);
  return job;
}

async function processStickerGenerationTask(
  job: StickerBatchJob,
  task: StickerGenerationTask,
): Promise<void> {
  const animType = (task.variant as any).transform?.type || 'static';

  try {
    const result = await workerPool.submitTask(task);
    const index = result.index;

    if (result.success) {
      const stickerBuffer = await resolveResultStickerBuffer(result);

      if (stickerBuffer) {
        const uploadedFileId = await uploadStickerToTelegram(stickerBuffer);

        if (uploadedFileId) {
          await stickerCache.set(job.normalizedText, task.variant, uploadedFileId);

          stickerGenerationDuration.observe(
            { animation_type: animType },
            result.duration,
          );
          stickersGeneratedTotal.inc({
            animation_type: animType,
            status: 'success',
          });
          logStickerGeneration(
            animType,
            job.normalizedText,
            true,
            result.duration,
          );
          logger.info(`[${index + 1}/${job.totalEnabled}] ✓ Success`);

          const batchIndex = index - job.offset;
          const stickerResult = buildCachedStickerResult(
            task.configId,
            uploadedFileId,
          );
          if (batchIndex >= 0 && batchIndex < job.results.length) {
            job.results[batchIndex] = stickerResult;
          }
          job.publishedResults.push(stickerResult);
        } else {
          stickersGeneratedTotal.inc({
            animation_type: animType,
            status: 'error',
          });
          errorsTotal.inc({ error_type: 'upload_failed' });
          logger.error(`[${index + 1}/${job.totalEnabled}] ✗ Upload failed`);
        }
      } else {
        stickersGeneratedTotal.inc({
          animation_type: animType,
          status: 'error',
        });
        errorsTotal.inc({ error_type: 'generation_error' });
        logStickerGeneration(
          animType,
          job.normalizedText,
          false,
          result.duration,
          'Empty sticker buffer',
        );
        logger.error(
          `[${index + 1}/${job.totalEnabled}] ✗ Failed: empty sticker buffer`,
        );
      }
    } else {
      stickersGeneratedTotal.inc({
        animation_type: animType,
        status: 'error',
      });
      errorsTotal.inc({ error_type: 'generation_error' });
      logStickerGeneration(
        animType,
        job.normalizedText,
        false,
        result.duration,
        result.error,
      );
      logger.error(
        `[${index + 1}/${job.totalEnabled}] ✗ Failed: ${result.error}`,
      );
    }
  } catch (error) {
    stickersGeneratedTotal.inc({
      animation_type: animType,
      status: 'error',
    });
    errorsTotal.inc({ error_type: 'worker_error' });
    logger.error(
      `[${task.index + 1}/${job.totalEnabled}] ✗ Worker error:`,
      error,
    );
  } finally {
    job.pendingCount--;
    job.lastAccessAt = Date.now();
    if (job.pendingCount <= 0) {
      job.completed = true;
    }
    notifyStickerBatchJob(job);
  }
}

// Inline query handler with pagination
bot.on('inline_query', async (ctx) => {
  let query = ctx.inlineQuery.query || '';
  const inlineOffset = parseInlineProgressOffset(ctx.inlineQuery.offset || '');
  const offset = inlineOffset.offset;
  const queryStartTime = Date.now();

  const maxLength = await stickerConfigManager.getInlineQueryMaxLength();
  if (query.length > maxLength) {
    query = query.slice(0, maxLength);
  }

  logger.info(
    `Inline query: offset=${offset}, query="${query}", user=${ctx.from.id}, username=${ctx.from.username || ''}, first_name=${ctx.from.first_name}`,
  );

  const normalizedInlineQuery = query.trim();

  // If query is empty, try to serve personal recent stickers
  if (normalizedInlineQuery === '') {
    const historyEnabled = await stickerConfigManager.getInlineHistoryEnabled();

    if (historyEnabled) {
      try {
        const limit = await stickerConfigManager.getUserRecentStickersLimit();
        const redis = stickerCache.getRedis();
        const userRecentKey = `${USER_RECENT_KEY_PREFIX}:${ctx.from.id}:recent`;
        const recentFileIds = await redis.lrange(userRecentKey, 0, limit - 1);

        if (recentFileIds.length > 0) {
          const results: InlineQueryResult[] = recentFileIds.map(
            (fileId, index) =>
              ({
                type: 'sticker',
                id: `recent-${index}`,
                sticker_file_id: fileId,
              }) as InlineQueryResultCachedSticker,
          );

          await ctx.answerInlineQuery(results, {
            is_personal: true,
            cache_time: 0,
            next_offset: '',
          });
          inlineQueriesTotal.inc({ status: 'history' });
          return;
        }
      } catch (error) {
        logError(error as Error, {
          context: 'inline_history',
          userId: ctx.from.id,
        });
        logger.error('Failed to fetch recent stickers history:', error);
      }
    }
  }

  const userId = ctx.from.id.toString();

  // Load enabled configs count
  const enabledCount = await stickerConfigManager.getEnabledCount();

  // No more pages to serve
  if (offset >= enabledCount) {
    await ctx.answerInlineQuery([], { cache_time: 300, next_offset: '' });
    inlineQueriesTotal.inc({ status: 'empty' });
    const duration = (Date.now() - queryStartTime) / 1000;
    logInlineQuery(query, ctx.from.id, true, duration);
    return;
  }

  // Answer immediately with cached results if available from Redis
  const normalizedText = query.trim();

  // Try to get cached results for all enabled variants in one batch request
  const enabledConfigs = await stickerConfigManager.getEnabledConfigs();
  const totalEnabled = enabledConfigs.length;
  if (offset >= totalEnabled) {
    await ctx.answerInlineQuery([], { cache_time: 300, next_offset: '' });
    inlineQueriesTotal.inc({ status: 'empty' });
    const duration = (Date.now() - queryStartTime) / 1000;
    logInlineQuery(query, ctx.from.id, true, duration);
    return;
  }
  const allConfigs = enabledConfigs.map((c) => c.config);
  const allCachedFileIds = await stickerCache.getBatch(
    normalizedText,
    allConfigs,
  );

  const buildCachedRangeResults = (
    rangeSize: number,
  ): InlineQueryResult[] | null => {
    const remaining = Math.max(0, totalEnabled - offset);
    const availableCount = Math.min(rangeSize, remaining);
    if (availableCount <= 0) {
      return [];
    }

    const results: InlineQueryResult[] = [];
    for (let i = 0; i < availableCount; i++) {
      const index = offset + i;
      const fileId = allCachedFileIds[index];

      if (!fileId) {
        return null;
      }

      const { id } = enabledConfigs[index];
      results.push({
        type: 'sticker',
        id,
        sticker_file_id: fileId,
      } as InlineQueryResultCachedSticker);
    }

    return results;
  };

  const cachedRange =
    buildCachedRangeResults(STICKERS_PER_PAGE_CACHED) ??
    buildCachedRangeResults(STICKER_GENERATION_BATCH_SIZE);

  if (!inlineOffset.isProgressOffset && cachedRange && cachedRange.length > 0) {
    const nextOffset =
      offset + cachedRange.length < totalEnabled
        ? (offset + cachedRange.length).toString()
        : '';
    try {
      await ctx.answerInlineQuery(cachedRange, {
        next_offset: nextOffset,
      });
      inlineQueriesTotal.inc({ status: 'cached' });
      const duration = (Date.now() - queryStartTime) / 1000;
      logInlineQuery(query, ctx.from.id, true, duration);
      return;
    } catch (error) {
      console.error('Error answering with cached results:', error);
    }
  }

  try {
    logger.info(`Ensuring sticker batch for: "${query}" (offset: ${offset})`);
    const job = await getOrCreateStickerBatchJob(
      query,
      offset,
      STICKER_GENERATION_BATCH_SIZE,
      { enabledConfigs, cachedFileIds: allCachedFileIds },
    );

    if (job) {
      await waitForJobReadyResults(
        job,
        INLINE_FIRST_RESULT_WAIT_MS,
        inlineOffset.deliveredCount,
      );

      const results = getUndeliveredInlineResults(
        getReadyJobResults(job),
        inlineOffset.deliveredCount,
      );
      if (
        !shouldAnswerInlineBatch({
          readyCount: results.length,
          completed: job.completed,
        })
      ) {
        inlineQueriesTotal.inc({ status: 'pending' });
        const duration = (Date.now() - queryStartTime) / 1000;
        logger.info(
          `Inline query left unanswered while waiting for first sticker: query="${query}", offset=${offset}, duration=${duration}s`,
        );
        return;
      }

      const nextOffset = buildInlineNextOffset({
        currentOffset: offset,
        batchSize: job.limit,
        totalEnabled,
        completed: job.completed,
        deliveredCount: inlineOffset.deliveredCount,
        returnedCount: results.length,
      });

      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        next_offset: nextOffset,
        is_personal: true,
      });

      inlineQueriesTotal.inc({ status: results.length > 0 ? 'success' : 'empty' });
      const duration = (Date.now() - queryStartTime) / 1000;
      logInlineQuery(query, ctx.from.id, true, duration);
      return;
    }

    const partialCachedResults = getUndeliveredInlineResults(
      buildCachedPartialResults(
        enabledConfigs,
        allCachedFileIds,
        offset,
        STICKER_GENERATION_BATCH_SIZE,
      ),
      inlineOffset.deliveredCount,
    );

    await ctx.answerInlineQuery(partialCachedResults, {
      cache_time: 0,
      next_offset: '',
      is_personal: true,
    });

    inlineQueriesTotal.inc({
      status: partialCachedResults.length > 0 ? 'cached' : 'empty',
    });
    const duration = (Date.now() - queryStartTime) / 1000;
    logInlineQuery(query, ctx.from.id, true, duration);
  } catch (error) {
    inlineQueriesTotal.inc({ status: 'error' });
    errorsTotal.inc({ error_type: 'inline_query_error' });
    const duration = (Date.now() - queryStartTime) / 1000;
    logInlineQuery(query, ctx.from.id, false, duration);
    logError(error as Error, { context: 'inline_query', query, userId });
    console.error('Error handling inline query:', error);
    // Ignore "query is too old" errors - Telegram already closed the query
    if (
      error instanceof Error &&
      error.message.includes('query is too old')
    ) {
      console.log('Query expired, ignoring...');
    } else {
      try {
        await ctx.answerInlineQuery([], { cache_time: 0 });
      } catch (answerError) {
        // Ignore errors when answering already expired queries
        console.log('Failed to answer query (likely expired)');
      }
    }
  }
});

// Track chosen inline results: stats, history, config scoring
bot.on('chosen_inline_result', async (ctx) => {
  const { chosenInlineResult } = ctx;
  if (!chosenInlineResult) {
    return;
  }

  const userId = ctx.from?.id ? ctx.from.id.toString() : null;
  const configId = chosenInlineResult.result_id;
  // Ignore selections from personal history (their IDs start with "recent-")
  if (configId && configId.startsWith('recent-')) {
    return;
  }
  let query = chosenInlineResult.query || '';
  const maxLength = await stickerConfigManager.getInlineQueryMaxLength();
  if (query.length > maxLength) {
    query = query.slice(0, maxLength);
  }
  const normalizedText = query.trim();
  const redis = stickerCache.getRedis();

  try {
    let fileId: string | null = null;

    if (configId) {
      const config = await stickerConfigManager.getConfig(configId);
      if (config) {
        fileId = await stickerCache.get(normalizedText, config);
      }
    }

    if (fileId) {
      await redis.hincrby(STICKER_STATS_HASH_KEY, fileId, 1);
      await redis.zincrby(STICKER_STATS_ZSET_KEY, 1, fileId);

      if (userId) {
        const recentLimit =
          await stickerConfigManager.getUserRecentStickersLimit();
        const userRecentKey = `${USER_RECENT_KEY_PREFIX}:${userId}:recent`;
        await redis.lpush(userRecentKey, fileId);
        await redis.ltrim(userRecentKey, 0, recentLimit - 1);
      }
    }

    const globalConfigScoringEnabled =
      await stickerConfigManager.getInlineGlobalConfigScoringEnabled();
    if (globalConfigScoringEnabled && configId) {
      await redis.zincrby(STICKER_CONFIG_SCORE_ZSET_KEY, 1, configId);
    }
  } catch (error) {
    logError(error as Error, {
      context: 'chosen_inline_result',
      userId,
      configId,
    });
    logger.error('Failed to handle chosen_inline_result:', error);
  }
});

bot.command('start', async (ctx) => {
  console.log('Received /start command from user:', ctx.from.id);
  const userLang = ctx.from?.language_code || 'en';
  const isRussian = userLang.toLowerCase().startsWith('ru');
  const username = ctx.botInfo.username;

  const messageText = isRussian
    ? '🎨 *Бот анимированных стикеров*\n\n' +
      'Используй меня в инлайн‑режиме, чтобы создавать анимированные текстовые стикеры!\n\n' +
      '*Как пользоваться:*\n' +
      '1. Напиши `@' +
      username +
      '` в любом чате\n' +
      '2. Введи свой текст\n' +
      '3. Подожди генерации\n' +
      '4. Выбери понравившийся анимированный стиль!\n\n' +
      'Попробуй сейчас: `@' +
      username +
      ' Привет`'
    : '🎨 *Animated Sticker Bot*\n\n' +
      'Use me in inline mode to create animated text stickers!\n\n' +
      '*How to use:*\n' +
      '1. Type `@' +
      username +
      '` in any chat\n' +
      '2. Enter your text\n' +
      '3. Wait for generation\n' +
      '4. Choose from different animated styles!\n\n' +
      'Try it now: `@' +
      username +
      ' Hello`';

  const buttonText = isRussian ? 'Выбрать чат' : 'Select chat';
  const buttonQuery = isRussian ? 'Привет!' : 'Hello!';

  ctx.reply(messageText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            switch_inline_query: buttonQuery,
          },
        ],
      ],
    },
  });
});

// Admin command: List all sticker configurations
bot.command('list_configs', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  try {
    const configs = await stickerConfigManager.getAllConfigs();

    if (configs.length === 0) {
      await ctx.reply(
        '📭 No sticker configurations found in Redis.\n\nUse /init_configs to load default configurations.',
      );
      return;
    }

    let message = `📋 *Sticker Configurations* (${configs.length} total)\n\n`;

    for (let i = 0; i < configs.length; i++) {
      const { id, enabled } = configs[i];
      const status = enabled ? '✅' : '❌';
      message += `${status} \`${id}\`\n`;

      // Split into multiple messages if too long
      if (message.length > 3500 && i < configs.length - 1) {
        await ctx.reply(message, { parse_mode: 'Markdown' });
        message = '';
      }
    }

    if (message) {
      await ctx.reply(message, { parse_mode: 'Markdown' });
    }

    const enabledCount = configs.filter((c) => c.enabled).length;
    await ctx.reply(
      `\n📊 Summary:\n` +
        `• Total: ${configs.length}\n` +
        `• Enabled: ${enabledCount}\n` +
        `• Disabled: ${configs.length - enabledCount}\n\n` +
        `Use /enable <id> or /disable <id> to manage configurations.`,
    );
  } catch (error) {
    console.error('Error listing configs:', error);
    await ctx.reply('❌ Error listing configurations.');
  }
});

// Admin command: Enable a sticker configuration
bot.command('enable', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply(
      'Usage: /enable <config_id>\n\nUse /list_configs to see available configurations.',
    );
    return;
  }

  const configId = args[1];

  try {
    const success = await stickerConfigManager.enableConfig(configId);

    if (success) {
      await ctx.reply(`✅ Configuration \`${configId}\` has been enabled.`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`❌ Configuration \`${configId}\` not found.`, {
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Error enabling config:', error);
    await ctx.reply('❌ Error enabling configuration.');
  }
});

// Admin command: Disable a sticker configuration
bot.command('disable', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply(
      'Usage: /disable <config_id>\n\nUse /list_configs to see available configurations.',
    );
    return;
  }

  const configId = args[1];

  try {
    const success = await stickerConfigManager.disableConfig(configId);

    if (success) {
      await ctx.reply(`✅ Configuration \`${configId}\` has been disabled.`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`❌ Error disabling configuration \`${configId}\`.`, {
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Error disabling config:', error);
    await ctx.reply('❌ Error disabling configuration.');
  }
});

// Admin command: View details of a specific configuration
bot.command('view_config', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply(
      'Usage: /view_config <config_id>\n\nUse /list_configs to see available configurations.',
    );
    return;
  }

  const configId = args[1];

  try {
    const config = await stickerConfigManager.getConfig(configId);

    if (!config) {
      await ctx.reply(`❌ Configuration \`${configId}\` not found.`, {
        parse_mode: 'Markdown',
      });
      return;
    }

    const isEnabled = await stickerConfigManager.isEnabled(configId);
    const status = isEnabled ? '✅ Enabled' : '❌ Disabled';

    const configJson = JSON.stringify(config, null, 2);

    await ctx.reply(
      `🔧 *Configuration Details*\n\n` +
        `ID: \`${configId}\`\n` +
        `Status: ${status}\n\n` +
        `\`\`\`json\n${configJson}\n\`\`\``,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error viewing config:', error);
    await ctx.reply('❌ Error viewing configuration.');
  }
});

// Admin command: Get current debounce delay
bot.command('get_debounce_delay', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  try {
    const delay = await stickerConfigManager.getDebounceDelay();
    await ctx.reply(
      `⏱️ *Current Debounce Delay*\n\n` +
        `Delay: \`${delay}ms\` (${(delay / 1000).toFixed(1)}s)\n\n` +
        `Use /set_debounce_delay <ms> to change it.`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error getting debounce delay:', error);
    await ctx.reply('❌ Error getting debounce delay.');
  }
});

// Admin command: Set debounce delay
bot.command('set_debounce_delay', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply(
      'Usage: /set_debounce_delay <milliseconds>\n\n' +
        'Example: /set_debounce_delay 2000 (2 seconds)\n' +
        'Example: /set_debounce_delay 500 (0.5 seconds)',
    );
    return;
  }

  const delayMs = parseInt(args[1], 10);

  if (isNaN(delayMs) || delayMs < 0) {
    await ctx.reply(
      '❌ Invalid delay value. Please provide a positive number in milliseconds.',
    );
    return;
  }

  try {
    await stickerConfigManager.setDebounceDelay(delayMs);
    await ctx.reply(
      `✅ Debounce delay updated!\n\n` +
        `New delay: \`${delayMs}ms\` (${(delayMs / 1000).toFixed(1)}s)`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    console.error('Error setting debounce delay:', error);
    await ctx.reply('❌ Error setting debounce delay.');
  }
});

// Admin commands: Worker bot pool management

async function reloadWorkerBotPool(): Promise<void> {
  if (!workerBotPool) return;
  const tokens = await workerBotTokenService.getActiveTokensWithIds();
  workerBotPool.reload(tokens);
}

bot.command('add_worker_bot', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /add_worker_bot <token>');
    return;
  }

  const token = args[1].trim();
  try {
    const entry = await workerBotTokenService.addToken(token);
    await reloadWorkerBotPool();
    const masked = token.slice(0, 10) + '...';
    await ctx.reply(
      `✅ Worker bot added.\nID: \`${entry.id}\`\nToken: \`${masked}\`\nPool size: ${workerBotPool?.workerCount() ?? 0}`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.error('Error adding worker bot token', error);
    await ctx.reply('❌ Error adding worker bot (token may already exist).');
  }
});

bot.command('list_worker_bots', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  try {
    const tokens = await workerBotTokenService.listAll();
    if (tokens.length === 0) {
      await ctx.reply(
        'No worker bots configured.\n\nUse /add_worker_bot <token> to add one.\n' +
          (WORKER_CHANNEL_ID ? `Channel: \`${WORKER_CHANNEL_ID}\`` : '⚠️ WORKER_CHANNEL_ID not set'),
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const lines = tokens.map((t) => {
      const masked = t.token.slice(0, 10) + '...';
      const status = t.status === 'active' ? '✅' : '❌';
      return `${status} \`${t.id.slice(0, 8)}\` ${masked} (${t.status})`;
    });

    await ctx.reply(
      `*Worker bots* (${tokens.length} total, pool: ${workerBotPool?.workerCount() ?? 0} active)\n` +
        (WORKER_CHANNEL_ID ? `Channel: \`${WORKER_CHANNEL_ID}\`\n` : '⚠️ WORKER_CHANNEL_ID not set\n') +
        '\n' + lines.join('\n'),
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.error('Error listing worker bots', error);
    await ctx.reply('❌ Error listing worker bots.');
  }
});

bot.command('enable_worker_bot', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /enable_worker_bot <id>\n\nUse /list_worker_bots to see IDs.');
    return;
  }

  const id = args[1].trim();
  try {
    await workerBotTokenService.setStatus(id, 'active');
    await reloadWorkerBotPool();
    await ctx.reply(`✅ Worker bot \`${id.slice(0, 8)}\` enabled. Pool size: ${workerBotPool?.workerCount() ?? 0}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.error('Error enabling worker bot', error);
    await ctx.reply('❌ Error enabling worker bot.');
  }
});

bot.command('disable_worker_bot', async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    await ctx.reply('Usage: /disable_worker_bot <id>\n\nUse /list_worker_bots to see IDs.');
    return;
  }

  const id = args[1].trim();
  try {
    await workerBotTokenService.setStatus(id, 'inactive');
    await reloadWorkerBotPool();
    await ctx.reply(`✅ Worker bot \`${id.slice(0, 8)}\` disabled. Pool size: ${workerBotPool?.workerCount() ?? 0}`, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.error('Error disabling worker bot', error);
    await ctx.reply('❌ Error disabling worker bot.');
  }
});

// Monitor Redis connection status
stickerCache.getRedis().on('connect', () => {
  redisConnectionStatus.set(1);
  logger.info('Redis connected');
});

stickerCache.getRedis().on('error', (err) => {
  redisConnectionStatus.set(0);
  logger.error('Redis error:', err);
  logError(err, { context: 'redis' });
});

stickerCache.getRedis().on('close', () => {
  redisConnectionStatus.set(0);
  logger.warn('Redis connection closed');
});

// Initialize worker pool before launching bot
(async () => {
  try {
    logger.info('Initializing worker pool...');
    await getDataSource().catch((err) => {
      logger.error(
        'PostgreSQL connection failed (continuing without DB):',
        err,
      );
    });
    await workerPool.initialize();
    logger.info('Worker pool initialized successfully');

    if (workerBotPool) {
      const tokens = await workerBotTokenService.getActiveTokensWithIds();
      workerBotPool.reload(tokens);
      logger.info(`Worker bot pool initialized: ${tokens.length} token(s) loaded`);
    }

    bot.launch();

    logger.info('🤖 Bot started successfully!');
    logger.info('Bot username: ' + bot.botInfo?.username);
  } catch (error) {
    logger.error('Failed to initialize worker pool:', error);
    process.exit(1);
  }
})();
logger.info('Press Ctrl+C to stop.');

// Enable graceful stop
process.once('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  healthStatus.set(0);
  await workerPool.shutdown();
  await stickerCache.close();
  metricsServer.close();
  bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  healthStatus.set(0);
  await workerPool.shutdown();
  await stickerCache.close();
  metricsServer.close();
  bot.stop('SIGTERM');
});
