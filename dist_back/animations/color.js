"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildColorTrack = void 0;
const types_1 = require("../domain/types");
const keyframes_1 = require("../shared/keyframes");
const animation_config_1 = require("../config/animation-config");
function buildColorTrack(type, ctx, phase = 0, baseColor = [1, 1, 1], params) {
    const { duration } = ctx;
    switch (type) {
        case types_1.ColorAnimationType.CycleRGB: {
            const cfg = {
                ...animation_config_1.colorAnimationConfig[types_1.ColorAnimationType.CycleRGB],
                ...(params ?? {}),
            };
            const times = cfg.times.map((t) => t * duration);
            return {
                a: 1,
                k: (0, keyframes_1.buildRawKeyframes)(cfg.colors, times, cfg.loop),
            };
        }
        case types_1.ColorAnimationType.Rainbow: {
            const cfg = {
                ...animation_config_1.colorAnimationConfig[types_1.ColorAnimationType.Rainbow],
                ...(params ?? {}),
            };
            const baseTimes = cfg.times.map((t) => t * duration);
            const shifted = baseTimes.map((t) => (t + phase * duration) % duration);
            const pairs = baseTimes
                .map((t, i) => ({ time: shifted[i], color: cfg.colors[i] }))
                .sort((a, b) => a.time - b.time);
            return {
                a: 1,
                k: (0, keyframes_1.buildRawKeyframes)(pairs.map((p) => p.color), pairs.map((p) => p.time), true),
            };
        }
        case types_1.ColorAnimationType.None:
        default: {
            const cfg = {
                ...animation_config_1.colorAnimationConfig[types_1.ColorAnimationType.None],
                ...(params ?? {}),
            };
            return {
                a: 1,
                k: (0, keyframes_1.buildRawKeyframes)([
                    [...(params?.baseColor ?? baseColor), 1],
                    [...(params?.baseColor ?? baseColor), 1],
                ], [0, duration], cfg.loop ?? false),
            };
        }
    }
}
exports.buildColorTrack = buildColorTrack;
//# sourceMappingURL=color.js.map