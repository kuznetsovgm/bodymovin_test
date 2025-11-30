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
exports.promisify = exports.jsonToGzBuffer = exports.writeJsonGz = exports.ensureDir = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
async function ensureDir(p) {
    await fs.mkdir(path.resolve(p), { recursive: true });
}
exports.ensureDir = ensureDir;
async function writeJsonGz(obj, outPath) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const gz = await promisify(zlib.gzip, json);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, gz);
}
exports.writeJsonGz = writeJsonGz;
async function jsonToGzBuffer(obj) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return await promisify(zlib.gzip, json);
}
exports.jsonToGzBuffer = jsonToGzBuffer;
async function promisify(fn, ...args) {
    return new Promise((resolve, reject) => {
        fn(...args, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}
exports.promisify = promisify;
//# sourceMappingURL=fs.js.map