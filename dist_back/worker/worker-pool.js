"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StickerWorkerPool = void 0;
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const types_1 = require("./types");
const logger_1 = require("../logger");
const metrics_1 = require("../metrics");
/**
 * Worker pool for parallel sticker generation
 * Manages a pool of worker threads to process sticker generation tasks
 */
class StickerWorkerPool {
    workers = [];
    taskQueue = [];
    maxWorkers;
    maxQueueSize;
    workerPath;
    initialized = false;
    constructor(maxWorkers, maxQueueSize = 100) {
        this.maxWorkers = maxWorkers || os.cpus().length;
        this.maxQueueSize = maxQueueSize;
        this.workerPath = path.join(__dirname, 'sticker-worker.js');
    }
    /**
     * Initialize the worker pool
     */
    async initialize() {
        if (this.initialized) {
            return;
        }
        logger_1.logger.info(`Initializing worker pool with ${this.maxWorkers} workers...`);
        const initPromises = [];
        for (let i = 0; i < this.maxWorkers; i++) {
            initPromises.push(this.createWorker());
        }
        await Promise.all(initPromises);
        this.initialized = true;
        metrics_1.workerPoolActiveWorkers.set(this.workers.length);
        logger_1.logger.info(`Worker pool initialized with ${this.workers.length} workers`);
    }
    /**
     * Create a new worker
     */
    async createWorker() {
        return new Promise((resolve, reject) => {
            try {
                const worker = new worker_threads_1.Worker(this.workerPath);
                const workerInfo = {
                    worker,
                    busy: false,
                    tasksCompleted: 0,
                };
                // Handle worker ready event
                const readyHandler = (message) => {
                    if (message.type === types_1.WorkerMessageType.READY) {
                        logger_1.logger.debug(`Worker ${worker.threadId} is ready`);
                        worker.off('message', readyHandler);
                        this.workers.push(workerInfo);
                        this.setupWorkerHandlers(workerInfo);
                        resolve();
                    }
                };
                worker.on('message', readyHandler);
                // Handle worker errors during initialization
                worker.once('error', (error) => {
                    logger_1.logger.error(`Worker initialization error:`, error);
                    reject(error);
                });
                worker.once('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to create worker:', error);
                reject(error);
            }
        });
    }
    /**
     * Setup message handlers for a worker
     */
    setupWorkerHandlers(workerInfo) {
        const { worker } = workerInfo;
        worker.on('message', (message) => {
            if (message.type === types_1.WorkerMessageType.RESULT) {
                const result = message.result;
                workerInfo.busy = false;
                workerInfo.tasksCompleted++;
                // Record metrics
                const animType = 'unknown'; // Will be set by the result
                metrics_1.workerTaskDuration.observe({ status: result.success ? 'success' : 'error' }, result.duration);
                logger_1.logger.debug(`Worker ${worker.threadId} completed task ${result.taskId} (success: ${result.success})`);
                // Process next task in queue
                this.processNextTask();
            }
            else if (message.type === types_1.WorkerMessageType.ERROR) {
                logger_1.logger.error(`Worker ${worker.threadId} error:`, message.error);
                workerInfo.busy = false;
                this.processNextTask();
            }
        });
        worker.on('error', (error) => {
            logger_1.logger.error(`Worker ${worker.threadId} error:`, error);
            workerInfo.busy = false;
            this.removeWorker(workerInfo);
        });
        worker.on('exit', (code) => {
            if (code !== 0) {
                logger_1.logger.error(`Worker ${worker.threadId} exited with code ${code}`);
            }
            this.removeWorker(workerInfo);
        });
    }
    /**
     * Remove a worker from the pool
     */
    removeWorker(workerInfo) {
        const index = this.workers.indexOf(workerInfo);
        if (index !== -1) {
            this.workers.splice(index, 1);
            metrics_1.workerPoolActiveWorkers.set(this.workers.length);
            logger_1.logger.warn(`Worker removed. Active workers: ${this.workers.length}`);
        }
    }
    /**
     * Process the next task in the queue
     */
    processNextTask() {
        if (this.taskQueue.length === 0) {
            metrics_1.workerPoolQueueSize.set(0);
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
        metrics_1.workerPoolQueueSize.set(this.taskQueue.length);
        this.executeTask(availableWorker, pendingTask);
    }
    /**
     * Execute a task on a worker
     */
    executeTask(workerInfo, pendingTask) {
        workerInfo.busy = true;
        const { task, resolve, reject } = pendingTask;
        logger_1.logger.debug(`Assigning task ${task.id} to worker ${workerInfo.worker.threadId}`);
        // Setup one-time result handler
        const resultHandler = (message) => {
            if (message.type === types_1.WorkerMessageType.RESULT && message.result.taskId === task.id) {
                workerInfo.worker.off('message', resultHandler);
                resolve(message.result);
            }
            else if (message.type === types_1.WorkerMessageType.ERROR && message.taskId === task.id) {
                workerInfo.worker.off('message', resultHandler);
                reject(new Error(message.error));
            }
        };
        workerInfo.worker.on('message', resultHandler);
        // Send task to worker
        const taskMessage = {
            type: types_1.WorkerMessageType.TASK,
            task,
        };
        try {
            workerInfo.worker.postMessage(taskMessage);
        }
        catch (error) {
            workerInfo.worker.off('message', resultHandler);
            workerInfo.busy = false;
            reject(error);
            this.processNextTask();
        }
    }
    /**
     * Submit a task to the worker pool
     */
    async submitTask(task) {
        if (!this.initialized) {
            throw new Error('Worker pool not initialized. Call initialize() first.');
        }
        if (this.taskQueue.length >= this.maxQueueSize) {
            throw new Error(`Task queue is full (max: ${this.maxQueueSize})`);
        }
        return new Promise((resolve, reject) => {
            const pendingTask = { task, resolve, reject };
            // Try to execute immediately if worker is available
            const availableWorker = this.workers.find((w) => !w.busy);
            if (availableWorker) {
                this.executeTask(availableWorker, pendingTask);
            }
            else {
                // Add to queue
                this.taskQueue.push(pendingTask);
                metrics_1.workerPoolQueueSize.set(this.taskQueue.length);
                logger_1.logger.debug(`Task ${task.id} queued. Queue size: ${this.taskQueue.length}`);
            }
        });
    }
    /**
     * Submit multiple tasks and wait for all to complete
     */
    async submitBatch(tasks) {
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
    async shutdown() {
        logger_1.logger.info('Shutting down worker pool...');
        const terminatePromises = this.workers.map((workerInfo) => {
            return workerInfo.worker.terminate();
        });
        await Promise.all(terminatePromises);
        this.workers = [];
        this.taskQueue = [];
        this.initialized = false;
        metrics_1.workerPoolActiveWorkers.set(0);
        metrics_1.workerPoolQueueSize.set(0);
        logger_1.logger.info('Worker pool shut down');
    }
}
exports.StickerWorkerPool = StickerWorkerPool;
//# sourceMappingURL=worker-pool.js.map