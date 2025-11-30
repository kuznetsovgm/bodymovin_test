"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerMessageType = void 0;
/**
 * Message types for worker communication
 */
var WorkerMessageType;
(function (WorkerMessageType) {
    WorkerMessageType["TASK"] = "task";
    WorkerMessageType["RESULT"] = "result";
    WorkerMessageType["ERROR"] = "error";
    WorkerMessageType["READY"] = "ready";
})(WorkerMessageType || (exports.WorkerMessageType = WorkerMessageType = {}));
//# sourceMappingURL=types.js.map