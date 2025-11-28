import { AnimationDescriptor, ColorAnimationType, LetterAnimationType, PathMorphAnimationType, TransformAnimationType } from '../domain/types';
import { TransformPatch, buildTransformPatch } from './transform';
import { buildColorTrack, ColorContext } from './color';
import { buildLetterTransform, LetterContext } from './letter';
import { buildPathMorphKeyframes } from '../shapes/bezier';
import { ShapeLayer } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';

export const transformRegistry: Record<
    TransformAnimationType,
    (ctx: { width: number; height: number; duration: number }, params?: any) => TransformPatch
> = {
    [TransformAnimationType.None]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.None, ctx, params),
    [TransformAnimationType.SlideLoop]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.SlideLoop, ctx, params),
    [TransformAnimationType.ScalePulse]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.ScalePulse, ctx, params),
    [TransformAnimationType.RotateContinuous]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.RotateContinuous, ctx, params),
    [TransformAnimationType.ShakeLoop]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.ShakeLoop, ctx, params),
    [TransformAnimationType.Bounce]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.Bounce, ctx, params),
    [TransformAnimationType.Vibrate]: (ctx, params) =>
        buildTransformPatch(TransformAnimationType.Vibrate, ctx, params),
};

export const colorRegistry: Record<
    ColorAnimationType,
    (ctx: ColorContext, phase?: number, baseColor?: [number, number, number], params?: any) => Track<number[]>
> = {
    [ColorAnimationType.None]: (ctx, _phase = 0, base = [1, 1, 1], params) =>
        buildColorTrack(ColorAnimationType.None, ctx, _phase, base, params),
    [ColorAnimationType.CycleRGB]: (ctx, phase = 0, base = [1, 1, 1], params) =>
        buildColorTrack(ColorAnimationType.CycleRGB, ctx, phase, base, params),
    [ColorAnimationType.Rainbow]: (ctx, phase = 0, base = [1, 1, 1], params) =>
        buildColorTrack(ColorAnimationType.Rainbow, ctx, phase, base, params),
};

export const letterRegistry: Record<LetterAnimationType, (ctx: LetterContext, params?: any) => ShapeLayer['ks']> = {
    [LetterAnimationType.None]: (ctx, params) => buildLetterTransform(LetterAnimationType.None, ctx, params),
    [LetterAnimationType.Vibrate]: (ctx, params) => buildLetterTransform(LetterAnimationType.Vibrate, ctx, params),
    [LetterAnimationType.TypingFall]: (ctx, params) =>
        buildLetterTransform(LetterAnimationType.TypingFall, ctx, params),
    [LetterAnimationType.Wave]: (ctx, params) => buildLetterTransform(LetterAnimationType.Wave, ctx, params),
    [LetterAnimationType.ZigZag]: (ctx, params) => buildLetterTransform(LetterAnimationType.ZigZag, ctx, params),
    [LetterAnimationType.Rotate]: (ctx, params) => buildLetterTransform(LetterAnimationType.Rotate, ctx, params),
};

export const pathMorphRegistry: Record<
    PathMorphAnimationType,
    (bez: any, fontSize: number, duration: number, seed: number, params?: any) => any[] | null
> = {
    [PathMorphAnimationType.None]: () => null,
    [PathMorphAnimationType.Warp]: (bez, fontSize, duration, seed, params) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.Warp, seed, params),
    [PathMorphAnimationType.WarpAiry]: (bez, fontSize, duration, seed, params) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.WarpAiry, seed, params),
    [PathMorphAnimationType.SkewPulse]: (bez, fontSize, duration, seed, params) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.SkewPulse, seed, params),
    [PathMorphAnimationType.SkewSwing]: (bez, fontSize, duration, seed, params) =>
        buildPathMorphKeyframes(bez, fontSize, duration, PathMorphAnimationType.SkewSwing, seed, params),
};
