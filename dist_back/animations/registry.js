"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathMorphRegistry = exports.letterRegistry = exports.colorRegistry = exports.transformRegistry = void 0;
const types_1 = require("../domain/types");
const transform_1 = require("./transform");
const color_1 = require("./color");
const letter_1 = require("./letter");
const bezier_1 = require("../shapes/bezier");
exports.transformRegistry = {
    [types_1.TransformAnimationType.None]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.None, ctx, params),
    [types_1.TransformAnimationType.SlideLoop]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.SlideLoop, ctx, params),
    [types_1.TransformAnimationType.ScalePulse]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.ScalePulse, ctx, params),
    [types_1.TransformAnimationType.RotateContinuous]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.RotateContinuous, ctx, params),
    [types_1.TransformAnimationType.ShakeLoop]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.ShakeLoop, ctx, params),
    [types_1.TransformAnimationType.Bounce]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.Bounce, ctx, params),
    [types_1.TransformAnimationType.Vibrate]: (ctx, params) => (0, transform_1.buildTransformPatch)(types_1.TransformAnimationType.Vibrate, ctx, params),
};
exports.colorRegistry = {
    [types_1.ColorAnimationType.None]: (ctx, _phase = 0, base = [1, 1, 1], params) => (0, color_1.buildColorTrack)(types_1.ColorAnimationType.None, ctx, _phase, base, params),
    [types_1.ColorAnimationType.CycleRGB]: (ctx, phase = 0, base = [1, 1, 1], params) => (0, color_1.buildColorTrack)(types_1.ColorAnimationType.CycleRGB, ctx, phase, base, params),
    [types_1.ColorAnimationType.Rainbow]: (ctx, phase = 0, base = [1, 1, 1], params) => (0, color_1.buildColorTrack)(types_1.ColorAnimationType.Rainbow, ctx, phase, base, params),
};
exports.letterRegistry = {
    [types_1.LetterAnimationType.None]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.None, ctx, params),
    [types_1.LetterAnimationType.Vibrate]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.Vibrate, ctx, params),
    [types_1.LetterAnimationType.TypingFall]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.TypingFall, ctx, params),
    [types_1.LetterAnimationType.Wave]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.Wave, ctx, params),
    [types_1.LetterAnimationType.ZigZag]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.ZigZag, ctx, params),
    [types_1.LetterAnimationType.Rotate]: (ctx, params) => (0, letter_1.buildLetterTransform)(types_1.LetterAnimationType.Rotate, ctx, params),
};
exports.pathMorphRegistry = {
    [types_1.PathMorphAnimationType.None]: () => null,
    [types_1.PathMorphAnimationType.Warp]: (bez, fontSize, duration, seed, params) => (0, bezier_1.buildPathMorphKeyframes)(bez, fontSize, duration, types_1.PathMorphAnimationType.Warp, seed, params),
    [types_1.PathMorphAnimationType.WarpAiry]: (bez, fontSize, duration, seed, params) => (0, bezier_1.buildPathMorphKeyframes)(bez, fontSize, duration, types_1.PathMorphAnimationType.WarpAiry, seed, params),
    [types_1.PathMorphAnimationType.SkewPulse]: (bez, fontSize, duration, seed, params) => (0, bezier_1.buildPathMorphKeyframes)(bez, fontSize, duration, types_1.PathMorphAnimationType.SkewPulse, seed, params),
    [types_1.PathMorphAnimationType.SkewSwing]: (bez, fontSize, duration, seed, params) => (0, bezier_1.buildPathMorphKeyframes)(bez, fontSize, duration, types_1.PathMorphAnimationType.SkewSwing, seed, params),
};
//# sourceMappingURL=registry.js.map