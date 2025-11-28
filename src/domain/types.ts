import { Sticker } from '../interfaces/sticker';
import { ShapeLayer, TransformShape } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';
import type {
    TransformAnimationConfig,
    ColorAnimationConfig,
    LetterAnimationConfig,
    PathMorphAnimationConfig,
} from '../config/animation-config';

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

// Contexts shared across specialised descriptors
export type TransformContext = { width: number; height: number; duration: number };
export type LetterContext = {
    letterIndex: number;
    x: number;
    y: number;
    duration: number;
    canvasHeight: number;
};
export type ColorContext = { duration: number };

// ---------- Strongly-typed params per animation type ----------

export type TransformAnimationParams<T extends TransformAnimationType = TransformAnimationType> =
    TransformAnimationConfig[T];

export type ColorAnimationParams<T extends ColorAnimationType = ColorAnimationType> =
    Partial<ColorAnimationConfig[T]> & {
        /** Базовый цвет для данной анимации */
        baseColor?: [number, number, number];
        /** Толщина обводки, если анимация применяется к stroke */
        strokeWidth?: number;
    };

export type LetterAnimationParams<T extends LetterAnimationType = LetterAnimationType> =
    LetterAnimationConfig[T];

export type PathMorphAnimationParams<T extends PathMorphAnimationType = PathMorphAnimationType> =
    PathMorphAnimationConfig[T];

// Specialised descriptors bound to enum -> params mapping

export type TransformAnimationDescriptor<
    T extends TransformAnimationType = TransformAnimationType,
> = AnimationDescriptor<T, TransformAnimationParams<T>, ShapeLayer['ks'], TransformContext>;

export type LetterAnimationDescriptor<
    T extends LetterAnimationType = LetterAnimationType,
> = AnimationDescriptor<T, LetterAnimationParams<T>, TransformShape, LetterContext>;

export type ColorAnimationDescriptor<
    T extends ColorAnimationType = ColorAnimationType,
> = AnimationDescriptor<T, ColorAnimationParams<T>, Track<number[]>, ColorContext>;

export interface GenerateStickerOptions {
    text: string;
    transformAnimations?: TransformAnimationDescriptor[];
    letterAnimations?: LetterAnimationDescriptor[];
    colorAnimations?: ColorAnimationDescriptor[];
    strokeAnimations?: ColorAnimationDescriptor[];
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>[];
    /** Имя файла шрифта (в директории fonts) */
    fontFile?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
    fontSize?: number;
    seed?: number;
}
