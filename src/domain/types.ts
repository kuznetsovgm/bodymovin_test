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

export enum BackgroundLayerType {
    Solid = 'solid',
    Frame = 'frame',
    Stripes = 'stripes',
    GlyphPattern = 'glyphPattern',
    TextLike = 'textLike',
}

export type BackgroundBase = {
    transformAnimations?: TransformAnimationDescriptor[];
    colorAnimations?: ColorAnimationDescriptor[];
    strokeAnimations?: ColorAnimationDescriptor[];
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>[];
    letterAnimations?: LetterAnimationDescriptor[];
};

export type BackgroundScaleRotateOpacity = {
    /** Масштаб фона (1 = исходный размер) */
    scale?: number;
    /** Поворот фона в градусах */
    rotationDeg?: number;
    /** Прозрачность (0..1) */
    opacity?: number;
    /** Смещение по X (px) */
    offsetX?: number;
    /** Смещение по Y (px) */
    offsetY?: number;
};

export type SolidBackgroundParams = BackgroundScaleRotateOpacity & {
    paddingFactor?: number;
    cornerRadius?: number;
    baseColor?: [number, number, number];
    strokeColor?: [number, number, number];
    strokeWidth?: number;
};

export type FrameBackgroundParams = BackgroundScaleRotateOpacity & {
    paddingFactor?: number;
    cornerRadius?: number;
    strokeColor?: [number, number, number];
    strokeWidth?: number;
};

export type StripesBackgroundParams = BackgroundScaleRotateOpacity & {
    count?: number;
    stripeHeightFactor?: number;
    gapFactor?: number;
    cornerRadius?: number;
    /** Смещение фазы цвета между полосами (0..1), по умолчанию 0.1 */
    colorPhaseStep?: number;
    baseColor?: [number, number, number];
    strokeColor?: [number, number, number];
    strokeWidth?: number;
};

export type GlyphPatternBackgroundParams = BackgroundScaleRotateOpacity & {
    paddingFactor?: number;
    cornerRadius?: number;
    gridColumns?: number;
    gridRows?: number;
    spacingXFactor?: number;
    spacingYFactor?: number;
    /** Сдвиг фазы цвета между буквами/плитками (0..1) */
    colorPhaseStep?: number;
    /** Будущее развитие: плотность, шаг сетки и т.п. */
};

export type TextLikeBackgroundParams = BackgroundScaleRotateOpacity & {
    paddingFactor?: number;
    cornerRadius?: number;
    /** Сдвиг фазы цвета между буквами (0..1) */
    colorPhaseStep?: number;
};

export type SolidBackgroundDescriptor = BackgroundBase & {
    type: BackgroundLayerType.Solid;
    params?: SolidBackgroundParams;
};

export type FrameBackgroundDescriptor = BackgroundBase & {
    type: BackgroundLayerType.Frame;
    params?: FrameBackgroundParams;
};

export type StripesBackgroundDescriptor = BackgroundBase & {
    type: BackgroundLayerType.Stripes;
    params?: StripesBackgroundParams;
};

export type GlyphPatternBackgroundDescriptor = BackgroundBase & {
    type: BackgroundLayerType.GlyphPattern;
    fontFile?: string;
    text?: string;
    params?: GlyphPatternBackgroundParams;
};

export type TextLikeBackgroundDescriptor = BackgroundBase & {
    type: BackgroundLayerType.TextLike;
    fontFile?: string;
    text?: string;
    params?: TextLikeBackgroundParams;
};

export type BackgroundLayerDescriptor =
    | SolidBackgroundDescriptor
    | FrameBackgroundDescriptor
    | StripesBackgroundDescriptor
    | GlyphPatternBackgroundDescriptor
    | TextLikeBackgroundDescriptor;

export type KnockoutBackgroundMode = 'fill' | 'stroke';

export type KnockoutBackgroundOptions = {
    transformAnimations?: TransformAnimationDescriptor[];
    colorAnimations?: ColorAnimationDescriptor[];
    strokeAnimations?: ColorAnimationDescriptor[];
    pathMorphAnimations?: AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>[];
    letterAnimations?: LetterAnimationDescriptor[];
    /** 'fill' — вырез по заливке букв; 'stroke' — по контуру (пока ведёт себя как fill) */
    mode?: KnockoutBackgroundMode;
    /** Запас вокруг текста относительно его габаритов */
    paddingFactor?: number;
    /** Скругление углов фоновой плашки (0..1 от min(width,height)) */
    cornerRadiusFactor?: number;
    /** Масштаб плашки */
    scale?: number;
    /** Поворот плашки (deg) */
    rotationDeg?: number;
    /** Прозрачность 0..1 */
    opacity?: number;
    /** Смещение по X (px) */
    offsetX?: number;
    /** Смещение по Y (px) */
    offsetY?: number;
};

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
    backgroundLayers?: BackgroundLayerDescriptor[];
    knockoutBackground?: KnockoutBackgroundOptions;
    /** Имя файла шрифта (в директории fonts) */
    fontFile?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
    fontSize?: number;
    seed?: number;
}
