import { parentPort, type TransferListItem } from 'worker_threads';
import { generateSticker, stickerToBuffer } from '../pipeline/generateSticker';
import {
    WorkerMessageType,
    WorkerTaskMessage,
    StickerGenerationResult,
    WorkerResultMessage,
    WorkerErrorMessage,
    WorkerReadyMessage,
    TransferableStickerBuffer
} from './types';
import { logger } from '../logger';

/**
 * Worker process for generating stickers in parallel
 * Receives tasks from the main thread and returns results
 */

if (!parentPort) {
    throw new Error('This module must be run as a worker thread');
}

// Notify main thread that worker is ready
const readyMessage: WorkerReadyMessage = {
    type: WorkerMessageType.READY,
};
parentPort.postMessage(readyMessage);

function prepareTransferableSticker(buffer: Buffer): {
    payload: TransferableStickerBuffer;
    transferList: TransferListItem[];
} {
    const needsCopy = buffer.byteOffset !== 0 || buffer.buffer.byteLength !== buffer.byteLength;

    if (!needsCopy) {
        const transferableBuffer = buffer.buffer as ArrayBuffer;
        return {
            payload: {
                buffer: transferableBuffer,
                byteOffset: buffer.byteOffset,
                byteLength: buffer.byteLength,
            },
            transferList: [transferableBuffer],
        };
    }

    const transferBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(transferBuffer).set(buffer);

    return {
        payload: {
            buffer: transferBuffer,
            byteOffset: 0,
            byteLength: buffer.byteLength,
        },
        transferList: [transferBuffer],
    };
}

// Listen for tasks from main thread
parentPort.on('message', async (message: WorkerTaskMessage) => {
    if (message.type !== WorkerMessageType.TASK) {
        return;
    }

    const { task } = message;
    const startTime = Date.now();

    try {
        logger.debug(`Worker processing task ${task.id} for "${task.text}"`);

        // Generate sticker with the provided configuration
        const sticker = await generateSticker({
            text: task.text,
            frameRate: 60,
            duration: 180,
            ...task.variant,
        });
        const gzStickerBuffer = await stickerToBuffer(sticker);
        const { payload: stickerBuffer, transferList } = prepareTransferableSticker(gzStickerBuffer);

        const duration = (Date.now() - startTime) / 1000;

        const result: StickerGenerationResult = {
            taskId: task.id,
            success: true,
            stickerBuffer,
            duration,
            index: task.index,
        };

        const resultMessage: WorkerResultMessage = {
            type: WorkerMessageType.RESULT,
            result,
        };

        parentPort!.postMessage(resultMessage, transferList);
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(`Worker error processing task ${task.id}:`, error);

        const result: StickerGenerationResult = {
            taskId: task.id,
            success: false,
            error: errorMessage,
            duration,
            index: task.index,
        };

        const resultMessage: WorkerResultMessage = {
            type: WorkerMessageType.RESULT,
            result,
        };

        parentPort!.postMessage(resultMessage);
    }
});

// Handle worker errors
parentPort.on('messageerror', (error) => {
    logger.error('Worker message error:', error);
    const errorMessage: WorkerErrorMessage = {
        type: WorkerMessageType.ERROR,
        error: error.message,
    };
    parentPort!.postMessage(errorMessage);
});
