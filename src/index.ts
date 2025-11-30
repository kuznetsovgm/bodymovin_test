export {
    TransformAnimationType,
    ColorAnimationType,
    LetterAnimationType,
    PathMorphAnimationType,
    TransformAnimationDescriptor,
    ColorAnimationDescriptor,
    LetterAnimationDescriptor,
    GenerateStickerOptions,
    BackgroundLayerType,
    KnockoutBackgroundMode,
} from './domain/types';

export { applyDefaults } from './domain/defaults';
export { generateSticker, generateTextSticker, saveStickerToFile, stickerToBuffer } from './pipeline/generateSticker';
export { blendLayerTransform } from './animations/transform';
export {
    transformAnimationConfig,
    colorAnimationConfig,
    letterAnimationConfig,
    pathMorphAnimationConfig,
    fontAnimationConfig,
} from './config/animation-config';
