"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFill = void 0;
const lottie_1 = require("../interfaces/lottie");
const types_1 = require("../domain/types");
const keyframes_1 = require("../shared/keyframes");
function createFill(colorAnimation, duration, phase = 0, cix = 2, fillColor = [1, 1, 1]) {
    switch (colorAnimation) {
        case types_1.ColorAnimationType.CycleRGB:
            return {
                cix,
                ty: lottie_1.ShapeType.Fill,
                c: {
                    a: 1,
                    k: (0, keyframes_1.buildRawKeyframes)([
                        [1, 0, 0, 1],
                        [0, 1, 0, 1],
                        [0, 0, 1, 1],
                        [1, 0, 0, 1],
                    ], [0, duration / 3, (2 * duration) / 3, duration], true),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill RGB Cycle',
                hd: false,
            };
        case types_1.ColorAnimationType.Rainbow: {
            const colors = [
                [1, 0, 0, 1],
                [1, 0.5, 0, 1],
                [1, 1, 0, 1],
                [0, 1, 0, 1],
                [0, 0.5, 1, 1],
                [0, 0, 1, 1],
                [0.5, 0, 1, 1],
                [1, 0, 0.5, 1],
                [1, 0, 0, 1],
            ];
            const times = colors.map((_, idx) => (idx / 8) * duration);
            const shifted = times.map((t) => (t + phase * duration) % duration);
            const pairs = times
                .map((t, i) => ({ time: shifted[i], color: colors[i] }))
                .sort((a, b) => a.time - b.time);
            return {
                cix,
                ty: lottie_1.ShapeType.Fill,
                c: {
                    a: 1,
                    k: (0, keyframes_1.buildRawKeyframes)(pairs.map((p) => p.color), pairs.map((p) => p.time), true),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill Rainbow Wave',
                hd: false,
            };
        }
        case types_1.ColorAnimationType.None:
        default:
            return {
                cix,
                ty: lottie_1.ShapeType.Fill,
                c: {
                    a: 1,
                    k: (0, keyframes_1.buildRawKeyframes)([
                        [...fillColor, 1],
                        [...fillColor, 1],
                    ], [0, duration], false),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill None',
                hd: false,
            };
    }
}
exports.createFill = createFill;
//# sourceMappingURL=fill.js.map