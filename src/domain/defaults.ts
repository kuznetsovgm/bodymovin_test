import path from 'path';

import {
    ColorAnimationType,
    GenerateStickerOptions,
    LetterAnimationType,
    PathMorphAnimationType,
    TransformAnimationType,
} from './types';

export const DEFAULT_WIDTH = 512;
export const DEFAULT_HEIGHT = 512;
export const DEFAULT_FRAME_RATE = 60;
export const DEFAULT_DURATION = 180;
export const DEFAULT_FONT_SIZE = 72;
export const DEFAULT_FONT_FILE = 'CyrillicRound.ttf';
export const DEFAULT_FONT_PATH = path.resolve(`./fonts/${DEFAULT_FONT_FILE}`);
export const DEFAULT_SEED = 1;
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_STROKE_COLOR: [number, number, number] = [0, 0, 0];

export function applyDefaults(opts: Partial<GenerateStickerOptions>): GenerateStickerOptions {
    if (!opts.text) {
        throw new Error('text is required');
    }
    const {
        transformAnimations = [{ type: TransformAnimationType.None }],
        letterAnimations = [{ type: LetterAnimationType.None }],
        colorAnimations = [{ type: ColorAnimationType.None }],
        strokeAnimations = [{ type: ColorAnimationType.None }],
        pathMorphAnimations = [{ type: PathMorphAnimationType.None }],
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
        frameRate = DEFAULT_FRAME_RATE,
        duration = DEFAULT_DURATION,
        fontSize = DEFAULT_FONT_SIZE,
        fontPath = DEFAULT_FONT_PATH,
        seed = DEFAULT_SEED,
        strokeWidth = DEFAULT_STROKE_WIDTH,
        strokeColor = DEFAULT_STROKE_COLOR,
        fillColor,
    } = opts;

    return {
        text: opts.text,
        transformAnimations,
        letterAnimations,
        colorAnimations,
        strokeAnimations,
        pathMorphAnimations,
        width,
        height,
        frameRate,
        duration,
        fontSize,
        fontPath,
        seed,
        strokeWidth,
        strokeColor,
        fillColor,
    };
}
