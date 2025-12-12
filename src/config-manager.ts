import Redis from 'ioredis';
import * as crypto from 'crypto';
import { GenerateStickerOptions } from './index';

export type StickerConfigMeta = {
    name?: string;
};

export type StickerConfigRecord = {
    config: Omit<GenerateStickerOptions, 'text'>;
    meta?: StickerConfigMeta;
};

export const STICKER_CONFIG_SCORE_ZSET_KEY = 'sticker:config:score';

const CONFIG_PREFIX = 'config:';
const CONFIG_ENABLED_ZSET = 'config:enabled:ordered';
const UPLOAD_CHAT_IDS_KEY = 'config:upload_chat_ids';
const DEBOUNCE_DELAY_KEY = 'config:debounce_delay';
const USER_RECENT_STICKERS_LIMIT_KEY = 'config:inline:user_recent_limit';
const INLINE_QUERY_MAX_LENGTH_KEY = 'config:inline:query_max_length';
const INLINE_HISTORY_ENABLED_KEY = 'config:inline:history_enabled';
const INLINE_GLOBAL_CONFIG_SCORING_ENABLED_KEY = 'config:inline:global_config_scoring_enabled';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DEBOUNCE_DELAY = 2000; // 2 seconds default
const DEFAULT_USER_RECENT_STICKERS_LIMIT = 10;
const DEFAULT_INLINE_QUERY_MAX_LENGTH = 256;
const DEFAULT_INLINE_HISTORY_ENABLED = true;
const DEFAULT_INLINE_GLOBAL_CONFIG_SCORING_ENABLED = false;

/**
 * Sticker configuration manager
 */
export class StickerConfigManager {
    private redis: Redis;
    private uploadChatIdsCache: string[] | null = null;
    private uploadChatIdsCacheTime: number = 0;
    private debounceDelayCache: number | null = null;
    private debounceDelayCacheTime: number = 0;
    private recentLimitCache: number | null = null;
    private recentLimitCacheTime: number = 0;
    private inlineQueryMaxLengthCache: number | null = null;
    private inlineQueryMaxLengthCacheTime: number = 0;
    private inlineHistoryEnabledCache: boolean | null = null;
    private inlineHistoryEnabledCacheTime: number = 0;
    private inlineGlobalConfigScoringEnabledCache: boolean | null = null;
    private inlineGlobalConfigScoringEnabledCacheTime: number = 0;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    private async getOrderedEnabledIds(): Promise<string[]> {
        return this.redis.zrange(CONFIG_ENABLED_ZSET, 0, -1);
    }

    private async getNextEnabledOrderScore(): Promise<number> {
        const last = await this.redis.zrevrange(CONFIG_ENABLED_ZSET, 0, 0, 'WITHSCORES');
        if (Array.isArray(last) && last.length >= 2) {
            const score = Number(last[1]);
            if (Number.isFinite(score)) {
                return score + 1;
            }
        }
        return 1;
    }

    private async addToEnabledOrder(configId: string, score?: number): Promise<void> {
        if (score === undefined) {
            const existing = await this.redis.zscore(CONFIG_ENABLED_ZSET, configId);
            if (existing !== null) {
                return;
            }
        }
        const finalScore =
            typeof score === 'number' && Number.isFinite(score)
                ? score
                : await this.getNextEnabledOrderScore();
        await this.redis.zadd(CONFIG_ENABLED_ZSET, finalScore, configId);
    }

    private async getBooleanFlag(
        key: string,
        defaultValue: boolean,
        cacheValue: boolean | null,
        cacheTime: number,
        setCache: (value: boolean, time: number) => void,
    ): Promise<boolean> {
        const now = Date.now();
        if (cacheValue !== null && now - cacheTime < CACHE_TTL_MS) {
            return cacheValue;
        }

        const value = await this.redis.get(key);
        const parsed = value === null ? defaultValue : value === '1' || value.toLowerCase() === 'true';
        setCache(parsed, now);
        return parsed;
    }

    private async setBooleanFlag(key: string, value: boolean): Promise<void> {
        await this.redis.set(key, value ? '1' : '0');
    }

    private sanitizeConfig(config: Omit<GenerateStickerOptions, 'text'>) {
        const {
            width: _ignoredWidth,
            height: _ignoredHeight,
            fontSize: _ignoredFontSize,
            textTransform,
            textCurve,
            ...rest
        } = config;
        const sanitized: any = { ...rest };
        if (textTransform !== undefined) {
            sanitized.textTransform = textTransform;
        }
        if (textCurve !== undefined) {
            sanitized.textCurve = textCurve;
        }
        return sanitized as Omit<GenerateStickerOptions, 'text'>;
    }

    private sanitizeMeta(meta?: StickerConfigMeta | null): StickerConfigMeta | undefined {
        if (!meta) {
            return undefined;
        }
        const sanitized: StickerConfigMeta = {};
        if (typeof meta.name === 'string') {
            const trimmed = meta.name.trim();
            if (trimmed) {
                sanitized.name = trimmed;
            }
        }
        return Object.keys(sanitized).length ? sanitized : undefined;
    }

    private parseStoredConfig(configJson: string | null): StickerConfigRecord | null {
        if (!configJson) {
            return null;
        }

        let parsed: any;
        try {
            parsed = JSON.parse(configJson);
        } catch (error) {
            console.error('Error parsing stored config:', error);
            return null;
        }

        if (parsed && typeof parsed === 'object' && parsed.config) {
            const configData =
                parsed.config && typeof parsed.config === 'object' ? parsed.config : {};
            const sanitizedConfig = this.sanitizeConfig(configData as Omit<GenerateStickerOptions, 'text'>);
            const sanitizedMeta = this.sanitizeMeta(parsed.meta);
            return sanitizedMeta ? { config: sanitizedConfig, meta: sanitizedMeta } : { config: sanitizedConfig };
        }

        const sanitizedConfig = this.sanitizeConfig(
            (parsed && typeof parsed === 'object' ? parsed : {}) as Omit<GenerateStickerOptions, 'text'>,
        );
        return { config: sanitizedConfig };
    }

    /**
     * Generate unique ID for a sticker configuration
     */
    private generateConfigId(config: Omit<GenerateStickerOptions, 'text'>): string {
        const configString = JSON.stringify(config);
        return crypto.createHash('sha256').update(configString).digest('hex');
    }

    /**
     * Save a sticker configuration to Redis
     */
    async saveConfig(
        config: Omit<GenerateStickerOptions, 'text'>,
        enabled: boolean = true,
        meta?: StickerConfigMeta,
    ): Promise<string> {
        try {
            const sanitizedConfig = this.sanitizeConfig(config);
            const configId = this.generateConfigId(sanitizedConfig);
            const key = `${CONFIG_PREFIX}${configId}`;
            const payload: StickerConfigRecord = { config: sanitizedConfig };
            const sanitizedMeta = this.sanitizeMeta(meta);
            if (sanitizedMeta) {
                payload.meta = sanitizedMeta;
            }

            // Save config as JSON
            await this.redis.set(key, JSON.stringify(payload));

            // Keep enabled order in sync with desired status
            if (enabled) {
                await this.addToEnabledOrder(configId);
            } else {
                await this.redis.zrem(CONFIG_ENABLED_ZSET, configId);
            }

            return configId;
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    /**
     * Save multiple configurations at once
     */
    async saveConfigs(
        configs: Omit<GenerateStickerOptions, 'text'>[],
        enabled: boolean = true
    ): Promise<string[]> {
        const configIds: string[] = [];

        for (const config of configs) {
            const configId = await this.saveConfig(config, enabled);
            configIds.push(configId);
        }

        return configIds;
    }

    /**
     * Get a specific configuration by ID
     */
    async getConfigRecord(configId: string): Promise<StickerConfigRecord | null> {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            const configJson = await this.redis.get(key);

            return this.parseStoredConfig(configJson);
        } catch (error) {
            console.error('Error getting config:', error);
            return null;
        }
    }

    async getConfig(configId: string): Promise<Omit<GenerateStickerOptions, 'text'> | null> {
        try {
            const record = await this.getConfigRecord(configId);
            if (!record) {
                return null;
            }

            return record.config;
        } catch (error) {
            console.error('Error getting config:', error);
            return null;
        }
    }

    /**
     * Get all enabled configurations
     */
    async getEnabledConfigs(): Promise<Array<{
        id: string;
        config: Omit<GenerateStickerOptions, 'text'>;
        meta?: StickerConfigMeta;
    }>> {
        try {
            const orderedIds = await this.getOrderedEnabledIds();
            const results: Array<{
                id: string;
                config: Omit<GenerateStickerOptions, 'text'>;
                meta?: StickerConfigMeta;
            }> = [];

            for (const configId of orderedIds) {
                const record = await this.getConfigRecord(configId);
                if (record) {
                    results.push({ id: configId, config: record.config, meta: record.meta });
                }
            }

            return results;
        } catch (error) {
            console.error('Error getting enabled configs:', error);
            return [];
        }
    }

    /**
     * Get all configurations (enabled and disabled)
     */
    async getAllConfigs(): Promise<Array<{
        id: string;
        config: Omit<GenerateStickerOptions, 'text'>;
        enabled: boolean;
        meta?: StickerConfigMeta;
    }>> {
        try {
            const pattern = `${CONFIG_PREFIX}*`;
            const keys = (await this.redis.keys(pattern)).filter(
                (key) =>
                    key !== CONFIG_ENABLED_ZSET &&
                    key !== UPLOAD_CHAT_IDS_KEY &&
                    key !== DEBOUNCE_DELAY_KEY,
            );
            const orderedEnabledIds = await this.getOrderedEnabledIds();
            const enabledIdSet = new Set(orderedEnabledIds);

            const results: Array<{
                id: string;
                config: Omit<GenerateStickerOptions, 'text'>;
                enabled: boolean;
                meta?: StickerConfigMeta;
            }> = [];

            const allConfigIds = keys.map((key) => key.replace(CONFIG_PREFIX, ''));

            const orderedDisabledIds = allConfigIds.filter((id) => !enabledIdSet.has(id));

            const finalOrder: string[] = [];
            const allIdsSet = new Set(allConfigIds);
            for (const id of orderedEnabledIds) {
                if (allIdsSet.has(id)) {
                    finalOrder.push(id);
                }
            }
            for (const id of orderedDisabledIds) {
                finalOrder.push(id);
            }

            for (const configId of finalOrder) {
                const key = `${CONFIG_PREFIX}${configId}`;
                const configJson = await this.redis.get(key);

                if (configJson) {
                    const record = this.parseStoredConfig(configJson);
                    if (!record) {
                        continue;
                    }
                    results.push({
                        id: configId,
                        config: record.config,
                        enabled: enabledIdSet.has(configId),
                        meta: record.meta,
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error getting all configs:', error);
            return [];
        }
    }

    /**
     * Enable a sticker configuration
     */
    async enableConfig(configId: string): Promise<boolean> {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            const exists = await this.redis.exists(key);

            if (!exists) {
                return false;
            }

            await this.addToEnabledOrder(configId);
            return true;
        } catch (error) {
            console.error('Error enabling config:', error);
            return false;
        }
    }

    /**
     * Disable a sticker configuration
     */
    async disableConfig(configId: string): Promise<boolean> {
        try {
            await this.redis.zrem(CONFIG_ENABLED_ZSET, configId);
            return true;
        } catch (error) {
            console.error('Error disabling config:', error);
            return false;
        }
    }

    /**
     * Check if a configuration is enabled
     */
    async isEnabled(configId: string): Promise<boolean> {
        try {
            const score = await this.redis.zscore(CONFIG_ENABLED_ZSET, configId);
            return score !== null;
        } catch (error) {
            console.error('Error checking if config is enabled:', error);
            return false;
        }
    }

    /**
     * Delete a configuration
     */
    async deleteConfig(configId: string): Promise<boolean> {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            await this.redis.del(key);
            await this.redis.zrem(CONFIG_ENABLED_ZSET, configId);
            return true;
        } catch (error) {
            console.error('Error deleting config:', error);
            return false;
        }
    }

    /**
     * Persist manual order of enabled configurations.
     * Only enabled IDs are stored; others are ignored.
     */
    async setEnabledConfigOrder(order: string[]): Promise<void> {
        try {
            const currentOrder = await this.getOrderedEnabledIds();
            if (!currentOrder.length) {
                return;
            }

            const enabledSet = new Set(currentOrder);
            const seen = new Set<string>();
            const reordered: string[] = [];

            for (const rawId of order) {
                if (typeof rawId !== 'string') {
                    continue;
                }
                if (!enabledSet.has(rawId) || seen.has(rawId)) {
                    continue;
                }
                reordered.push(rawId);
                seen.add(rawId);
            }

            currentOrder.forEach((id) => {
                if (!seen.has(id)) {
                    reordered.push(id);
                }
            });

            const pipeline = this.redis.multi();
            reordered.forEach((id, idx) => {
                pipeline.zadd(CONFIG_ENABLED_ZSET, idx + 1, id);
            });
            await pipeline.exec();
        } catch (error) {
            console.error('Error setting enabled config order:', error);
            throw error;
        }
    }

    /**
     * Update manual enabled order when configuration ID changes after editing.
     * Keeps the new ID at the same position as the old one (if any).
     */
    async updateEnabledOrderOnIdChange(
        oldId: string,
        newId: string,
        enabled: boolean,
    ): Promise<void> {
        try {
            const rawScore = await this.redis.zscore(CONFIG_ENABLED_ZSET, oldId);
            await this.redis.zrem(CONFIG_ENABLED_ZSET, oldId);

            if (!enabled) {
                await this.redis.zrem(CONFIG_ENABLED_ZSET, newId);
                return;
            }

            let targetScore: number;
            const parsedScore = rawScore !== null ? Number(rawScore) : NaN;
            if (Number.isFinite(parsedScore)) {
                targetScore = parsedScore;
            } else {
                targetScore = await this.getNextEnabledOrderScore();
            }

            await this.redis.zadd(CONFIG_ENABLED_ZSET, targetScore, newId);
        } catch (error) {
            console.error('Error updating enabled order on id change:', error);
        }
    }

    /**
     * Get count of enabled configurations
     */
    async getEnabledCount(): Promise<number> {
        try {
            return await this.redis.zcard(CONFIG_ENABLED_ZSET);
        } catch (error) {
            console.error('Error getting enabled count:', error);
            return 0;
        }
    }

    /**
     * Save upload chat IDs to Redis
     */
    async saveUploadChatIds(chatIds: string[]): Promise<void> {
        try {
            await this.redis.set(UPLOAD_CHAT_IDS_KEY, JSON.stringify(chatIds));
            // Invalidate local cache
            this.uploadChatIdsCache = null;
            this.uploadChatIdsCacheTime = 0;
        } catch (error) {
            console.error('Error saving upload chat IDs:', error);
            throw error;
        }
    }

    /**
     * Get upload chat IDs with local caching (5 minutes TTL)
     */
    async getUploadChatIds(): Promise<string[]> {
        try {
            // Check if cache is valid
            const now = Date.now();
            if (this.uploadChatIdsCache && (now - this.uploadChatIdsCacheTime < CACHE_TTL_MS)) {
                return this.uploadChatIdsCache;
            }

            // Fetch from Redis
            const chatIdsJson = await this.redis.get(UPLOAD_CHAT_IDS_KEY);

            if (!chatIdsJson) {
                // Return empty array if not configured
                this.uploadChatIdsCache = [];
                this.uploadChatIdsCacheTime = now;
                return [];
            }

            const chatIds = JSON.parse(chatIdsJson);

            // Update cache
            this.uploadChatIdsCache = chatIds;
            this.uploadChatIdsCacheTime = now;

            return chatIds;
        } catch (error) {
            console.error('Error getting upload chat IDs:', error);
            // Return cached value if available, otherwise empty array
            return this.uploadChatIdsCache || [];
        }
    }

    /**
     * Add an upload chat ID
     */
    async addUploadChatId(chatId: string): Promise<void> {
        try {
            const chatIds = await this.getUploadChatIds();
            if (!chatIds.includes(chatId)) {
                chatIds.push(chatId);
                await this.saveUploadChatIds(chatIds);
            }
        } catch (error) {
            console.error('Error adding upload chat ID:', error);
            throw error;
        }
    }

    /**
     * Remove an upload chat ID
     */
    async removeUploadChatId(chatId: string): Promise<void> {
        try {
            const chatIds = await this.getUploadChatIds();
            const filtered = chatIds.filter(id => id !== chatId);
            await this.saveUploadChatIds(filtered);
        } catch (error) {
            console.error('Error removing upload chat ID:', error);
            throw error;
        }
    }

    /**
     * Clear local cache for upload chat IDs
     */
    clearUploadChatIdsCache(): void {
        this.uploadChatIdsCache = null;
        this.uploadChatIdsCacheTime = 0;
    }

    /**
     * Save debounce delay to Redis (in milliseconds)
     */
    async setDebounceDelay(delayMs: number): Promise<void> {
        try {
            await this.redis.set(DEBOUNCE_DELAY_KEY, delayMs.toString());
            // Invalidate local cache
            this.debounceDelayCache = null;
            this.debounceDelayCacheTime = 0;
        } catch (error) {
            console.error('Error saving debounce delay:', error);
            throw error;
        }
    }

    /**
     * Get debounce delay with local caching (5 minutes TTL)
     * Returns delay in milliseconds
     */
    async getDebounceDelay(): Promise<number> {
        try {
            // Check if cache is valid
            const now = Date.now();
            if (this.debounceDelayCache !== null && (now - this.debounceDelayCacheTime < CACHE_TTL_MS)) {
                return this.debounceDelayCache;
            }

            // Fetch from Redis
            const delayStr = await this.redis.get(DEBOUNCE_DELAY_KEY);

            let delay: number;
            if (!delayStr) {
                // Use default if not configured
                delay = DEFAULT_DEBOUNCE_DELAY;
            } else {
                delay = parseInt(delayStr, 10);
                if (isNaN(delay) || delay < 0) {
                    delay = DEFAULT_DEBOUNCE_DELAY;
                }
            }

            // Update cache
            this.debounceDelayCache = delay;
            this.debounceDelayCacheTime = now;

            return delay;
        } catch (error) {
            console.error('Error getting debounce delay:', error);
            // Return cached value if available, otherwise default
            return this.debounceDelayCache ?? DEFAULT_DEBOUNCE_DELAY;
        }
    }

    /**
     * Clear local cache for debounce delay
     */
    clearDebounceDelayCache(): void {
        this.debounceDelayCache = null;
        this.debounceDelayCacheTime = 0;
    }

    /**
     * Get limit for recent stickers per user
     */
    async getUserRecentStickersLimit(): Promise<number> {
        try {
            const now = Date.now();
            if (this.recentLimitCache !== null && (now - this.recentLimitCacheTime < CACHE_TTL_MS)) {
                return this.recentLimitCache;
            }

            const value = await this.redis.get(USER_RECENT_STICKERS_LIMIT_KEY);
            const parsed = value ? parseInt(value, 10) : DEFAULT_USER_RECENT_STICKERS_LIMIT;
            const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_RECENT_STICKERS_LIMIT;

            this.recentLimitCache = limit;
            this.recentLimitCacheTime = now;
            return limit;
        } catch (error) {
            console.error('Error getting user recent stickers limit:', error);
            return this.recentLimitCache ?? DEFAULT_USER_RECENT_STICKERS_LIMIT;
        }
    }

    /**
     * Set limit for recent stickers per user
     */
    async setUserRecentStickersLimit(limit: number): Promise<void> {
        if (!Number.isFinite(limit) || limit <= 0) {
            throw new Error('Invalid recent stickers limit');
        }
        await this.redis.set(USER_RECENT_STICKERS_LIMIT_KEY, limit.toString());
        this.recentLimitCache = limit;
        this.recentLimitCacheTime = Date.now();
    }

    /**
     * Get maximum length for inline query text
     */
    async getInlineQueryMaxLength(): Promise<number> {
        try {
            const now = Date.now();
            if (
                this.inlineQueryMaxLengthCache !== null &&
                now - this.inlineQueryMaxLengthCacheTime < CACHE_TTL_MS
            ) {
                return this.inlineQueryMaxLengthCache;
            }

            const value = await this.redis.get(INLINE_QUERY_MAX_LENGTH_KEY);
            const parsed = value ? parseInt(value, 10) : DEFAULT_INLINE_QUERY_MAX_LENGTH;
            const limit =
                Number.isFinite(parsed) && parsed > 0
                    ? parsed
                    : DEFAULT_INLINE_QUERY_MAX_LENGTH;

            this.inlineQueryMaxLengthCache = limit;
            this.inlineQueryMaxLengthCacheTime = now;
            return limit;
        } catch (error) {
            console.error('Error getting inline query max length:', error);
            return this.inlineQueryMaxLengthCache ?? DEFAULT_INLINE_QUERY_MAX_LENGTH;
        }
    }

    /**
     * Set maximum length for inline query text
     */
    async setInlineQueryMaxLength(limit: number): Promise<void> {
        if (!Number.isFinite(limit) || limit <= 0) {
            throw new Error('Invalid inline query max length');
        }
        await this.redis.set(INLINE_QUERY_MAX_LENGTH_KEY, limit.toString());
        this.inlineQueryMaxLengthCache = limit;
        this.inlineQueryMaxLengthCacheTime = Date.now();
    }

    /**
     * Get flag: enable inline history for empty queries
     */
    async getInlineHistoryEnabled(): Promise<boolean> {
        return this.getBooleanFlag(
            INLINE_HISTORY_ENABLED_KEY,
            DEFAULT_INLINE_HISTORY_ENABLED,
            this.inlineHistoryEnabledCache,
            this.inlineHistoryEnabledCacheTime,
            (value, time) => {
                this.inlineHistoryEnabledCache = value;
                this.inlineHistoryEnabledCacheTime = time;
            },
        );
    }

    /**
     * Set flag: enable inline history for empty queries
     */
    async setInlineHistoryEnabled(enabled: boolean): Promise<void> {
        await this.setBooleanFlag(INLINE_HISTORY_ENABLED_KEY, enabled);
        this.inlineHistoryEnabledCache = enabled;
        this.inlineHistoryEnabledCacheTime = Date.now();
    }

    /**
     * Get flag: enable global config scoring
     */
    async getInlineGlobalConfigScoringEnabled(): Promise<boolean> {
        return this.getBooleanFlag(
            INLINE_GLOBAL_CONFIG_SCORING_ENABLED_KEY,
            DEFAULT_INLINE_GLOBAL_CONFIG_SCORING_ENABLED,
            this.inlineGlobalConfigScoringEnabledCache,
            this.inlineGlobalConfigScoringEnabledCacheTime,
            (value, time) => {
                this.inlineGlobalConfigScoringEnabledCache = value;
                this.inlineGlobalConfigScoringEnabledCacheTime = time;
            },
        );
    }

    /**
     * Set flag: enable global config scoring
     */
    async setInlineGlobalConfigScoringEnabled(enabled: boolean): Promise<void> {
        await this.setBooleanFlag(INLINE_GLOBAL_CONFIG_SCORING_ENABLED_KEY, enabled);
        this.inlineGlobalConfigScoringEnabledCache = enabled;
        this.inlineGlobalConfigScoringEnabledCacheTime = Date.now();
    }
}
