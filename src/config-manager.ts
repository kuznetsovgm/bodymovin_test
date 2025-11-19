import Redis from 'ioredis';
import * as crypto from 'crypto';
import { GenerateStickerOptions } from './index';

const CONFIG_PREFIX = 'config:';
const CONFIG_ENABLED_SET = 'config:enabled';
const UPLOAD_CHAT_IDS_KEY = 'config:upload_chat_ids';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Sticker configuration manager
 */
export class StickerConfigManager {
    private redis: Redis;
    private uploadChatIdsCache: string[] | null = null;
    private uploadChatIdsCacheTime: number = 0;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    /**
     * Generate unique ID for a sticker configuration
     */
    private generateConfigId(config: Omit<GenerateStickerOptions, 'text'>): string {
        const configString = JSON.stringify(config);
        return crypto.createHash('sha256').update(configString).digest('hex').substring(0, 16);
    }

    /**
     * Save a sticker configuration to Redis
     */
    async saveConfig(
        config: Omit<GenerateStickerOptions, 'text'>,
        enabled: boolean = true
    ): Promise<string> {
        try {
            const configId = this.generateConfigId(config);
            const key = `${CONFIG_PREFIX}${configId}`;

            // Save config as JSON
            await this.redis.set(key, JSON.stringify(config));

            // Add to enabled set if enabled
            if (enabled) {
                await this.redis.sadd(CONFIG_ENABLED_SET, configId);
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
    async getConfig(configId: string): Promise<Omit<GenerateStickerOptions, 'text'> | null> {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            const configJson = await this.redis.get(key);

            if (!configJson) {
                return null;
            }

            return JSON.parse(configJson);
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
    }>> {
        try {
            const enabledIds = await this.redis.smembers(CONFIG_ENABLED_SET);
            const results: Array<{
                id: string;
                config: Omit<GenerateStickerOptions, 'text'>;
            }> = [];

            for (const configId of enabledIds) {
                const config = await this.getConfig(configId);
                if (config) {
                    results.push({ id: configId, config });
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
    }>> {
        try {
            const pattern = `${CONFIG_PREFIX}*`;
            const keys = await this.redis.keys(pattern);
            const enabledIds = new Set(await this.redis.smembers(CONFIG_ENABLED_SET));

            const results: Array<{
                id: string;
                config: Omit<GenerateStickerOptions, 'text'>;
                enabled: boolean;
            }> = [];

            for (const key of keys) {
                const configId = key.replace(CONFIG_PREFIX, '');
                const configJson = await this.redis.get(key);

                if (configJson) {
                    const config = JSON.parse(configJson);
                    results.push({
                        id: configId,
                        config,
                        enabled: enabledIds.has(configId),
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

            await this.redis.sadd(CONFIG_ENABLED_SET, configId);
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
            await this.redis.srem(CONFIG_ENABLED_SET, configId);
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
            const result = await this.redis.sismember(CONFIG_ENABLED_SET, configId);
            return result === 1;
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
            await this.redis.srem(CONFIG_ENABLED_SET, configId);
            return true;
        } catch (error) {
            console.error('Error deleting config:', error);
            return false;
        }
    }

    /**
     * Get count of enabled configurations
     */
    async getEnabledCount(): Promise<number> {
        try {
            return await this.redis.scard(CONFIG_ENABLED_SET);
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
}
