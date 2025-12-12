import 'reflect-metadata';
import { Telegraf, Context } from 'telegraf';
import {
    InlineQueryResult,
    InlineQueryResultCachedSticker,
} from 'telegraf/types';
import { Input } from 'telegraf';
import * as crypto from 'crypto';
import * as http from 'http';
import {
    stickerToBuffer,
} from './index';
import { stickerCache } from './cache';
import { StickerConfigManager, STICKER_CONFIG_SCORE_ZSET_KEY } from './config-manager';
import { logger, logError, logInlineQuery, logStickerGeneration, logUpload } from './logger';
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
import { StickerGenerationTask } from './worker/types';
import { UserService } from './db/user-service';
import { createSaveUserMiddleware } from './db/user-middleware';
import { getDataSource } from './db/data-source';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN environment variable is required');
}

const bot = new Telegraf(BOT_TOKEN);
const userService = new UserService();
bot.use(createSaveUserMiddleware(userService));

// Worker pool configuration
const WORKER_POOL_SIZE = parseInt(process.env.WORKER_POOL_SIZE || '0', 10) || undefined;
const WORKER_QUEUE_SIZE = parseInt(process.env.WORKER_QUEUE_SIZE || '100', 10);

const STICKER_STATS_HASH_KEY = 'sticker:stats';
const STICKER_STATS_ZSET_KEY = 'sticker:stats:zset';
const USER_RECENT_KEY_PREFIX = 'user';

// Initialize worker pool
const workerPool = new StickerWorkerPool(WORKER_POOL_SIZE, WORKER_QUEUE_SIZE);

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
    logger.info(`Health check available at http://localhost:${METRICS_PORT}/health`);
});

// Initialize sticker config manager
const stickerConfigManager = new StickerConfigManager(stickerCache.getRedis());

// Initialize upload chat IDs from environment variable (if provided)
const UPLOAD_CHAT_IDS_ENV = (process.env.UPLOAD_CHAT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

// Initialize Redis with UPLOAD_CHAT_IDS from env on startup
if (UPLOAD_CHAT_IDS_ENV.length > 0) {
    stickerConfigManager.getUploadChatIds().then(async (redisIds) => {
        if (redisIds.length === 0) {
            logger.info('Initializing upload chat IDs from environment variable...');
            await stickerConfigManager.saveUploadChatIds(UPLOAD_CHAT_IDS_ENV);
            logger.info(`✓ Initialized ${UPLOAD_CHAT_IDS_ENV.length} upload chat IDs`);
        }
    }).catch(err => {
        logger.error('Error initializing upload chat IDs:', err);
        logError(err as Error, { context: 'upload_chat_ids_init' });
    });
}

// Debounce state for inline queries
const debounceTimers = new Map<string, NodeJS.Timeout>();

// Initialize debounce delay from environment variable (if provided)
const DEBOUNCE_DELAY_ENV = parseInt(process.env.DEBOUNCE_DELAY || '2000', 10);
if (DEBOUNCE_DELAY_ENV > 0) {
    stickerConfigManager.getDebounceDelay().then(async (redisDelay) => {
        if (redisDelay === 2000) { // Default value means not configured
            console.log(`Initializing debounce delay from environment variable: ${DEBOUNCE_DELAY_ENV}ms`);
            await stickerConfigManager.setDebounceDelay(DEBOUNCE_DELAY_ENV);
        }
    }).catch(err => {
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

// Store which chat was used last for round-robin distribution
let lastUsedChatIndex = 0;

async function uploadStickerToTelegram(
    ctx: Context,
    stickerBuffer: Buffer,
): Promise<string | null> {
    const startTime = Date.now();

    // Get upload chat IDs from Redis (with local cache)
    const uploadChatIds = await stickerConfigManager.getUploadChatIds();

    if (uploadChatIds.length === 0) {
        logger.error('No upload chat IDs configured. Use /set_upload_chats command.');
        errorsTotal.inc({ error_type: 'no_upload_chats' });
        return null;
    }

    // Use round-robin to distribute uploads across chats (avoid rate limits)
    const chatId = uploadChatIds[lastUsedChatIndex];
    lastUsedChatIndex = (lastUsedChatIndex + 1) % uploadChatIds.length;

    try {
        const file = await ctx.telegram.uploadStickerFile(+chatId, Input.fromBuffer(stickerBuffer, 'sticker.tgs'), 'animated');
        const fileId = file.file_id;
        const duration = (Date.now() - startTime) / 1000;

        if (fileId) {
            uploadDuration.observe(duration);
            logUpload(fileId, chatId, true, duration);
            logger.info(`Uploaded sticker to chat ${chatId}, file_id: ${fileId}`);
            return fileId;
        }
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        errorsTotal.inc({ error_type: 'upload_error' });
        logUpload('', chatId, false, duration, (error as Error).message);
        logger.error(`Failed to upload sticker to chat ${chatId}:`, error);
    }
    return null;
}

type EnabledStickerConfig = Awaited<ReturnType<StickerConfigManager['getEnabledConfigs']>>[number];

type PreloadedConfigData = {
    enabledConfigs: EnabledStickerConfig[];
    cachedFileIds?: (string | null)[];
};

async function generateAndCacheStickers(
    ctx: Context,
    text: string,
    offset: number,
    limit: number,
    preloaded?: PreloadedConfigData,
): Promise<InlineQueryResult[]> {
    if (!text.trim()) {
        return [];
    }
    const normalizedText = text.trim();

    const enabledConfigs =
        preloaded?.enabledConfigs ?? await stickerConfigManager.getEnabledConfigs();

    if (!enabledConfigs.length) {
        logger.warn('No enabled sticker configurations found in Redis');
        return [];
    }

    const endIndex = Math.min(offset + limit, enabledConfigs.length);
    if (offset >= endIndex) {
        return [];
    }

    const batchConfigs = enabledConfigs.slice(offset, endIndex).map((c) => c.config);
    const cachedFileIds = preloaded?.cachedFileIds
        ? preloaded.cachedFileIds.slice(offset, endIndex)
        : await stickerCache.getBatch(normalizedText, batchConfigs);

    const totalItems = endIndex - offset;
    const orderedResults: (InlineQueryResult | null)[] = new Array(totalItems).fill(null);
    const tasks: StickerGenerationTask[] = [];

    for (let i = offset; i < endIndex; i++) {
        const { config: variant, id: configId } = enabledConfigs[i];
        const batchIndex = i - offset;
        const fileId = cachedFileIds[batchIndex];

        if (!fileId) {
            cacheMissesTotal.inc({ cache_type: 'sticker' });
            const taskId = crypto.randomBytes(8).toString('hex');
            const task: StickerGenerationTask = {
                id: taskId,
                text: normalizedText,
                variant,
                configId,
                index: i,
            };

            tasks.push(task);
            logger.info(
                `[${i + 1}/${enabledConfigs.length}] Queuing task for "${normalizedText}" (config: ${configId})...`,
            );
        } else {
            cacheHitsTotal.inc({ cache_type: 'sticker' });
            orderedResults[batchIndex] = {
                type: 'sticker',
                id: configId,
                sticker_file_id: fileId,
            } as InlineQueryResultCachedSticker;
            logger.debug(
                `[${i + 1}/${enabledConfigs.length}] Using cached sticker for "${normalizedText}" (config: ${configId})`,
            );
        }
    }

    const resultPromises: Promise<void>[] = tasks.map((task) =>
        (async () => {
            try {
                const result = await workerPool.submitTask(task);
                const index = result.index;

                if (result.success && result.sticker) {
                    const stickerBuffer = await stickerToBuffer(result.sticker);
                    const uploadedFileId = await uploadStickerToTelegram(ctx, stickerBuffer);
                    const animType = (task.variant as any).transform?.type || 'static';

                    if (uploadedFileId) {
                        await stickerCache.set(normalizedText, task.variant, uploadedFileId);

                        stickerGenerationDuration.observe({ animation_type: animType }, result.duration);
                        stickersGeneratedTotal.inc({ animation_type: animType, status: 'success' });
                        logStickerGeneration(animType, normalizedText, true, result.duration);
                        logger.info(`[${index + 1}/${enabledConfigs.length}] ✓ Success`);

                        const batchIndex = index - offset;
                        if (batchIndex >= 0 && batchIndex < orderedResults.length) {
                            orderedResults[batchIndex] = {
                                type: 'sticker',
                                id: task.configId,
                                sticker_file_id: uploadedFileId,
                            } as InlineQueryResultCachedSticker;
                        }
                    } else {
                        stickersGeneratedTotal.inc({ animation_type: animType, status: 'error' });
                        errorsTotal.inc({ error_type: 'upload_failed' });
                        logger.error(`[${index + 1}/${enabledConfigs.length}] ✗ Upload failed`);
                    }
                } else {
                    const animType = (task.variant as any).transform?.type || 'static';
                    stickersGeneratedTotal.inc({ animation_type: animType, status: 'error' });
                    errorsTotal.inc({ error_type: 'generation_error' });
                    logStickerGeneration(animType, normalizedText, false, result.duration, result.error);
                    logger.error(
                        `[${index + 1}/${enabledConfigs.length}] ✗ Failed: ${result.error}`,
                    );
                }
            } catch (error) {
                const index = task.index;
                const animType = (task.variant as any).transform?.type || 'static';
                stickersGeneratedTotal.inc({ animation_type: animType, status: 'error' });
                errorsTotal.inc({ error_type: 'worker_error' });
                logger.error(
                    `[${index + 1}/${enabledConfigs.length}] ✗ Worker error:`,
                    error,
                );
            }
        })(),
    );

    await Promise.all(resultPromises);

    const sequentialResults: InlineQueryResult[] = [];
    for (const result of orderedResults) {
        if (!result) {
            break;
        }
        sequentialResults.push(result);
    }

    return sequentialResults;
}

// Inline query handler with pagination
bot.on('inline_query', async (ctx) => {
    let query = ctx.inlineQuery.query || '';
    const offset = parseInt(ctx.inlineQuery.offset || '0');
    const queryStartTime = Date.now();

    const maxLength = await stickerConfigManager.getInlineQueryMaxLength();
    if (query.length > maxLength) {
        query = query.slice(0, maxLength);
    }

    logger.info(`Inline query: offset=${offset}, query="${query}", user=${ctx.from.id}, username=${ctx.from.username || ''}, first_name=${ctx.from.first_name}`);

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
                    const results: InlineQueryResult[] = recentFileIds.map((fileId, index) => ({
                        type: 'sticker',
                        id: `recent-${index}`,
                        sticker_file_id: fileId,
                    } as InlineQueryResultCachedSticker));

                    await ctx.answerInlineQuery(results, {
                        is_personal: true,
                        cache_time: 0,
                        next_offset: '',
                    });
                    inlineQueriesTotal.inc({ status: 'history' });
                    return;
                }
            } catch (error) {
                logError(error as Error, { context: 'inline_history', userId: ctx.from.id });
                logger.error('Failed to fetch recent stickers history:', error);
            }
        }
    }

    const userId = ctx.from.id.toString();
    const STICKERS_PER_PAGE_CACHED = 20; // Return 20 stickers per page when cached
    const STICKERS_PER_PAGE_GENERATE = 5; // Generate only 5 stickers per page

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

    // Clear existing debounce timer for this user
    const existingTimer = debounceTimers.get(userId);
    if (existingTimer) {
        clearTimeout(existingTimer);
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
    const allConfigs = enabledConfigs.map(c => c.config);
    const allCachedFileIds = await stickerCache.getBatch(normalizedText, allConfigs);

    const buildCachedRangeResults = (rangeSize: number): InlineQueryResult[] | null => {
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
        buildCachedRangeResults(STICKERS_PER_PAGE_GENERATE);

    if (cachedRange && cachedRange.length > 0) {
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

    // Set debounce timer for generation
    const debounceDelay = await stickerConfigManager.getDebounceDelay();
    const timer = setTimeout(async () => {
        debounceTimers.delete(userId);

        try {
            logger.info(`Generating stickers for: "${query}" (offset: ${offset})`);
            const results = await generateAndCacheStickers(
                ctx,
                query,
                offset,
                STICKERS_PER_PAGE_GENERATE,
                { enabledConfigs, cachedFileIds: allCachedFileIds },
            );

            const servedCount = results.length;
            const nextOffset =
                offset + servedCount < totalEnabled
                    ? (offset + servedCount).toString()
                    : '';

            await ctx.answerInlineQuery(results, {
                // cache_time: 300, // Cache for 5 minutes
                next_offset: nextOffset,
                is_personal: true,
            });

            inlineQueriesTotal.inc({ status: 'success' });
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
    }, debounceDelay);

    debounceTimers.set(userId, timer);
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
                const recentLimit = await stickerConfigManager.getUserRecentStickersLimit();
                const userRecentKey = `${USER_RECENT_KEY_PREFIX}:${userId}:recent`;
                await redis.lpush(userRecentKey, fileId);
                await redis.ltrim(userRecentKey, 0, recentLimit - 1);
            }
        }

        const globalConfigScoringEnabled = await stickerConfigManager.getInlineGlobalConfigScoringEnabled();
        if (globalConfigScoringEnabled && configId) {
            await redis.zincrby(STICKER_CONFIG_SCORE_ZSET_KEY, 1, configId);
        }
    } catch (error) {
        logError(error as Error, { context: 'chosen_inline_result', userId, configId });
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
        '1. Напиши `@' + username + '` в любом чате\n' +
        '2. Введи свой текст\n' +
        '3. Подожди генерации\n' +
        '4. Выбери понравившийся анимированный стиль!\n\n' +
        'Попробуй сейчас: `@' + username + ' Привет`'
        : '🎨 *Animated Sticker Bot*\n\n' +
        'Use me in inline mode to create animated text stickers!\n\n' +
        '*How to use:*\n' +
        '1. Type `@' + username + '` in any chat\n' +
        '2. Enter your text\n' +
        '3. Wait for generation\n' +
        '4. Choose from different animated styles!\n\n' +
        'Try it now: `@' + username + ' Hello`';

    const buttonText = isRussian ? 'Попробуй сейчас!' : 'Try it now!';
    const buttonQuery = isRussian ? 'Привет!' : 'Hello!';

    ctx.reply(messageText, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                {
                    text: buttonText,
                    switch_inline_query: buttonQuery,
                },
            ]],
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
            await ctx.reply('📭 No sticker configurations found in Redis.\n\nUse /init_configs to load default configurations.');
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

        const enabledCount = configs.filter(c => c.enabled).length;
        await ctx.reply(
            `\n📊 Summary:\n` +
            `• Total: ${configs.length}\n` +
            `• Enabled: ${enabledCount}\n` +
            `• Disabled: ${configs.length - enabledCount}\n\n` +
            `Use /enable <id> or /disable <id> to manage configurations.`
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
        await ctx.reply('Usage: /enable <config_id>\n\nUse /list_configs to see available configurations.');
        return;
    }

    const configId = args[1];

    try {
        const success = await stickerConfigManager.enableConfig(configId);

        if (success) {
            await ctx.reply(`✅ Configuration \`${configId}\` has been enabled.`, { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(`❌ Configuration \`${configId}\` not found.`, { parse_mode: 'Markdown' });
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
        await ctx.reply('Usage: /disable <config_id>\n\nUse /list_configs to see available configurations.');
        return;
    }

    const configId = args[1];

    try {
        const success = await stickerConfigManager.disableConfig(configId);

        if (success) {
            await ctx.reply(`✅ Configuration \`${configId}\` has been disabled.`, { parse_mode: 'Markdown' });
        } else {
            await ctx.reply(`❌ Error disabling configuration \`${configId}\`.`, { parse_mode: 'Markdown' });
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
        await ctx.reply('Usage: /view_config <config_id>\n\nUse /list_configs to see available configurations.');
        return;
    }

    const configId = args[1];

    try {
        const config = await stickerConfigManager.getConfig(configId);

        if (!config) {
            await ctx.reply(`❌ Configuration \`${configId}\` not found.`, { parse_mode: 'Markdown' });
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
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error viewing config:', error);
        await ctx.reply('❌ Error viewing configuration.');
    }
});

// Admin command: List upload chat IDs
bot.command('list_upload_chats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ You are not authorized to use this command.');
        return;
    }

    try {
        const chatIds = await stickerConfigManager.getUploadChatIds();

        if (chatIds.length === 0) {
            await ctx.reply('📭 No upload chat IDs configured.\n\nUse /add_upload_chat <chat_id> to add one.');
            return;
        }

        let message = `📋 *Upload Chat IDs* (${chatIds.length} total)\n\n`;
        chatIds.forEach((id, index) => {
            message += `${index + 1}. \`${id}\`\n`;
        });

        await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error listing upload chat IDs:', error);
        await ctx.reply('❌ Error listing upload chat IDs.');
    }
});

// Admin command: Add upload chat ID
bot.command('add_upload_chat', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ You are not authorized to use this command.');
        return;
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /add_upload_chat <chat_id>\n\nExample: /add_upload_chat 123456789');
        return;
    }

    const chatId = args[1];

    try {
        await stickerConfigManager.addUploadChatId(chatId);
        await ctx.reply(`✅ Chat ID \`${chatId}\` has been added to upload chats.`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error adding upload chat ID:', error);
        await ctx.reply('❌ Error adding upload chat ID.');
    }
});

// Admin command: Remove upload chat ID
bot.command('remove_upload_chat', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ You are not authorized to use this command.');
        return;
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /remove_upload_chat <chat_id>\n\nUse /list_upload_chats to see available chat IDs.');
        return;
    }

    const chatId = args[1];

    try {
        await stickerConfigManager.removeUploadChatId(chatId);
        await ctx.reply(`✅ Chat ID \`${chatId}\` has been removed from upload chats.`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Error removing upload chat ID:', error);
        await ctx.reply('❌ Error removing upload chat ID.');
    }
});

// Admin command: Set all upload chat IDs at once
bot.command('set_upload_chats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        await ctx.reply('❌ You are not authorized to use this command.');
        return;
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('Usage: /set_upload_chats <chat_id1,chat_id2,...>\n\nExample: /set_upload_chats 123456789,987654321');
        return;
    }

    const chatIdsStr = args.slice(1).join(' ');
    const chatIds = chatIdsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);

    if (chatIds.length === 0) {
        await ctx.reply('❌ No valid chat IDs provided.');
        return;
    }

    try {
        await stickerConfigManager.saveUploadChatIds(chatIds);
        await ctx.reply(
            `✅ Upload chat IDs updated!\n\n` +
            `Set ${chatIds.length} chat ID(s):\n` +
            chatIds.map((id, i) => `${i + 1}. \`${id}\``).join('\n'),
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error setting upload chat IDs:', error);
        await ctx.reply('❌ Error setting upload chat IDs.');
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
            { parse_mode: 'Markdown' }
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
            'Example: /set_debounce_delay 500 (0.5 seconds)'
        );
        return;
    }

    const delayMs = parseInt(args[1], 10);

    if (isNaN(delayMs) || delayMs < 0) {
        await ctx.reply('❌ Invalid delay value. Please provide a positive number in milliseconds.');
        return;
    }

    try {
        await stickerConfigManager.setDebounceDelay(delayMs);
        await ctx.reply(
            `✅ Debounce delay updated!\n\n` +
            `New delay: \`${delayMs}ms\` (${(delayMs / 1000).toFixed(1)}s)`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error('Error setting debounce delay:', error);
        await ctx.reply('❌ Error setting debounce delay.');
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
        await getDataSource().catch(err => {
            logger.error('PostgreSQL connection failed (continuing without DB):', err);
        });
        await workerPool.initialize();
        logger.info('Worker pool initialized successfully');

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
