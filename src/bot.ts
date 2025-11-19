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

const BOT_TOKEN = process.env.BOT_TOKEN || '';
if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN environment variable is required');
}

const UPLOAD_CHAT_IDS = (process.env.UPLOAD_CHAT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

if (UPLOAD_CHAT_IDS.length === 0) {
    throw new Error(
        'UPLOAD_CHAT_IDS environment variable is required (comma-separated chat IDs)',
    );
}

const bot = new Telegraf(BOT_TOKEN);

// Cache uploaded sticker file_ids by text and variant
const stickerCache = new Map<string, Map<number, string>>();

// Debounce state for inline queries
const debounceTimers = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_DELAY = 2000; // 2 second

// Animation combinations for variety
// Refined, laconic variant set (25) without Warp morphs and without compose in transform/color.
const STICKER_VARIANTS: Omit<GenerateStickerOptions, 'text'>[] = [
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        strokeAnimations: [{ type: ColorAnimationType.TransparencyPulse }],
        strokeColor: [1, 0.1, 0.1],
        strokeWidth: 3,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        pathMorphAnimations: [{ type: PathMorphAnimationType.WarpAiry }],
        fillColor: [1, 1, 1],
        strokeWidth: 1,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        fillColor: [0.5, 0.5, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [0, 0, 0],
        strokeColor: [1, 1, 1],
        strokeWidth: 4,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        strokeAnimations: [{ type: ColorAnimationType.None }],
        fillColor: [0.08, 0.08, 0.08],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [0.9, 0.95, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [0.95, 0.95, 0.95],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [1, 0.9, 0.9],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Vibrate }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [0.85, 1, 0.85],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        fillColor: [0, 0.7, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
        fillColor: [0.2, 0.2, 0.2],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [0.95, 0.9, 0.8],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        fillColor: [0.96, 0.96, 0.96],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [1, 0.9, 0.6],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [0.9, 1, 0.9],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [0.9, 0.9, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeWidth: 2,
        strokeColor: [0.2, 0.6, 1],
        fillColor: [0.1, 0.1, 0.1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [0.9, 0.85, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [0.8, 0.95, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        strokeAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeWidth: 2,
        strokeColor: [0, 0.5, 1],
        fillColor: [0.95, 0.95, 0.95],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.None }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
        fillColor: [0.06, 0.06, 0.06],
    },
];

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
            const generationPromise = (async (
                index: number,
                variantData: (typeof STICKER_VARIANTS)[0],
            ) => {
                const id = crypto.randomBytes(8).toString('hex');
                const filename = `${id}.tgs`;
                const filepath = path.join(tempDir, filename);

                try {
                    console.log(
                        `[${index + 1}/${STICKER_VARIANTS.length
                        }] Generating for "${normalizedText}"...`,
                    );
                    const sticker = await generateSticker({
                        text: normalizedText,
                        fontSize: 72,
                        frameRate: 60,
                        duration: 180,
                        ...variantData,
                    });

                    console.log(
                        `[${index + 1}/${STICKER_VARIANTS.length
                        }] Saving to ${filename}...`,
                    );
                    await saveStickerToFile(sticker, filepath);

                    // Upload to Telegram and get file_id
                    console.log(
                        `[${index + 1}/${STICKER_VARIANTS.length
                        }] Uploading to Telegram...`,
                    );
                    const uploadedFileId = await uploadStickerToTelegram(ctx, filepath);

                    if (uploadedFileId) {
                        textCache.set(index, uploadedFileId);
                        console.log(`[${index + 1}/${STICKER_VARIANTS.length}] ✓ Success`);
                        return { index, fileId: uploadedFileId };
                    } else {
                        console.error(
                            `[${index + 1}/${STICKER_VARIANTS.length}] ✗ Upload failed`,
                        );
                    }

                    // Clean up temp file
                    try {
                        await fs.unlink(filepath);
                    } catch { }
                } catch (error) {
                    console.error(
                        `[${index + 1}/${STICKER_VARIANTS.length
                        }] ✗ Failed to generate for "${normalizedText}":`,
                        error,
                    );
                }

                return { index, fileId: null };
            })(i, variant);

            generationPromises.push(generationPromise);
        } else {
            console.log(
                `[${i + 1}/${STICKER_VARIANTS.length
                }] Using cached sticker for "${normalizedText}"`,
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
            // Create safe ID without spaces or special chars
            const safeId = crypto
                .createHash('md5')
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
    console.log(`offset: ${offset}`);

    const userId = ctx.from.id.toString();
    const queryId = ctx.inlineQuery.id;
    const STICKERS_PER_PAGE = 5;

    // No more pages to serve
    if (offset >= STICKER_VARIANTS.length) {
        await ctx.answerInlineQuery([], { cache_time: 300, next_offset: '' });
        return;
    }

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
                const safeId = crypto
                    .createHash('md5')
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
                // If we don't have enough cached results for this offset, fall through to generation
                if (offset < cachedResults.length) {
                    const paginatedResults = cachedResults.slice(
                        offset,
                        offset + STICKERS_PER_PAGE,
                    );
                    const nextOffset =
                        offset + STICKERS_PER_PAGE < cachedResults.length
                            ? (offset + STICKERS_PER_PAGE).toString()
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
    }

    // Set debounce timer for generation
    const timer = setTimeout(async () => {
        debounceTimers.delete(userId);

        try {
            console.log(`Generating stickers for: "${query}" (offset: ${offset})`);
            const results = await generateAndCacheStickers(
                ctx,
                query,
                offset,
                STICKERS_PER_PAGE,
            );

            const nextOffset =
                offset + STICKERS_PER_PAGE < STICKER_VARIANTS.length
                    ? (offset + STICKERS_PER_PAGE).toString()
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
    }, DEBOUNCE_DELAY);

    debounceTimers.set(userId, timer);
});

bot.command('start', (ctx) => {
    console.log('Received /start command from user:', ctx.from.id);
    ctx.reply(
        '🎨 *Animated Sticker Bot*\n\n' +
        'Use me in inline mode to create animated text stickers!\n\n' +
        '*How to use:*\n' +
        '1. Type `@' +
        ctx.botInfo.username +
        '` in any chat\n' +
        '2. Enter your text\n' +
        '3. Wait 2 seconds for generation\n' +
        '4. Choose from 8 different animated styles!\n\n' +
        '✨ Animations include: Rainbow slide, Scale pulse, Rotate, Bounce, Shake, and more!\n\n' +
        'Try it now: `@' +
        ctx.botInfo.username +
        ' Hello`',
        { parse_mode: 'Markdown' },
    );
});

bot.launch();

console.log('🤖 Bot started successfully!');
console.log('Bot username:', bot.botInfo?.username);
console.log('Press Ctrl+C to stop.');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
