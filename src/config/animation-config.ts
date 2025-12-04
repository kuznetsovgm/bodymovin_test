import {
    TransformAnimationType,
    ColorAnimationType,
    LetterAnimationType,
    PathMorphAnimationType,
} from '../domain/types';

// ---------- Transform animations ----------

export type TransformAnimationConfig = {
    [TransformAnimationType.None]: {};
    [TransformAnimationType.SlideLoop]: {
        /** Доля ширины кадра, на которую смещается центр по X */
        amplitudeXFactor: number;
    };
    [TransformAnimationType.ScalePulse]: {
        /** Начальное значение масштабирования (проценты) */
        minScale: number;
        /** Максимальное значение масштабирования (проценты) */
        maxScale: number;
    };
    [TransformAnimationType.RotateContinuous]: {
        fromAngle: number;
        toAngle: number;
    };
    [TransformAnimationType.ShakeLoop]: {
        steps: number;
        intensity: number;
    };
    [TransformAnimationType.Bounce]: {
        /** Доля высоты кадра для основного отскока */
        heightAmplitudeFactor: number;
        /** Множитель высоты для второго отскока */
        secondaryBounceFactor: number;
    };
    [TransformAnimationType.Vibrate]: {
        steps: number;
        intensity: number;
    };
};

export const transformAnimationConfig: TransformAnimationConfig = {
    [TransformAnimationType.None]: {},
    [TransformAnimationType.SlideLoop]: {
        amplitudeXFactor: 0.25,
    },
    [TransformAnimationType.ScalePulse]: {
        minScale: 90,
        maxScale: 120,
    },
    [TransformAnimationType.RotateContinuous]: {
        fromAngle: 0,
        toAngle: 360,
    },
    [TransformAnimationType.ShakeLoop]: {
        steps: 16,
        intensity: 20,
    },
    [TransformAnimationType.Bounce]: {
        heightAmplitudeFactor: 0.08,
        secondaryBounceFactor: 0.5,
    },
    [TransformAnimationType.Vibrate]: {
        steps: 30,
        intensity: 4,
    },
};

// ---------- Color animations ----------

export type ColorKeyframeTrackConfig = {
    /** Цвета в формате [r,g,b,a] в диапазоне 0..1 */
    colors: [number, number, number, number][];
    /** Нормализованные времена ключевых кадров (0..1) такой же длины, как colors */
    times: number[];
    /** Зацикливать ли анимацию */
    loop: boolean;
};

export type NoneColorConfig = {
    /** Зацикливать ли статичный цвет (обычно false) */
    loop: boolean;
};

export type ColorAnimationConfig = {
    [ColorAnimationType.None]: NoneColorConfig;
    [ColorAnimationType.CycleRGB]: ColorKeyframeTrackConfig;
    [ColorAnimationType.Rainbow]: ColorKeyframeTrackConfig;
};

export const colorAnimationConfig: ColorAnimationConfig = {
    [ColorAnimationType.None]: {
        loop: false,
    },
    [ColorAnimationType.CycleRGB]: {
        colors: [
            [1, 0, 0, 1],
            [0, 1, 0, 1],
            [0, 0, 1, 1],
            [1, 0, 0, 1],
        ],
        times: [0, 1 / 3, 2 / 3, 1],
        loop: true,
    },
    [ColorAnimationType.Rainbow]: {
        colors: [
            [1, 0, 0, 1],
            [1, 0.5, 0, 1],
            [1, 1, 0, 1],
            [0, 1, 0, 1],
            [0, 0.5, 1, 1],
            [0, 0, 1, 1],
            [0.5, 0, 1, 1],
            [1, 0, 0.5, 1],
            [1, 0, 0, 1],
        ],
        times: [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8, 1],
        loop: true,
    },
};

// ---------- Letter animations ----------

export type LetterVibrateConfig = {
    intensity: number;
    steps: number;
};

export type LetterTypingFallConfig = {
    /** Доля длительности на смещение старта по индексу буквы (delay = index * duration * factor) */
    delayPerLetterFactor: number;
    /** Доля общей длительности на "падение" буквы */
    fallDurationFactor: number;
    /** На сколько высот канвы поднимать стартовую позицию (y - canvasHeight * factor) */
    startYOffsetFactor: number;
};

export type LetterWaveConfig = {
    amplitude: number;
    steps: number;
    phasePerLetter: number;
};

export type LetterZigZagConfig = {
    spread: number;
    steps: number;
    phasePerLetter: number;
    baseScale: number;
};

export type LetterRotateConfig = {
    fromAngle: number;
    toAngle: number;
    loop: boolean;
};

export type LetterAnimationConfig = {
    [LetterAnimationType.None]: {};
    [LetterAnimationType.Vibrate]: LetterVibrateConfig;
    [LetterAnimationType.TypingFall]: LetterTypingFallConfig;
    [LetterAnimationType.Wave]: LetterWaveConfig;
    [LetterAnimationType.ZigZag]: LetterZigZagConfig;
    [LetterAnimationType.Rotate]: LetterRotateConfig;
};

export const letterAnimationConfig: LetterAnimationConfig = {
    [LetterAnimationType.None]: {},
    [LetterAnimationType.Vibrate]: {
        intensity: 2,
        steps: 30,
    },
    [LetterAnimationType.TypingFall]: {
        delayPerLetterFactor: 1 / 40,
        fallDurationFactor: 1 / 6,
        startYOffsetFactor: 1,
    },
    [LetterAnimationType.Wave]: {
        amplitude: 12,
        steps: 40,
        phasePerLetter: 0.4,
    },
    [LetterAnimationType.ZigZag]: {
        spread: 35,
        steps: 48,
        phasePerLetter: Math.PI,
        baseScale: 100,
    },
    [LetterAnimationType.Rotate]: {
        fromAngle: 0,
        toAngle: 360,
        loop: false,
    },
};

// ---------- Path morph animations ----------

export type PathMorphBaseConfig = {
    /** Коэффициент для расчёта интенсивности: intensity = fontSize * factor */
    intensityFactor: number;
};

export type PathMorphWarpConfig = PathMorphBaseConfig & {
    phases: number[];
};

export type PathMorphWarpAiryConfig = PathMorphBaseConfig & {
    phases: number[];
    lowFrequency: number;
    highFrequency: number;
    scaleFactor: number;
    rotationFactor: number;
};

export type PathMorphSkewPulseConfig = PathMorphBaseConfig & {
    skewNormDivisor: number;
    skewMin: number;
    skewMax: number;
    skewBase: number;
};

export type PathMorphSkewSwingConfig = PathMorphSkewPulseConfig & {
    swingAmplitudeScale: number;
};

export type PathMorphAnimationConfig = {
    [PathMorphAnimationType.None]: {};
    [PathMorphAnimationType.Warp]: PathMorphWarpConfig;
    [PathMorphAnimationType.WarpAiry]: PathMorphWarpAiryConfig;
    [PathMorphAnimationType.SkewPulse]: PathMorphSkewPulseConfig;
    [PathMorphAnimationType.SkewSwing]: PathMorphSkewSwingConfig;
};

const defaultIntensityFactor = 0.1;

export const pathMorphAnimationConfig: PathMorphAnimationConfig = {
    [PathMorphAnimationType.None]: {},
    [PathMorphAnimationType.Warp]: {
        intensityFactor: defaultIntensityFactor,
        phases: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
    },
    [PathMorphAnimationType.WarpAiry]: {
        intensityFactor: defaultIntensityFactor,
        phases: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
        lowFrequency: 0.35,
        highFrequency: 0.12,
        scaleFactor: 0.08,
        rotationFactor: 0.18,
    },
    [PathMorphAnimationType.SkewPulse]: {
        intensityFactor: defaultIntensityFactor,
        skewNormDivisor: 7.2,
        skewMin: 0.3,
        skewMax: 0.8,
        skewBase: 0.45,
    },
    [PathMorphAnimationType.SkewSwing]: {
        intensityFactor: defaultIntensityFactor,
        skewNormDivisor: 7.2,
        skewMin: 0.3,
        skewMax: 0.8,
        skewBase: 0.45,
        swingAmplitudeScale: 0.7,
    },
};

// ---------- Font & layout ----------

export const FRACTION_DIGITS = 2;

export type FontAnimationConfig = {
    /** Имя файла шрифта (в директории fonts) по умолчанию */
    defaultFontFile: string;
    /** Размер шрифта по умолчанию */
    defaultFontSize: number;
    /** Отступы для текста относительно ширины/высоты кадра */
    maxTextWidthFactor: number;
    maxTextHeightFactor: number;
    /** Директория, где лежат шрифты */
    fontDirectory: string;
};

export const fontAnimationConfig: FontAnimationConfig = {
    defaultFontFile: 'CyrillicRound.ttf',
    defaultFontSize: 72,
    maxTextWidthFactor: 0.85,
    maxTextHeightFactor: 0.85,
    fontDirectory: './fonts',
};