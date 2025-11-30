import {
    ColorAnimationType,
    GenerateStickerOptions,
    LetterAnimationType,
    PathMorphAnimationType,
    TransformAnimationType,
    BackgroundLayerDescriptor,
    KnockoutBackgroundOptions,
} from './types';
import { fontAnimationConfig } from '../config/animation-config';

export const DEFAULT_WIDTH = 512;
export const DEFAULT_HEIGHT = 512;
export const DEFAULT_FRAME_RATE = 60;
export const DEFAULT_DURATION = 180;
export const DEFAULT_FONT_FILE = fontAnimationConfig.defaultFontFile;
export const DEFAULT_SEED = 1;

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
        backgroundLayers,
        knockoutBackground,
        frameRate = DEFAULT_FRAME_RATE,
        duration = DEFAULT_DURATION,
        fontSize,
        fontFile = DEFAULT_FONT_FILE,
        seed = DEFAULT_SEED,
    } = opts;

    return {
        text: opts.text,
        transformAnimations,
        letterAnimations,
        colorAnimations,
        strokeAnimations,
        pathMorphAnimations,
        backgroundLayers: backgroundLayers as BackgroundLayerDescriptor[] | undefined,
        knockoutBackground: knockoutBackground as KnockoutBackgroundOptions | undefined,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        frameRate,
        duration,
        fontSize,
        fontFile,
        seed,
    };
}
