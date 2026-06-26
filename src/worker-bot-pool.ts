import { Telegraf } from 'telegraf';
import { SerialUploadQueue } from './serial-upload-queue';
import { logger } from './logger';

type StickerUploadAttemptResult = {
    fileId: string | null;
    retryable: boolean;
    rateLimited?: boolean;
};

type WorkerEntry = {
    tokenId: string;
    bot: Telegraf;
    queue: SerialUploadQueue;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
}

function getRetryAfterSeconds(error: unknown): number | null {
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

    return typeof parameters?.retry_after === 'number' ? parameters.retry_after : 300;
}

export class WorkerBotPool {
    private workers: WorkerEntry[] = [];
    private nextIndex = 0;

    constructor(
        private readonly channelId: number,
        private readonly queueOpts: {
            maxQueueSize: number;
            minIntervalMs: number;
        },
    ) {}

    reload(tokens: Array<{ id: string; token: string }>): void {
        const incomingIds = new Set(tokens.map((t) => t.id));

        // Remove workers whose tokens are no longer active
        this.workers = this.workers.filter((w) => incomingIds.has(w.tokenId));

        const existingIds = new Set(this.workers.map((w) => w.tokenId));

        // Add new workers
        for (const { id, token } of tokens) {
            if (!existingIds.has(id)) {
                this.workers.push({
                    tokenId: id,
                    bot: new Telegraf(token),
                    queue: new SerialUploadQueue(this.queueOpts),
                });
            }
        }

        this.nextIndex = 0;
        logger.info(`WorkerBotPool reloaded: ${this.workers.length} active worker(s)`);
    }

    isAvailable(): boolean {
        return this.workers.some((w) => !w.queue.isFloodLimited());
    }

    workerCount(): number {
        return this.workers.length;
    }

    private pickWorker(): WorkerEntry | null {
        const count = this.workers.length;
        if (count === 0) return null;

        for (let i = 0; i < count; i++) {
            const index = (this.nextIndex + i) % count;
            const worker = this.workers[index];
            if (!worker.queue.isFloodLimited()) {
                this.nextIndex = (index + 1) % count;
                return worker;
            }
        }

        return null;
    }

    async sendStickerViaChannel(buffer: Buffer): Promise<StickerUploadAttemptResult> {
        const worker = this.pickWorker();
        if (!worker) {
            return { fileId: null, retryable: false };
        }

        try {
            const fileId = await worker.queue.enqueue(async () => {
                const message = await worker.bot.telegram.sendSticker(
                    this.channelId,
                    { source: buffer },
                );
                return message.sticker?.file_id ?? null;
            });

            if (fileId) {
                return { fileId, retryable: false };
            }

            logger.warn(`WorkerBotPool: sendSticker succeeded but returned no file_id`);
            return { fileId: null, retryable: true };
        } catch (error) {
            const retryAfter = getRetryAfterSeconds(error);
            if (retryAfter !== null) {
                worker.queue.setBotFloodWait(retryAfter);
                logger.warn(
                    `WorkerBotPool: worker ${worker.tokenId.slice(0, 8)} flood-waited for ${retryAfter}s`,
                );
                return { fileId: null, retryable: false, rateLimited: true };
            }

            logger.error(
                `WorkerBotPool: sendSticker failed for worker ${worker.tokenId.slice(0, 8)}`,
                error,
            );
            return { fileId: null, retryable: true };
        }
    }
}
