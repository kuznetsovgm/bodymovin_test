"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const generateSticker_1 = require("../pipeline/generateSticker");
const types_1 = require("./types");
const logger_1 = require("../logger");
/**
 * Worker process for generating stickers in parallel
 * Receives tasks from the main thread and returns results
 */
if (!worker_threads_1.parentPort) {
    throw new Error('This module must be run as a worker thread');
}
// Notify main thread that worker is ready
const readyMessage = {
    type: types_1.WorkerMessageType.READY,
};
worker_threads_1.parentPort.postMessage(readyMessage);
// Listen for tasks from main thread
worker_threads_1.parentPort.on('message', async (message) => {
    if (message.type !== types_1.WorkerMessageType.TASK) {
        return;
    }
    const { task } = message;
    const startTime = Date.now();
    try {
        logger_1.logger.debug(`Worker processing task ${task.id} for "${task.text}"`);
        // Generate sticker with the provided configuration
        const sticker = await (0, generateSticker_1.generateSticker)({
            text: task.text,
            frameRate: 60,
            duration: 180,
            ...task.variant,
        });
        const duration = (Date.now() - startTime) / 1000;
        const result = {
            taskId: task.id,
            success: true,
            sticker,
            duration,
            index: task.index,
        };
        const resultMessage = {
            type: types_1.WorkerMessageType.RESULT,
            result,
        };
        worker_threads_1.parentPort.postMessage(resultMessage);
    }
    catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`Worker error processing task ${task.id}:`, error);
        const result = {
            taskId: task.id,
            success: false,
            error: errorMessage,
            duration,
            index: task.index,
        };
        const resultMessage = {
            type: types_1.WorkerMessageType.RESULT,
            result,
        };
        worker_threads_1.parentPort.postMessage(resultMessage);
    }
});
// Handle worker errors
worker_threads_1.parentPort.on('messageerror', (error) => {
    logger_1.logger.error('Worker message error:', error);
    const errorMessage = {
        type: types_1.WorkerMessageType.ERROR,
        error: error.message,
    };
    worker_threads_1.parentPort.postMessage(errorMessage);
});
//# sourceMappingURL=sticker-worker.js.map