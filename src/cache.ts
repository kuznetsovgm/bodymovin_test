import Redis from 'ioredis';
import * as crypto from 'crypto';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_PREFIX = 'sticker:';

class StickerCache {
    private redis: Redis;

    constructor() {
        this.redis = new Redis(REDIS_URL, {
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
    private generateTextHash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Generate SHA256 hash from sticker configuration
     */
    private generateConfigHash(config: any): string {
        const configString = JSON.stringify(config);
        return crypto.createHash('sha256').update(configString).digest('hex');
    }

    /**
     * Generate cache key from text hash and config hash
     */
    private getCacheKey(text: string, config: any): string {
        const textHash = this.generateTextHash(text);
        const configHash = this.generateConfigHash(config);
        return `${CACHE_PREFIX}${textHash}:${configHash}`;
    }

    /**
     * Get cached file_id for text and config
     */
    async get(text: string, config: any): Promise<string | null> {
        try {
            const key = this.getCacheKey(text, config);
            return await this.redis.get(key);
        } catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }

    /**
     * Get multiple cached file_ids for text and configs in one batch request
     * Returns array of file_ids (null if not cached) in the same order as configs
     */
    async getBatch(text: string, configs: any[]): Promise<(string | null)[]> {
        try {
            if (configs.length === 0) {
                return [];
            }

            const keys = configs.map(config => this.getCacheKey(text, config));
            const values = await this.redis.mget(...keys);

            return values.map(value => value || null);
        } catch (error) {
            console.error('Redis getBatch error:', error);
            return configs.map(() => null);
        }
    }

    /**
     * Set file_id for text and config (without TTL)
     */
    async set(text: string, config: any, fileId: string): Promise<void> {
        try {
            const key = this.getCacheKey(text, config);
            await this.redis.set(key, fileId);
        } catch (error) {
            console.error('Redis set error:', error);
        }
    }

    /**
     * Get all cached file_ids for a text (returns map of config -> fileId)
     */
    async getAll(text: string): Promise<Map<string, string>> {
        const result = new Map<string, string>();
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
        } catch (error) {
            console.error('Redis getAll error:', error);
        }
        return result;
    }

    /**
     * Check if connection is alive
     */
    async ping(): Promise<boolean> {
        try {
            const result = await this.redis.ping();
            return result === 'PONG';
        } catch (error) {
            return false;
        }
    }

    /**
     * Close Redis connection
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }

    /**
     * Get Redis client
     */
    getRedis(): Redis {
        return this.redis;
    }
}

export const stickerCache = new StickerCache();
