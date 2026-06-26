export type InlineNextOffsetInput = {
  currentOffset: number;
  batchSize: number;
  totalEnabled: number;
  completed: boolean;
  deliveredCount: number;
  returnedCount: number;
};

export type InlineBatchAnswerInput = {
  readyCount: number;
  completed: boolean;
};

export type InlineProgressOffset = {
  offset: number;
  deliveredCount: number;
  isProgressOffset: boolean;
};

const PROGRESS_OFFSET_PREFIX = 'p';

export function buildInlineNextOffset({
  currentOffset,
  batchSize,
  totalEnabled,
  completed,
  deliveredCount,
  returnedCount,
}: InlineNextOffsetInput): string {
  if (!completed) {
    return `${PROGRESS_OFFSET_PREFIX}:${currentOffset}:${deliveredCount + returnedCount}`;
  }

  const nextOffset = currentOffset + batchSize;
  return nextOffset < totalEnabled ? nextOffset.toString() : '';
}

export function shouldAnswerInlineBatch({
  readyCount,
  completed,
}: InlineBatchAnswerInput): boolean {
  return readyCount > 0 || completed;
}

export function parseInlineProgressOffset(offset: string): InlineProgressOffset {
  if (!offset) {
    return { offset: 0, deliveredCount: 0, isProgressOffset: false };
  }

  const progressMatch = offset.match(/^p:(\d+):(\d+)$/);
  if (progressMatch) {
    return {
      offset: parseInt(progressMatch[1], 10),
      deliveredCount: parseInt(progressMatch[2], 10),
      isProgressOffset: true,
    };
  }

  const numericOffset = parseInt(offset, 10);
  return {
    offset: Number.isFinite(numericOffset) ? numericOffset : 0,
    deliveredCount: 0,
    isProgressOffset: false,
  };
}

export function getUndeliveredInlineResults<T>(
  results: T[],
  deliveredCount: number,
): T[] {
  return results.slice(Math.max(0, deliveredCount));
}
