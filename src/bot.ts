import { Telegraf, Context } from 'telegraf';
import { InlineQueryResult, InlineQueryResultCachedSticker } from 'telegraf/types';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
    generateTextSticker,
    TransformAnimationType,
    ColorAnimationType,
    saveStickerToFile,
    LetterAnimationType,
    PathMorphAnimationType,
    GenerateStickerOptions,
} from './index';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN environment variable is required');
}

const UPLOAD_CHAT_IDS = (process.env.UPLOAD_CHAT_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

if (UPLOAD_CHAT_IDS.length === 0) {
    throw new Error('UPLOAD_CHAT_IDS environment variable is required (comma-separated chat IDs)');
}

const bot = new Telegraf(BOT_TOKEN);

// Cache uploaded sticker file_ids by text and variant
const stickerCache = new Map<string, Map<number, string>>();

// Debounce state for inline queries
const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_DELAY = 2000; // 2 second

// Animation combinations for variety
const STICKER_VARIANTS: Omit<GenerateStickerOptions, 'text'>[] = [
    // {
    //     transform: TransformAnimationType.SlideLoop,
    //     color: ColorAnimationType.Rainbow,
    //     name: 'Slide Rainbow',
    // },
    // {
    //     transform: TransformAnimationType.ScalePulse,
    //     color: ColorAnimationType.Rainbow,
    //     name: 'Scale Rainbow',
    // },
    // {
    //     transform: TransformAnimationType.ScalePulse,
    //     color: ColorAnimationType.None,
    //     letterAnimation: LetterAnimationType.Vibrate,
    //     name: 'Rotate None',
    // },
    // {
    //     transform: TransformAnimationType.Bounce,
    //     color: ColorAnimationType.Rainbow,
    //     name: 'Bounce Rainbow',
    // },
    // {
    //     transform: TransformAnimationType.ShakeLoop,
    //     color: ColorAnimationType.Rainbow,
    //     name: 'Shake Rainbow',
    // },
    // {
    //     transform: TransformAnimationType.ScalePulse,
    //     color: ColorAnimationType.Rainbow,
    //     letterAnimation: LetterAnimationType.TypingFall,
    //     name: 'Typing Fall Rainbow',
    // },
    {
        transformAnimation: TransformAnimationType.ScalePulse,
        colorAnimation: ColorAnimationType.CycleRGB,
        letterAnimation: LetterAnimationType.Wave,
        strokeAnimation: ColorAnimationType.Rainbow,
        pathMorphAnimation: PathMorphAnimationType.None,
        strokeWidth: 2,
    },
    {
        transformAnimation: TransformAnimationType.ScalePulse,
        colorAnimation: ColorAnimationType.Rainbow,
        letterAnimation: LetterAnimationType.Wave,
        strokeAnimation: ColorAnimationType.CycleRGB,
        pathMorphAnimation: PathMorphAnimationType.None,
        strokeWidth: 80,
    },
    // {
    //     transform: TransformAnimationType.ScalePulse,
    //     color: ColorAnimationType.None,
    //     letterAnimation: LetterAnimationType.Wave,
    //     name: 'Wave Rainbow',
    // },
    // {
    //     transform: TransformAnimationType.ShakeLoop,
    //     color: ColorAnimationType.None,
    //     letterAnimation: LetterAnimationType.ZigZag,
    //     name: 'ZigZag Pulse',
    // },
    // {
    //     transform: TransformAnimationType.RotateContinuous,
    //     color: ColorAnimationType.None,
    //     letterAnimation: LetterAnimationType.Wave,
    //     name: 'Warp RGB Shake',
    // },
    // {
    //     transform: TransformAnimationType.Bounce,
    //     color: ColorAnimationType.None,
    //     name: 'Bounce RGB',
    // },
    // {
    //     transform: TransformAnimationType.ShakeLoop,
    //     color: ColorAnimationType.CycleRGB,
    //     name: 'Shake RGB',
    // },
    // {
    //     transform: TransformAnimationType.RotateContinuous,
    //     color: ColorAnimationType.Pulse,
    //     name: 'Rotate Pulse',
    // },
    // {
    //     transform: TransformAnimationType.Vibrate,
    //     color: ColorAnimationType.Pulse,
    //     name: 'Vibrate Pulse',
    // },
    // {
    //     transform: TransformAnimationType.ShakeLoop,
    //     color: ColorAnimationType.None,
    //     name: 'Scale None',
    // },
    // {
    //     transform: TransformAnimationType.Bounce,
    //     color: ColorAnimationType.CycleRGB,
    //     name: 'Scale CycleRGB',
    // },
    // {
    //     transform: TransformAnimationType.ScalePulse,
    //     color: ColorAnimationType.Pulse,
    //     name: 'Scale Pulse',
    // },
];

async function ensureDir(dirPath: string) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch { }
}

// Store which chat was used last for round-robin distribution
let lastUsedChatIndex = 0;

async function uploadStickerToTelegram(
    ctx: Context,
    filepath: string,
): Promise<string | null> {
    // Use round-robin to distribute uploads across chats (avoid rate limits)
    const chatId = UPLOAD_CHAT_IDS[lastUsedChatIndex];
    lastUsedChatIndex = (lastUsedChatIndex + 1) % UPLOAD_CHAT_IDS.length;

    try {
        const message = await ctx.telegram.sendSticker(
            chatId,
            { source: filepath },
        );
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

    // Check cache first
    if (!stickerCache.has(normalizedText)) {
        stickerCache.set(normalizedText, new Map());
    }
    const textCache = stickerCache.get(normalizedText)!;

    // Calculate which stickers to generate for this batch
    const endIndex = Math.min(offset + limit, STICKER_VARIANTS.length);

    // Generate stickers in parallel
    const generationPromises = [];

    for (let i = offset; i < endIndex; i++) {
        const variant = STICKER_VARIANTS[i];
        let fileId = textCache.get(i);

        // Generate if not cached
        if (!fileId) {
            const generationPromise = (async (index: number, variantData: typeof STICKER_VARIANTS[0]) => {
                const id = crypto.randomBytes(8).toString('hex');
                const filename = `${id}.tgs`;
                const filepath = path.join(tempDir, filename);

                try {
                    console.log(`[${index + 1}/${STICKER_VARIANTS.length}] Generating for "${normalizedText}"...`);
                    const sticker = await generateTextSticker({
                        text: normalizedText,
                        fontSize: 72,
                        frameRate: 60,
                        duration: 180,
                        ...variantData,
                    });

                    console.log(`[${index + 1}/${STICKER_VARIANTS.length}] Saving to ${filename}...`);
                    await saveStickerToFile(sticker, filepath);

                    // Upload to Telegram and get file_id
                    console.log(`[${index + 1}/${STICKER_VARIANTS.length}] Uploading to Telegram...`);
                    const uploadedFileId = await uploadStickerToTelegram(ctx, filepath);

                    if (uploadedFileId) {
                        textCache.set(index, uploadedFileId);
                        console.log(`[${index + 1}/${STICKER_VARIANTS.length}] ✓ Success`);
                        return { index, fileId: uploadedFileId };
                    } else {
                        console.error(`[${index + 1}/${STICKER_VARIANTS.length}] ✗ Upload failed`);
                    }

                    // Clean up temp file
                    try {
                        await fs.unlink(filepath);
                    } catch { }

                } catch (error) {
                    console.error(`[${index + 1}/${STICKER_VARIANTS.length}] ✗ Failed to generate for "${normalizedText}":`, error);
                }

                return { index, fileId: null };
            })(i, variant);

            generationPromises.push(generationPromise);
        } else {
            console.log(`[${i + 1}/${STICKER_VARIANTS.length}] Using cached sticker for "${normalizedText}"`);
            generationPromises.push(Promise.resolve({ index: i, fileId }));
        }
    }

    // Wait for all generations to complete
    const generationResults = await Promise.all(generationPromises);

    // Build results array
    const results: InlineQueryResult[] = [];
    for (const { index, fileId } of generationResults) {
        if (fileId) {
            // Create safe ID without spaces or special chars
            const safeId = crypto.createHash('md5')
                .update(`${normalizedText}_${index}`)
                .digest('hex')
                .substring(0, 32);

            results.push({
                type: 'sticker',
                id: safeId,
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
    const userId = ctx.from.id.toString();
    const queryId = ctx.inlineQuery.id;
    const STICKERS_PER_PAGE = 15;

    // Clear existing debounce timer for this user
    const existingTimer = debounceTimers.get(userId);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    // Answer immediately with cached results if available
    const normalizedText = query.toUpperCase().trim();
    if (stickerCache.has(normalizedText)) {
        const textCache = stickerCache.get(normalizedText)!;
        const cachedResults: InlineQueryResult[] = [];

        for (let i = 0; i < STICKER_VARIANTS.length; i++) {
            const fileId = textCache.get(i);
            if (fileId) {
                const safeId = crypto.createHash('md5')
                    .update(`${normalizedText}_${i}`)
                    .digest('hex')
                    .substring(0, 32);

                cachedResults.push({
                    type: 'sticker',
                    id: safeId,
                    sticker_file_id: fileId,
                } as InlineQueryResultCachedSticker);
            }
        }

        if (cachedResults.length > 0) {
            try {
                const paginatedResults = cachedResults.slice(offset, offset + STICKERS_PER_PAGE);
                const nextOffset = offset + STICKERS_PER_PAGE < cachedResults.length
                    ? (offset + STICKERS_PER_PAGE).toString()
                    : '';

                await ctx.answerInlineQuery(paginatedResults, {
                    cache_time: 300,
                    next_offset: nextOffset,
                });
                return;
            } catch (error) {
                console.error('Error answering with cached results:', error);
            }
        }
    }

    // Set debounce timer for generation
    const timer = setTimeout(async () => {
        debounceTimers.delete(userId);

        try {
            console.log(`Generating stickers for: "${query}" (offset: ${offset})`);
            const results = await generateAndCacheStickers(ctx, query, offset, STICKERS_PER_PAGE);

            const nextOffset = offset + STICKERS_PER_PAGE < STICKER_VARIANTS.length
                ? (offset + STICKERS_PER_PAGE).toString()
                : '';

            await ctx.answerInlineQuery(results, {
                cache_time: 300, // Cache for 5 minutes
                next_offset: nextOffset,
            });
        } catch (error) {
            console.error('Error handling inline query:', error);
            // Ignore "query is too old" errors - Telegram already closed the query
            if (error instanceof Error && error.message.includes('query is too old')) {
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
    }, DEBOUNCE_DELAY);

    debounceTimers.set(userId, timer);
});

bot.command('start', (ctx) => {
    console.log('Received /start command from user:', ctx.from.id);
    ctx.reply(
        '🎨 *Animated Sticker Bot*\n\n' +
        'Use me in inline mode to create animated text stickers!\n\n' +
        '*How to use:*\n' +
        '1. Type `@' + ctx.botInfo.username + '` in any chat\n' +
        '2. Enter your text\n' +
        '3. Wait 2 seconds for generation\n' +
        '4. Choose from 8 different animated styles!\n\n' +
        '✨ Animations include: Rainbow slide, Scale pulse, Rotate, Bounce, Shake, and more!\n\n' +
        'Try it now: `@' + ctx.botInfo.username + ' Hello`',
        { parse_mode: 'Markdown' }
    );
});

bot.launch();

console.log('🤖 Bot started successfully!');
console.log('Bot username:', bot.botInfo?.username);
console.log('Press Ctrl+C to stop.');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

