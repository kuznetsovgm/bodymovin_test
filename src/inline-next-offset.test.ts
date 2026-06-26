import assert from 'node:assert';
import {
  buildInlineNextOffset,
  getUndeliveredInlineResults,
  parseInlineProgressOffset,
  shouldAnswerInlineBatch,
} from './inline-next-offset';

// While a generation batch is still running, keep Telegram polling the same batch.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 0,
    batchSize: 10,
    totalEnabled: 50,
    completed: false,
    deliveredCount: 0,
    returnedCount: 1,
  });

  assert.equal(nextOffset, 'p:0:1');
})();

// Non-zero offsets must also be returned unchanged while the batch is incomplete.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 20,
    batchSize: 10,
    totalEnabled: 50,
    completed: false,
    deliveredCount: 3,
    returnedCount: 2,
  });

  assert.equal(nextOffset, 'p:20:5');
})();

// Once the batch is complete, advance to the next config page.
(() => {
  const nextOffset = buildInlineNextOffset({
    currentOffset: 20,
    batchSize: 10,
    totalEnabled: 50,
    completed: true,
    deliveredCount: 8,
    returnedCount: 2,
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
    deliveredCount: 10,
    returnedCount: 0,
  });

  assert.equal(nextOffset, '');
})();

// Empty Telegram offsets start at the first config batch without delivered results.
(() => {
  assert.deepEqual(parseInlineProgressOffset(''), {
    offset: 0,
    deliveredCount: 0,
    isProgressOffset: false,
  });
})();

// Plain numeric offsets remain config pagination offsets.
(() => {
  assert.deepEqual(parseInlineProgressOffset('20'), {
    offset: 20,
    deliveredCount: 0,
    isProgressOffset: false,
  });
})();

// Progress offsets carry both config batch offset and already returned count.
(() => {
  assert.deepEqual(parseInlineProgressOffset('p:20:5'), {
    offset: 20,
    deliveredCount: 5,
    isProgressOffset: true,
  });
})();

// Repeated Telegram polling should only return results not represented by the offset cursor.
(() => {
  assert.deepEqual(getUndeliveredInlineResults(['a', 'b', 'c'], 1), [
    'b',
    'c',
  ]);
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
