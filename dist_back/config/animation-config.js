"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fontAnimationConfig = exports.pathMorphAnimationConfig = exports.letterAnimationConfig = exports.colorAnimationConfig = exports.transformAnimationConfig = void 0;
const types_1 = require("../domain/types");
exports.transformAnimationConfig = {
    [types_1.TransformAnimationType.None]: {},
    [types_1.TransformAnimationType.SlideLoop]: {
        amplitudeXFactor: 0.25,
    },
    [types_1.TransformAnimationType.ScalePulse]: {
        minScale: 90,
        maxScale: 120,
    },
    [types_1.TransformAnimationType.RotateContinuous]: {
        fromAngle: 0,
        toAngle: 360,
    },
    [types_1.TransformAnimationType.ShakeLoop]: {
        steps: 16,
        intensity: 20,
    },
    [types_1.TransformAnimationType.Bounce]: {
        heightAmplitudeFactor: 0.08,
        secondaryBounceFactor: 0.5,
    },
    [types_1.TransformAnimationType.Vibrate]: {
        steps: 30,
        intensity: 4,
    },
};
exports.colorAnimationConfig = {
    [types_1.ColorAnimationType.None]: {
        loop: false,
    },
    [types_1.ColorAnimationType.CycleRGB]: {
        colors: [
            [1, 0, 0, 1],
            [0, 1, 0, 1],
            [0, 0, 1, 1],
            [1, 0, 0, 1],
        ],
        times: [0, 1 / 3, 2 / 3, 1],
        loop: true,
    },
    [types_1.ColorAnimationType.Rainbow]: {
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
exports.letterAnimationConfig = {
    [types_1.LetterAnimationType.None]: {},
    [types_1.LetterAnimationType.Vibrate]: {
        intensity: 2,
        steps: 30,
    },
    [types_1.LetterAnimationType.TypingFall]: {
        delayPerLetterFactor: 1 / 40,
        fallDurationFactor: 1 / 6,
        startYOffsetFactor: 1,
    },
    [types_1.LetterAnimationType.Wave]: {
        amplitude: 12,
        steps: 40,
        phasePerLetter: 0.4,
    },
    [types_1.LetterAnimationType.ZigZag]: {
        spread: 35,
        steps: 48,
        phasePerLetter: Math.PI,
        baseScale: 100,
    },
    [types_1.LetterAnimationType.Rotate]: {
        fromAngle: 0,
        toAngle: 360,
        loop: false,
    },
};
const defaultIntensityFactor = 0.1;
exports.pathMorphAnimationConfig = {
    [types_1.PathMorphAnimationType.None]: {},
    [types_1.PathMorphAnimationType.Warp]: {
        intensityFactor: defaultIntensityFactor,
        phases: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
    },
    [types_1.PathMorphAnimationType.WarpAiry]: {
        intensityFactor: defaultIntensityFactor,
        phases: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3],
        lowFrequency: 0.35,
        highFrequency: 0.12,
        scaleFactor: 0.08,
        rotationFactor: 0.18,
    },
    [types_1.PathMorphAnimationType.SkewPulse]: {
        intensityFactor: defaultIntensityFactor,
        skewNormDivisor: 7.2,
        skewMin: 0.3,
        skewMax: 0.8,
        skewBase: 0.45,
    },
    [types_1.PathMorphAnimationType.SkewSwing]: {
        intensityFactor: defaultIntensityFactor,
        skewNormDivisor: 7.2,
        skewMin: 0.3,
        skewMax: 0.8,
        skewBase: 0.45,
        swingAmplitudeScale: 0.7,
    },
};
exports.fontAnimationConfig = {
    defaultFontFile: 'CyrillicRound.ttf',
    defaultFontSize: 72,
    maxTextWidthFactor: 0.85,
    maxTextHeightFactor: 0.85,
    fontDirectory: './fonts',
};
//# sourceMappingURL=animation-config.js.map