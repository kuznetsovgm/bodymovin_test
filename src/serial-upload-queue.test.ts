import assert from 'node:assert';
import { BotFloodWaitError, SerialUploadQueue } from './serial-upload-queue';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rejectsWithFloodWait(promise: Promise<unknown>): Promise<BotFloodWaitError> {
  try {
    await promise;
  } catch (error) {
    assert.equal(error instanceof BotFloodWaitError, true);
    return error as BotFloodWaitError;
  }

  throw new Error('Expected promise to reject with BotFloodWaitError');
}

// Upload calls must never overlap, even if callers enqueue them concurrently.
(async () => {
  const queue = new SerialUploadQueue({ maxQueueSize: 10, minIntervalMs: 0 });
  const order: number[] = [];
  let active = 0;
  let maxActive = 0;

  await Promise.all(
    [1, 2, 3].map((value) =>
      queue.enqueue(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        order.push(value);
        active--;
        return value;
      }),
    ),
  );

  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(maxActive, 1);
})();

// A configured gap between Telegram upload attempts should be enforced globally.
(async () => {
  const queue = new SerialUploadQueue({ maxQueueSize: 10, minIntervalMs: 30 });
  const startedAt: number[] = [];

  await Promise.all([
    queue.enqueue(async () => {
      startedAt.push(Date.now());
      return 'first';
    }),
    queue.enqueue(async () => {
      startedAt.push(Date.now());
      return 'second';
    }),
  ]);

  assert.equal(startedAt.length, 2);
  assert.ok(startedAt[1] - startedAt[0] >= 25);
})();

// Bot-wide flood wait should fail new uploads immediately instead of sleeping.
(async () => {
  const queue = new SerialUploadQueue({ maxQueueSize: 10, minIntervalMs: 0 });
  let executed = false;

  queue.setBotFloodWait(300);
  const error = await rejectsWithFloodWait(
    queue.enqueue(async () => {
      executed = true;
      return 'sticker-file-id';
    }),
  );

  assert.equal(executed, false);
  assert.equal(error.retryAfterSeconds, 300);
})();

// Once Telegram reports a bot-wide flood wait, queued uploads should be failed too.
(async () => {
  const queue = new SerialUploadQueue({ maxQueueSize: 10, minIntervalMs: 0 });
  let releaseFirstUpload!: () => void;
  let secondUploadExecuted = false;

  const firstUpload = queue.enqueue(async () => {
    await new Promise<void>((resolve) => {
      releaseFirstUpload = resolve;
    });
    queue.setBotFloodWait(300);
    return 'first-file-id';
  });
  const secondUpload = queue.enqueue(async () => {
    secondUploadExecuted = true;
    return 'second-file-id';
  });

  releaseFirstUpload();

  assert.equal(await firstUpload, 'first-file-id');
  await rejectsWithFloodWait(secondUpload);
  assert.equal(secondUploadExecuted, false);
})();
