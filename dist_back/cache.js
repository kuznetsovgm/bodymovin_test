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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stickerCache = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const crypto = __importStar(require("crypto"));
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_PREFIX = 'sticker:';
class StickerCache {
    redis;
    constructor() {
        this.redis = new ioredis_1.default(REDIS_URL, {
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });
        this.redis.on('error', (err) => {
            console.error('Redis error:', err);
        });
        this.redis.on('connect', () => {
            console.log('✓ Connected to Redis');
        });
    }
    /**
     * Generate SHA256 hash from text
     */
    generateTextHash(text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }
    /**
     * Generate SHA256 hash from sticker configuration
     */
    generateConfigHash(config) {
        const configString = JSON.stringify(config);
        return crypto.createHash('sha256').update(configString).digest('hex');
    }
    /**
     * Generate cache key from text hash and config hash
     */
    getCacheKey(text, config) {
        const textHash = this.generateTextHash(text);
        const configHash = this.generateConfigHash(config);
        return `${CACHE_PREFIX}${textHash}:${configHash}`;
    }
    /**
     * Get cached file_id for text and config
     */
    async get(text, config) {
        try {
            const key = this.getCacheKey(text, config);
            return await this.redis.get(key);
        }
        catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }
    /**
     * Get multiple cached file_ids for text and configs in one batch request
     * Returns array of file_ids (null if not cached) in the same order as configs
     */
    async getBatch(text, configs) {
        try {
            if (configs.length === 0) {
                return [];
            }
            const keys = configs.map(config => this.getCacheKey(text, config));
            const values = await this.redis.mget(...keys);
            return values.map(value => value || null);
        }
        catch (error) {
            console.error('Redis getBatch error:', error);
            return configs.map(() => null);
        }
    }
    /**
     * Set file_id for text and config (without TTL)
     */
    async set(text, config, fileId) {
        try {
            const key = this.getCacheKey(text, config);
            await this.redis.set(key, fileId);
        }
        catch (error) {
            console.error('Redis set error:', error);
        }
    }
    /**
     * Get all cached file_ids for a text (returns map of config -> fileId)
     */
    async getAll(text) {
        const result = new Map();
        try {
            const textHash = this.generateTextHash(text);
            const pattern = `${CACHE_PREFIX}${textHash}:*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length === 0) {
                return result;
            }
            const values = await this.redis.mget(...keys);
            keys.forEach((key, index) => {
                const configHash = key.split(':').pop() || '';
                const fileId = values[index];
                if (configHash && fileId) {
                    result.set(configHash, fileId);
                }
            });
        }
        catch (error) {
            console.error('Redis getAll error:', error);
        }
        return result;
    }
    /**
     * Check if connection is alive
     */
    async ping() {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.redis.quit();
    }
    /**
     * Get Redis client
     */
    getRedis() {
        return this.redis;
    }
}
exports.stickerCache = new StickerCache();
//# sourceMappingURL=cache.js.map