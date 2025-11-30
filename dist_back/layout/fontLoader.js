"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadFont = void 0;
const opentype_js_1 = __importDefault(require("opentype.js"));
const fs_1 = require("../shared/fs");
const fontCache = new Map();
function loadFont(fontPath) {
    if (!fontCache.has(fontPath)) {
        fontCache.set(fontPath, (0, fs_1.promisify)(opentype_js_1.default.load, fontPath));
    }
    return fontCache.get(fontPath);
}
exports.loadFont = loadFont;
//# sourceMappingURL=fontLoader.js.map