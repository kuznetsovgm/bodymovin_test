import assert from 'node:assert';
import {
  buildInlineNextOffset,
  shouldAnswerInlineBatch,
} from './inline-next-offset';

// While a generation batch is still running, keep Telegram polling the same batch.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 0,
    batchSize: 10,
    totalEnabled: 50,
    completed: false,
  });

  assert.equal(nextOffset, '0');
})();

// Non-zero offsets must also be returned unchanged while the batch is incomplete.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 20,
    batchSize: 10,
    totalEnabled: 50,
    completed: false,
  });

  assert.equal(nextOffset, '20');
})();

// Once the batch is complete, advance to the next config page.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 20,
    batchSize: 10,
    totalEnabled: 50,
    completed: true,
  });

  assert.equal(nextOffset, '30');
})();

// A completed final batch should stop pagination.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 40,
    batchSize: 10,
    totalEnabled: 50,
    completed: true,
  });

  assert.equal(nextOffset, '');
})();

// Empty incomplete batches should not be sent to Telegram as empty results.
(() => {
  assert.equal(
    shouldAnswerInlineBatch({ readyCount: 0, completed: false }),
    false,
  );
})();

// A batch with at least one ready result can be sent and keep polling via next_offset.
(() => {
  assert.equal(
    shouldAnswerInlineBatch({ readyCount: 1, completed: false }),
    true,
  );
})();

// A completed empty batch can be answered to stop the client from waiting forever.
(() => {
  assert.equal(
    shouldAnswerInlineBatch({ readyCount: 0, completed: true }),
    true,
  );
})();
