import { AnimationDescriptor, ColorAnimationType, LetterAnimationType, PathMorphAnimationType, TransformAnimationType } from '../domain/types';
import { TransformPatch, buildTransformPatch } from './transform';
import { buildColorTrack, ColorContext } from './color';
import { buildLetterTransform, LetterContext } from './letter';
import { buildPathMorphKeyframes } from '../shapes/bezier';
import { ShapeLayer } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';

export const transformRegistry: Record<
    TransformAnimationType,
    (ctx: { width: number; height: number; duration: number }) => TransformPatch
> = {
    [TransformAnimationType.None]: () => ({}),
    [TransformAnimationType.SlideLoop]: (ctx) => buildTransformPatch(TransformAnimationType.SlideLoop, ctx),
    [TransformAnimationType.ScalePulse]: (ctx) => buildTransformPatch(TransformAnimationType.ScalePulse, ctx),
    [TransformAnimationType.RotateContinuous]: (ctx) => buildTransformPatch(TransformAnimationType.RotateContinuous, ctx),
    [TransformAnimationType.ShakeLoop]: (ctx) => buildTransformPatch(TransformAnimationType.ShakeLoop, ctx),
    [TransformAnimationType.Bounce]: (ctx) => buildTransformPatch(TransformAnimationType.Bounce, ctx),
    [TransformAnimationType.Vibrate]: (ctx) => buildTransformPatch(TransformAnimationType.Vibrate, ctx),
};

export const colorRegistry: Record<
    ColorAnimationType,
    (ctx: ColorContext, phase?: number, baseColor?: [number, number, number]) => Track<number[]>
> = {
    [ColorAnimationType.None]: (ctx, _phase = 0, base = [1, 1, 1]) => buildColorTrack(ColorAnimationType.None, ctx, _phase, base),
    [ColorAnimationType.CycleRGB]: (ctx, phase = 0, base = [1, 1, 1]) => buildColorTrack(ColorAnimationType.CycleRGB, ctx, phase, base),
    [ColorAnimationType.Pulse]: (ctx, phase = 0, base = [1, 1, 1]) => buildColorTrack(ColorAnimationType.Pulse, ctx, phase, base),
    [ColorAnimationType.Rainbow]: (ctx, phase = 0, base = [1, 1, 1]) => buildColorTrack(ColorAnimationType.Rainbow, ctx, phase, base),
};

export const letterRegistry: Record<LetterAnimationType, (ctx: LetterContext) => ShapeLayer['ks']> = {
    [LetterAnimationType.None]: (ctx) => buildLetterTransform(LetterAnimationType.None, ctx),
    [LetterAnimationType.Vibrate]: (ctx) => buildLetterTransform(LetterAnimationType.Vibrate, ctx),
    [LetterAnimationType.TypingFall]: (ctx) => buildLetterTransform(LetterAnimationType.TypingFall, ctx),
    [LetterAnimationType.Wave]: (ctx) => buildLetterTransform(LetterAnimationType.Wave, ctx),
    [LetterAnimationType.ZigZag]: (ctx) => buildLetterTransform(LetterAnimationType.ZigZag, ctx),
    [LetterAnimationType.Rotate]: (ctx) => buildLetterTransform(LetterAnimationType.Rotate, ctx),
};

export const pathMorphRegistry: Record<
    PathMorphAnimationType,
    (bez: any, fontSize: number, duration: number, seed: number) => any[] | null
> = {
    [PathMorphAnimationType.None]: () => null,
    [PathMorphAnimationType.Warp]: (bez, fontSize, duration, seed) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.Warp, seed),
    [PathMorphAnimationType.WarpAiry]: (bez, fontSize, duration, seed) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.WarpAiry, seed),
    [PathMorphAnimationType.SkewPulse]: (bez, fontSize, duration, seed) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.SkewPulse, seed),
    [PathMorphAnimationType.SkewSwing]: (bez, fontSize, duration, seed) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.SkewSwing, seed),
};
