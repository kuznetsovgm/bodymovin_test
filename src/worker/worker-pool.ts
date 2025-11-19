import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import {
    StickerGenerationTask,
    StickerGenerationResult,
    WorkerMessageType,
    WorkerTaskMessage,
    WorkerResultMessage,
    WorkerErrorMessage,
    WorkerReadyMessage,
} from './types';
import { logger } from '../logger';
import {
    workerPoolActiveWorkers,
    workerPoolQueueSize,
    workerTaskDuration,
} from '../metrics';

interface WorkerInfo {
    worker: Worker;
    busy: boolean;
    tasksCompleted: number;
}

interface PendingTask {
    task: StickerGenerationTask;
    resolve: (result: StickerGenerationResult) => void;
    reject: (error: Error) => void;
}

/**
 * Worker pool for parallel sticker generation
 * Manages a pool of worker threads to process sticker generation tasks
 */
export class StickerWorkerPool {
    private workers: WorkerInfo[] = [];
    private taskQueue: PendingTask[] = [];
    private maxWorkers: number;
    private maxQueueSize: number;
    private workerPath: string;
    private initialized: boolean = false;

    constructor(maxWorkers?: number, maxQueueSize: number = 100) {
        this.maxWorkers = maxWorkers || os.cpus().length;
        this.maxQueueSize = maxQueueSize;
        this.workerPath = path.join(__dirname, 'sticker-worker.js');
    }

    /**
     * Initialize the worker pool
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        logger.info(`Initializing worker pool with ${this.maxWorkers} workers...`);

        const initPromises: Promise<void>[] = [];

        for (let i = 0; i < this.maxWorkers; i++) {
            initPromises.push(this.createWorker());
        }

        await Promise.all(initPromises);
        this.initialized = true;
        workerPoolActiveWorkers.set(this.workers.length);

        logger.info(`Worker pool initialized with ${this.workers.length} workers`);
    }

    /**
     * Create a new worker
     */
    private async createWorker(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(this.workerPath);

                const workerInfo: WorkerInfo = {
                    worker,
                    busy: false,
                    tasksCompleted: 0,
                };

                // Handle worker ready event
                const readyHandler = (message: WorkerReadyMessage | WorkerResultMessage | WorkerErrorMessage) => {
                    if (message.type === WorkerMessageType.READY) {
                        logger.debug(`Worker ${worker.threadId} is ready`);
                        worker.off('message', readyHandler);
                        this.workers.push(workerInfo);
                        this.setupWorkerHandlers(workerInfo);
                        resolve();
                    }
                };

                worker.on('message', readyHandler);

                // Handle worker errors during initialization
                worker.once('error', (error) => {
                    logger.error(`Worker initialization error:`, error);
                    reject(error);
                });

                worker.once('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            } catch (error) {
                logger.error('Failed to create worker:', error);
                reject(error);
            }
        });
    }

    /**
     * Setup message handlers for a worker
     */
    private setupWorkerHandlers(workerInfo: WorkerInfo): void {
        const { worker } = workerInfo;

        worker.on('message', (message: WorkerResultMessage | WorkerErrorMessage) => {
            if (message.type === WorkerMessageType.RESULT) {
                const result = message.result;
                workerInfo.busy = false;
                workerInfo.tasksCompleted++;

                // Record metrics
                const animType = 'unknown'; // Will be set by the result
                workerTaskDuration.observe({ status: result.success ? 'success' : 'error' }, result.duration);

                logger.debug(
                    `Worker ${worker.threadId} completed task ${result.taskId} (success: ${result.success})`
                );

                // Process next task in queue
                this.processNextTask();
            } else if (message.type === WorkerMessageType.ERROR) {
                logger.error(`Worker ${worker.threadId} error:`, message.error);
                workerInfo.busy = false;
                this.processNextTask();
            }
        });

        worker.on('error', (error) => {
            logger.error(`Worker ${worker.threadId} error:`, error);
            workerInfo.busy = false;
            this.removeWorker(workerInfo);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                logger.error(`Worker ${worker.threadId} exited with code ${code}`);
            }
            this.removeWorker(workerInfo);
        });
    }

    /**
     * Remove a worker from the pool
     */
    private removeWorker(workerInfo: WorkerInfo): void {
        const index = this.workers.indexOf(workerInfo);
        if (index !== -1) {
            this.workers.splice(index, 1);
            workerPoolActiveWorkers.set(this.workers.length);
            logger.warn(`Worker removed. Active workers: ${this.workers.length}`);
        }
    }

    /**
     * Process the next task in the queue
     */
    private processNextTask(): void {
        if (this.taskQueue.length === 0) {
            workerPoolQueueSize.set(0);
            return;
        }

        const availableWorker = this.workers.find((w) => !w.busy);
        if (!availableWorker) {
            return;
        }

        const pendingTask = this.taskQueue.shift();
        if (!pendingTask) {
            return;
        }

        workerPoolQueueSize.set(this.taskQueue.length);
        this.executeTask(availableWorker, pendingTask);
    }

    /**
     * Execute a task on a worker
     */
    private executeTask(workerInfo: WorkerInfo, pendingTask: PendingTask): void {
        workerInfo.busy = true;
        const { task, resolve, reject } = pendingTask;

        logger.debug(`Assigning task ${task.id} to worker ${workerInfo.worker.threadId}`);

        // Setup one-time result handler
        const resultHandler = (message: WorkerResultMessage | WorkerErrorMessage) => {
            if (message.type === WorkerMessageType.RESULT && message.result.taskId === task.id) {
                workerInfo.worker.off('message', resultHandler);
                resolve(message.result);
            } else if (message.type === WorkerMessageType.ERROR && message.taskId === task.id) {
                workerInfo.worker.off('message', resultHandler);
                reject(new Error(message.error));
            }
        };

        workerInfo.worker.on('message', resultHandler);

        // Send task to worker
        const taskMessage: WorkerTaskMessage = {
            type: WorkerMessageType.TASK,
            task,
        };

        try {
            workerInfo.worker.postMessage(taskMessage);
        } catch (error) {
            workerInfo.worker.off('message', resultHandler);
            workerInfo.busy = false;
            reject(error as Error);
            this.processNextTask();
        }
    }

    /**
     * Submit a task to the worker pool
     */
    async submitTask(task: StickerGenerationTask): Promise<StickerGenerationResult> {
        if (!this.initialized) {
            throw new Error('Worker pool not initialized. Call initialize() first.');
        }

        if (this.taskQueue.length >= this.maxQueueSize) {
            throw new Error(`Task queue is full (max: ${this.maxQueueSize})`);
        }

        return new Promise((resolve, reject) => {
            const pendingTask: PendingTask = { task, resolve, reject };

            // Try to execute immediately if worker is available
            const availableWorker = this.workers.find((w) => !w.busy);
            if (availableWorker) {
                this.executeTask(availableWorker, pendingTask);
            } else {
                // Add to queue
                this.taskQueue.push(pendingTask);
                workerPoolQueueSize.set(this.taskQueue.length);
                logger.debug(`Task ${task.id} queued. Queue size: ${this.taskQueue.length}`);
            }
        });
    }

    /**
     * Submit multiple tasks and wait for all to complete
     */
    async submitBatch(tasks: StickerGenerationTask[]): Promise<StickerGenerationResult[]> {
        const promises = tasks.map((task) => this.submitTask(task));
        return Promise.all(promises);
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            totalWorkers: this.workers.length,
            busyWorkers: this.workers.filter((w) => w.busy).length,
            idleWorkers: this.workers.filter((w) => !w.busy).length,
            queueSize: this.taskQueue.length,
            tasksCompleted: this.workers.reduce((sum, w) => sum + w.tasksCompleted, 0),
        };
    }

    /**
     * Shutdown the worker pool
     */
    async shutdown(): Promise<void> {
        logger.info('Shutting down worker pool...');

        const terminatePromises = this.workers.map((workerInfo) => {
            return workerInfo.worker.terminate();
        });

        await Promise.all(terminatePromises);

        this.workers = [];
        this.taskQueue = [];
        this.initialized = false;
        workerPoolActiveWorkers.set(0);
        workerPoolQueueSize.set(0);

        logger.info('Worker pool shut down');
    }
}
