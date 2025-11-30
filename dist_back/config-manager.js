"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StickerConfigManager = void 0;
const crypto = __importStar(require("crypto"));
const CONFIG_PREFIX = 'config:';
const CONFIG_ENABLED_SET = 'config:enabled';
const UPLOAD_CHAT_IDS_KEY = 'config:upload_chat_ids';
const DEBOUNCE_DELAY_KEY = 'config:debounce_delay';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DEBOUNCE_DELAY = 2000; // 2 seconds default
/**
 * Sticker configuration manager
 */
class StickerConfigManager {
    redis;
    uploadChatIdsCache = null;
    uploadChatIdsCacheTime = 0;
    debounceDelayCache = null;
    debounceDelayCacheTime = 0;
    constructor(redis) {
        this.redis = redis;
    }
    sanitizeConfig(config) {
        const { width: _ignoredWidth, height: _ignoredHeight, fontSize: _ignoredFontSize, ...rest } = config;
        return rest;
    }
    /**
     * Generate unique ID for a sticker configuration
     */
    generateConfigId(config) {
        const configString = JSON.stringify(config);
        return crypto.createHash('sha256').update(configString).digest('hex');
    }
    /**
     * Save a sticker configuration to Redis
     */
    async saveConfig(config, enabled = true) {
        try {
            const sanitizedConfig = this.sanitizeConfig(config);
            const configId = this.generateConfigId(sanitizedConfig);
            const key = `${CONFIG_PREFIX}${configId}`;
            // Save config as JSON
            await this.redis.set(key, JSON.stringify(sanitizedConfig));
            // Add to enabled set if enabled
            if (enabled) {
                await this.redis.sadd(CONFIG_ENABLED_SET, configId);
            }
            return configId;
        }
        catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }
    /**
     * Save multiple configurations at once
     */
    async saveConfigs(configs, enabled = true) {
        const configIds = [];
        for (const config of configs) {
            const configId = await this.saveConfig(config, enabled);
            configIds.push(configId);
        }
        return configIds;
    }
    /**
     * Get a specific configuration by ID
     */
    async getConfig(configId) {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            const configJson = await this.redis.get(key);
            if (!configJson) {
                return null;
            }
            const parsed = JSON.parse(configJson);
            return this.sanitizeConfig(parsed);
        }
        catch (error) {
            console.error('Error getting config:', error);
            return null;
        }
    }
    /**
     * Get all enabled configurations
     */
    async getEnabledConfigs() {
        try {
            const enabledIds = await this.redis.smembers(CONFIG_ENABLED_SET);
            const results = [];
            for (const configId of enabledIds) {
                const config = await this.getConfig(configId);
                if (config) {
                    results.push({ id: configId, config });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error getting enabled configs:', error);
            return [];
        }
    }
    /**
     * Get all configurations (enabled and disabled)
     */
    async getAllConfigs() {
        try {
            const pattern = `${CONFIG_PREFIX}*`;
            const keys = (await this.redis.keys(pattern)).filter((key) => key !== CONFIG_ENABLED_SET &&
                key !== UPLOAD_CHAT_IDS_KEY &&
                key !== DEBOUNCE_DELAY_KEY);
            const enabledIds = new Set(await this.redis.smembers(CONFIG_ENABLED_SET));
            const results = [];
            for (const key of keys) {
                const configId = key.replace(CONFIG_PREFIX, '');
                const configJson = await this.redis.get(key);
                if (configJson) {
                    const config = this.sanitizeConfig(JSON.parse(configJson));
                    results.push({
                        id: configId,
                        config,
                        enabled: enabledIds.has(configId),
                    });
                }
            }
            return results;
        }
        catch (error) {
            console.error('Error getting all configs:', error);
            return [];
        }
    }
    /**
     * Enable a sticker configuration
     */
    async enableConfig(configId) {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            const exists = await this.redis.exists(key);
            if (!exists) {
                return false;
            }
            await this.redis.sadd(CONFIG_ENABLED_SET, configId);
            return true;
        }
        catch (error) {
            console.error('Error enabling config:', error);
            return false;
        }
    }
    /**
     * Disable a sticker configuration
     */
    async disableConfig(configId) {
        try {
            await this.redis.srem(CONFIG_ENABLED_SET, configId);
            return true;
        }
        catch (error) {
            console.error('Error disabling config:', error);
            return false;
        }
    }
    /**
     * Check if a configuration is enabled
     */
    async isEnabled(configId) {
        try {
            const result = await this.redis.sismember(CONFIG_ENABLED_SET, configId);
            return result === 1;
        }
        catch (error) {
            console.error('Error checking if config is enabled:', error);
            return false;
        }
    }
    /**
     * Delete a configuration
     */
    async deleteConfig(configId) {
        try {
            const key = `${CONFIG_PREFIX}${configId}`;
            await this.redis.del(key);
            await this.redis.srem(CONFIG_ENABLED_SET, configId);
            return true;
        }
        catch (error) {
            console.error('Error deleting config:', error);
            return false;
        }
    }
    /**
     * Get count of enabled configurations
     */
    async getEnabledCount() {
        try {
            return await this.redis.scard(CONFIG_ENABLED_SET);
        }
        catch (error) {
            console.error('Error getting enabled count:', error);
            return 0;
        }
    }
    /**
     * Save upload chat IDs to Redis
     */
    async saveUploadChatIds(chatIds) {
        try {
            await this.redis.set(UPLOAD_CHAT_IDS_KEY, JSON.stringify(chatIds));
            // Invalidate local cache
            this.uploadChatIdsCache = null;
            this.uploadChatIdsCacheTime = 0;
        }
        catch (error) {
            console.error('Error saving upload chat IDs:', error);
            throw error;
        }
    }
    /**
     * Get upload chat IDs with local caching (5 minutes TTL)
     */
    async getUploadChatIds() {
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
        }
        catch (error) {
            console.error('Error getting upload chat IDs:', error);
            // Return cached value if available, otherwise empty array
            return this.uploadChatIdsCache || [];
        }
    }
    /**
     * Add an upload chat ID
     */
    async addUploadChatId(chatId) {
        try {
            const chatIds = await this.getUploadChatIds();
            if (!chatIds.includes(chatId)) {
                chatIds.push(chatId);
                await this.saveUploadChatIds(chatIds);
            }
        }
        catch (error) {
            console.error('Error adding upload chat ID:', error);
            throw error;
        }
    }
    /**
     * Remove an upload chat ID
     */
    async removeUploadChatId(chatId) {
        try {
            const chatIds = await this.getUploadChatIds();
            const filtered = chatIds.filter(id => id !== chatId);
            await this.saveUploadChatIds(filtered);
        }
        catch (error) {
            console.error('Error removing upload chat ID:', error);
            throw error;
        }
    }
    /**
     * Clear local cache for upload chat IDs
     */
    clearUploadChatIdsCache() {
        this.uploadChatIdsCache = null;
        this.uploadChatIdsCacheTime = 0;
    }
    /**
     * Save debounce delay to Redis (in milliseconds)
     */
    async setDebounceDelay(delayMs) {
        try {
            await this.redis.set(DEBOUNCE_DELAY_KEY, delayMs.toString());
            // Invalidate local cache
            this.debounceDelayCache = null;
            this.debounceDelayCacheTime = 0;
        }
        catch (error) {
            console.error('Error saving debounce delay:', error);
            throw error;
        }
    }
    /**
     * Get debounce delay with local caching (5 minutes TTL)
     * Returns delay in milliseconds
     */
    async getDebounceDelay() {
        try {
            // Check if cache is valid
            const now = Date.now();
            if (this.debounceDelayCache !== null && (now - this.debounceDelayCacheTime < CACHE_TTL_MS)) {
                return this.debounceDelayCache;
            }
            // Fetch from Redis
            const delayStr = await this.redis.get(DEBOUNCE_DELAY_KEY);
            let delay;
            if (!delayStr) {
                // Use default if not configured
                delay = DEFAULT_DEBOUNCE_DELAY;
            }
            else {
                delay = parseInt(delayStr, 10);
                if (isNaN(delay) || delay < 0) {
                    delay = DEFAULT_DEBOUNCE_DELAY;
                }
            }
            // Update cache
            this.debounceDelayCache = delay;
            this.debounceDelayCacheTime = now;
            return delay;
        }
        catch (error) {
            console.error('Error getting debounce delay:', error);
            // Return cached value if available, otherwise default
            return this.debounceDelayCache ?? DEFAULT_DEBOUNCE_DELAY;
        }
    }
    /**
     * Clear local cache for debounce delay
     */
    clearDebounceDelayCache() {
        this.debounceDelayCache = null;
        this.debounceDelayCacheTime = 0;
    }
}
exports.StickerConfigManager = StickerConfigManager;
//# sourceMappingURL=config-manager.js.map