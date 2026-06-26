type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class BotFloodWaitError extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    readonly retryUntil: number,
  ) {
    super(`Telegram bot flood wait for ${retryAfterSeconds}s`);
    this.name = 'BotFloodWaitError';
  }
}

export class SerialUploadQueue {
  private readonly queue: QueueItem<unknown>[] = [];
  private running = false;
  private lastStartAt = 0;
  private floodUntil = 0;

  constructor(
    private readonly options: {
      maxQueueSize: number;
      minIntervalMs: number;
    },
  ) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const floodError = this.getFloodWaitError();
    if (floodError) {
      return Promise.reject(floodError);
    }

    if (this.queue.length >= this.options.maxQueueSize) {
      return Promise.reject(
        new Error(`Upload queue is full (max: ${this.options.maxQueueSize})`),
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      void this.processQueue();
    });
  }

  setBotFloodWait(retryAfterSeconds: number): void {
    const retryUntil = Date.now() + retryAfterSeconds * 1000;
    this.floodUntil = Math.max(this.floodUntil, retryUntil);

    const error = new BotFloodWaitError(retryAfterSeconds, this.floodUntil);
    const pendingItems = this.queue.splice(0);
    for (const item of pendingItems) {
      item.reject(error);
    }
  }

  isFloodLimited(): boolean {
    return this.getFloodWaitError() !== null;
  }

  private async processQueue(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      while (this.queue.length > 0) {
        const floodError = this.getFloodWaitError();
        if (floodError) {
          this.rejectPending(floodError);
          return;
        }

        const item = this.queue.shift();
        if (!item) {
          return;
        }

        const waitMs = Math.max(
          0,
          this.lastStartAt + this.options.minIntervalMs - Date.now(),
        );
        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        const delayedFloodError = this.getFloodWaitError();
        if (delayedFloodError) {
          item.reject(delayedFloodError);
          this.rejectPending(delayedFloodError);
          return;
        }

        this.lastStartAt = Date.now();

        try {
          item.resolve(await item.task());
        } catch (error) {
          item.reject(error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private rejectPending(error: unknown): void {
    const pendingItems = this.queue.splice(0);
    for (const item of pendingItems) {
      item.reject(error);
    }
  }

  private getFloodWaitError(): BotFloodWaitError | null {
    const now = Date.now();
    if (now >= this.floodUntil) {
      return null;
    }

    return new BotFloodWaitError(
      Math.ceil((this.floodUntil - now) / 1000),
      this.floodUntil,
    );
  }
}
