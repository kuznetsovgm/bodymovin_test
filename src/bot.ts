import { Telegraf, Context } from 'telegraf';
import {
    InlineQueryResult,
    InlineQueryResultCachedSticker,
} from 'telegraf/types';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
    generateSticker,
    TransformAnimationType,
    ColorAnimationType,
    saveStickerToFile,
    LetterAnimationType,
    PathMorphAnimationType,
    GenerateStickerOptions,
    blendLayerTransform,
} from './index';
import { ensureDir } from './shared/fs';
import {
    additiveColor,
    blendColor,
    blendTransform,
    timelineColor,
} from './animations/composers';
import { blendLetterTransform } from './animations/letter';
import { stickerCache } from './cache';
import { StickerConfigManager } from './config-manager';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN environment variable is required');
}

const bot = new Telegraf(BOT_TOKEN);

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
            console.log('Initializing upload chat IDs from environment variable...');
            await stickerConfigManager.saveUploadChatIds(UPLOAD_CHAT_IDS_ENV);
            console.log(`✓ Initialized ${UPLOAD_CHAT_IDS_ENV.length} upload chat IDs`);
        }
    }).catch(err => {
        console.error('Error initializing upload chat IDs:', err);
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
    filepath: string,
): Promise<string | null> {
    // Get upload chat IDs from Redis (with local cache)
    const uploadChatIds = await stickerConfigManager.getUploadChatIds();

    if (uploadChatIds.length === 0) {
        console.error('No upload chat IDs configured. Use /set_upload_chats command.');
        return null;
    }

    // Use round-robin to distribute uploads across chats (avoid rate limits)
    const chatId = uploadChatIds[lastUsedChatIndex];
    lastUsedChatIndex = (lastUsedChatIndex + 1) % uploadChatIds.length;

    try {
        const message = await ctx.telegram.sendSticker(chatId, {
            source: filepath,
        });
        const fileId = message.sticker?.file_id;
        if (fileId) {
            console.log(`Uploaded sticker to chat ${chatId}, file_id: ${fileId}`);
            return fileId;
        }
    } catch (error) {
        console.error(`Failed to upload sticker to chat ${chatId}:`, error);
    }
    return null;
}

async function generateAndCacheStickers(
    ctx: Context,
    text: string,
    offset: number,
    limit: number,
): Promise<InlineQueryResult[]> {
    if (!text.trim()) {
        return [];
    }

    const normalizedText = text.toUpperCase().trim();
    const tempDir = path.resolve('./temp');

    await ensureDir(tempDir);

    // Load enabled sticker configs from Redis
    const enabledConfigs = await stickerConfigManager.getEnabledConfigs();

    if (enabledConfigs.length === 0) {
        console.log('No enabled sticker configurations found in Redis');
        return [];
    }

    // Calculate which stickers to generate for this batch
    const endIndex = Math.min(offset + limit, enabledConfigs.length);

    // Get all configs for this batch
    const batchConfigs = enabledConfigs.slice(offset, endIndex).map(c => c.config);

    // Fetch all cached file_ids in one batch request
    const cachedFileIds = await stickerCache.getBatch(normalizedText, batchConfigs);

    // Generate stickers in parallel
    const generationPromises = [];

    for (let i = offset; i < endIndex; i++) {
        const { config: variant, id: configId } = enabledConfigs[i];
        const batchIndex = i - offset;
        const fileId = cachedFileIds[batchIndex];

        // Generate if not cached
        if (!fileId) {
            const generationPromise = (async (
                index: number,
                variantData: Omit<GenerateStickerOptions, 'text'>,
                configIdForLog: string,
            ) => {
                const id = crypto.randomBytes(8).toString('hex');
                const filename = `${id}.tgs`;
                const filepath = path.join(tempDir, filename);

                try {
                    console.log(
                        `[${index + 1}/${enabledConfigs.length
                        }] Generating for "${normalizedText}" (config: ${configIdForLog})...`,
                    );
                    const sticker = await generateSticker({
                        text: normalizedText,
                        fontSize: 72,
                        frameRate: 60,
                        duration: 180,
                        ...variantData,
                    });

                    console.log(
                        `[${index + 1}/${enabledConfigs.length
                        }] Saving to ${filename}...`,
                    );
                    await saveStickerToFile(sticker, filepath);

                    // Upload to Telegram and get file_id
                    console.log(
                        `[${index + 1}/${enabledConfigs.length
                        }] Uploading to Telegram...`,
                    );
                    const uploadedFileId = await uploadStickerToTelegram(ctx, filepath);

                    if (uploadedFileId) {
                        // Cache to Redis with config as key
                        await stickerCache.set(normalizedText, variantData, uploadedFileId);
                        console.log(`[${index + 1}/${enabledConfigs.length}] ✓ Success`);
                        return { index, fileId: uploadedFileId };
                    } else {
                        console.error(
                            `[${index + 1}/${enabledConfigs.length}] ✗ Upload failed`,
                        );
                    }

                    // Clean up temp file
                    try {
                        await fs.unlink(filepath);
                    } catch { }
                } catch (error) {
                    console.error(
                        `[${index + 1}/${enabledConfigs.length
                        }] ✗ Failed to generate for "${normalizedText}":`,
                        error,
                    );
                }

                return { index, fileId: null };
            })(i, variant, configId);

            generationPromises.push(generationPromise);
        } else {
            console.log(
                `[${i + 1}/${enabledConfigs.length
                }] Using cached sticker for "${normalizedText}" (config: ${configId})`,
            );
            generationPromises.push(Promise.resolve({ index: i, fileId }));
        }
    }

    // Wait for all generations to complete
    const generationResults = await Promise.all(generationPromises);

    // Build results array
    const results: InlineQueryResult[] = [];
    for (const { index, fileId } of generationResults) {
        if (fileId) {
            // Use config hash as sticker ID (same as cache key)
            const variant = enabledConfigs[index].config;
            const configHash = stickerCache.generateConfigHash(variant);

            results.push({
                type: 'sticker',
                id: configHash,
                sticker_file_id: fileId,
            } as InlineQueryResultCachedSticker);
        }
    }

    return results;
}

// Inline query handler with pagination
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query;
    const offset = parseInt(ctx.inlineQuery.offset || '0');
    console.log(`offset: ${offset}`);

    const userId = ctx.from.id.toString();
    const queryId = ctx.inlineQuery.id;
    const STICKERS_PER_PAGE_CACHED = 20; // Return 20 stickers per page when cached
    const STICKERS_PER_PAGE_GENERATE = 5; // Generate only 5 stickers per page

    // Load enabled configs count
    const enabledCount = await stickerConfigManager.getEnabledCount();

    // No more pages to serve
    if (offset >= enabledCount) {
        await ctx.answerInlineQuery([], { cache_time: 300, next_offset: '' });
        return;
    }

    // Clear existing debounce timer for this user
    const existingTimer = debounceTimers.get(userId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    // Answer immediately with cached results if available from Redis
    const normalizedText = query.toUpperCase().trim();

    // Try to get cached results for all enabled variants in one batch request
    const enabledConfigs = await stickerConfigManager.getEnabledConfigs();
    const allConfigs = enabledConfigs.map(c => c.config);
    const allCachedFileIds = await stickerCache.getBatch(normalizedText, allConfigs);

    const cachedResults: InlineQueryResult[] = [];

    for (let i = 0; i < enabledConfigs.length; i++) {
        const fileId = allCachedFileIds[i];

        if (fileId) {
            // Use config hash as sticker ID (same as cache key)
            const config = enabledConfigs[i].config;
            const configHash = stickerCache.generateConfigHash(config);

            cachedResults.push({
                type: 'sticker',
                id: configHash,
                sticker_file_id: fileId,
            } as InlineQueryResultCachedSticker);
        }
    }

    if (cachedResults.length > 0) {
        try {
            // If we don't have enough cached results for this offset, fall through to generation
            if (offset < cachedResults.length) {
                // Return up to 20 cached stickers per page
                const paginatedResults = cachedResults.slice(
                    offset,
                    offset + STICKERS_PER_PAGE_CACHED,
                );
                const nextOffset =
                    offset + STICKERS_PER_PAGE_CACHED < cachedResults.length
                        ? (offset + STICKERS_PER_PAGE_CACHED).toString()
                        : '';

                await ctx.answerInlineQuery(paginatedResults, {
                    // cache_time: 300,
                    next_offset: nextOffset,
                });
                return;
            }
        } catch (error) {
            console.error('Error answering with cached results:', error);
        }
    }

    // Set debounce timer for generation
    const debounceDelay = await stickerConfigManager.getDebounceDelay();
    const timer = setTimeout(async () => {
        debounceTimers.delete(userId);

        try {
            console.log(`Generating stickers for: "${query}" (offset: ${offset})`);
            const results = await generateAndCacheStickers(
                ctx,
                query,
                offset,
                STICKERS_PER_PAGE_GENERATE,
            );

            const nextOffset =
                offset + STICKERS_PER_PAGE_GENERATE < enabledCount
                    ? (offset + STICKERS_PER_PAGE_GENERATE).toString()
                    : '';

            await ctx.answerInlineQuery(results, {
                // cache_time: 300, // Cache for 5 minutes
                next_offset: nextOffset,
            });
        } catch (error) {
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

bot.command('start', async (ctx) => {
    console.log('Received /start command from user:', ctx.from.id);
    const enabledCount = await stickerConfigManager.getEnabledCount();

    ctx.reply(
        '🎨 *Animated Sticker Bot*\n\n' +
        'Use me in inline mode to create animated text stickers!\n\n' +
        '*How to use:*\n' +
        '1. Type `@' +
        ctx.botInfo.username +
        '` in any chat\n' +
        '2. Enter your text\n' +
        '3. Wait 2 seconds for generation\n' +
        `4. Choose from ${enabledCount} different animated styles!\n\n` +
        '✨ Animations include: Rainbow slide, Scale pulse, Rotate, Bounce, Shake, and more!\n\n' +
        'Try it now: `@' +
        ctx.botInfo.username +
        ' Hello`',
        { parse_mode: 'Markdown' },
    );
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

bot.launch();

console.log('🤖 Bot started successfully!');
console.log('Bot username:', bot.botInfo?.username);
console.log('Press Ctrl+C to stop.');

// Enable graceful stop
process.once('SIGINT', async () => {
    await stickerCache.close();
    bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    await stickerCache.close();
    bot.stop('SIGTERM');
});
