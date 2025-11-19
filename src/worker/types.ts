import { GenerateStickerOptions } from '../domain/types';
import { Sticker } from '../interfaces/sticker';

/**
 * Task to be processed by a worker
 */
export interface StickerGenerationTask {
    id: string;
    text: string;
    variant: Omit<GenerateStickerOptions, 'text'>;
    configId: string;
    index: number;
}

/**
 * Result from a worker after processing a task
 */
export interface StickerGenerationResult {
    taskId: string;
    success: boolean;
    sticker?: Sticker;
    error?: string;
    duration: number;
    index: number;
}

/**
 * Message types for worker communication
 */
export enum WorkerMessageType {
    TASK = 'task',
    RESULT = 'result',
    ERROR = 'error',
    READY = 'ready',
}

/**
 * Message sent to worker
 */
export interface WorkerTaskMessage {
    type: WorkerMessageType.TASK;
    task: StickerGenerationTask;
}

/**
 * Message received from worker
 */
export interface WorkerResultMessage {
    type: WorkerMessageType.RESULT;
    result: StickerGenerationResult;
}

export interface WorkerErrorMessage {
    type: WorkerMessageType.ERROR;
    error: string;
    taskId?: string;
}

export interface WorkerReadyMessage {
    type: WorkerMessageType.READY;
}

export type WorkerMessage = WorkerTaskMessage | WorkerResultMessage | WorkerErrorMessage | WorkerReadyMessage;
