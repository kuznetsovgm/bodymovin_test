import { parentPort } from 'worker_threads';
import { generateSticker } from '../pipeline/generateSticker';
import {
    WorkerMessageType,
    WorkerTaskMessage,
    StickerGenerationResult,
    WorkerResultMessage,
    WorkerErrorMessage,
    WorkerReadyMessage,
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
            fontSize: 72,
            frameRate: 60,
            duration: 180,
            ...task.variant,
        });

        const duration = (Date.now() - startTime) / 1000;

        const result: StickerGenerationResult = {
            taskId: task.id,
            success: true,
            sticker,
            duration,
            index: task.index,
        };

        const resultMessage: WorkerResultMessage = {
            type: WorkerMessageType.RESULT,
            result,
        };

        parentPort!.postMessage(resultMessage);
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
