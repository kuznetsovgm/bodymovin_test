import { Sticker } from '../interfaces/sticker';
import { ShapeLayer, TransformShape } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';

export { Sticker };

export enum TransformAnimationType {
    None = 'none',
    SlideLoop = 'slideLoop',
    ScalePulse = 'scalePulse',
    RotateContinuous = 'rotateContinuous',
    ShakeLoop = 'shakeLoop',
    Bounce = 'bounce',
    Vibrate = 'vibrate',
}

export enum ColorAnimationType {
    None = 'none',
    CycleRGB = 'cycleRGB',
    Pulse = 'pulse',
    Rainbow = 'rainbow',
}

export enum LetterAnimationType {
    None = 'none',
    Vibrate = 'vibrate',
    TypingFall = 'typingFall',
    Wave = 'wave',
    ZigZag = 'zigzag',
    Rotate = 'rotate',
}

export enum PathMorphAnimationType {
    None = 'none',
    Warp = 'warp',
    WarpAiry = 'warpAiry',
    SkewPulse = 'skewPulse',
    SkewSwing = 'skewSwing',
}

export type ComposeFn<TPatch, TCtx = any> = (base: TPatch, next: TPatch, ctx: TCtx) => TPatch;

export type AnimationWindow = { start: number; end: number };

export type AnimationDescriptor<TType, TParams = any, TPatch = any, TCtx = any> = {
    type: TType;
    params?: TParams;
    compose?: ComposeFn<TPatch, TCtx>;
    priority?: number;
    phase?: number;
    window?: AnimationWindow;
};

export type TransformContext = { width: number; height: number; duration: number };
export type LetterContext = {
    letterIndex: number;
    x: number;
    y: number;
    duration: number;
    canvasHeight: number;
};
export type ColorContext = { duration: number };

export interface GenerateStickerOptions {
    text: string;
    transformAnimations?: AnimationDescriptor<
        TransformAnimationType,
        any,
        ShapeLayer['ks'],
        TransformContext
    >[];
    letterAnimations?: AnimationDescriptor<
        LetterAnimationType,
        any,
        TransformShape,
        LetterContext
    >[];
    colorAnimations?: AnimationDescriptor<
        ColorAnimationType,
        any,
        Track<number[]>,
        ColorContext
    >[];
    strokeAnimations?: AnimationDescriptor<
        ColorAnimationType,
        any,
        Track<number[]>,
        ColorContext
    >[];
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType>[];
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
    fontSize?: number;
    fontPath?: string;
    seed?: number;
    strokeWidth?: number;
    strokeColor?: [number, number, number];
    fillColor?: [number, number, number];
}
