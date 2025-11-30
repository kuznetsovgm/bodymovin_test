"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLetterSeed = exports.seededNoise = void 0;
function seededNoise(base, salt = 0) {
    const v = Math.sin(base * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
}
exports.seededNoise = seededNoise;
function buildLetterSeed(letterIndex, charCode, globalSeed = 0) {
    return (letterIndex + 1) * 97.13 + charCode * 0.61 + globalSeed * 0.37;
}
exports.buildLetterSeed = buildLetterSeed;
//# sourceMappingURL=noise.js.map