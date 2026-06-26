export type InlineNextOffsetInput = {
  currentOffset: number;
  batchSize: number;
  totalEnabled: number;
  completed: boolean;
};

export type InlineBatchAnswerInput = {
  readyCount: number;
  completed: boolean;
};

export function buildInlineNextOffset({
  currentOffset,
  batchSize,
  totalEnabled,
  completed,
}: InlineNextOffsetInput): string {
  if (!completed) {
    return currentOffset.toString();
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
