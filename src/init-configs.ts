import { stickerCache } from './cache';
import { StickerConfigManager } from './config-manager';
import {
    TransformAnimationType,
    ColorAnimationType,
    GenerateStickerOptions,
    LetterAnimationType,
    PathMorphAnimationType,
} from './index';

// Default sticker variants - same as the original STICKER_VARIANTS
const DEFAULT_STICKER_VARIANTS: Omit<GenerateStickerOptions, 'text'>[] = [
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        strokeAnimations: [{ type: ColorAnimationType.TransparencyPulse }],
        strokeColor: [1, 0.1, 0.1],
        strokeWidth: 3,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        pathMorphAnimations: [{ type: PathMorphAnimationType.WarpAiry }],
        fillColor: [1, 1, 1],
        strokeWidth: 1,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        fillColor: [0.5, 0.5, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [0, 0, 0],
        strokeColor: [1, 1, 1],
        strokeWidth: 4,
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        strokeAnimations: [{ type: ColorAnimationType.None }],
        fillColor: [0.08, 0.08, 0.08],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [0.9, 0.95, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [0.95, 0.95, 0.95],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [1, 0.9, 0.9],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Vibrate }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [0.85, 1, 0.85],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        fillColor: [0, 0.7, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
        fillColor: [0.2, 0.2, 0.2],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [0.95, 0.9, 0.8],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        fillColor: [0.96, 0.96, 0.96],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        fillColor: [1, 0.9, 0.6],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [0.9, 1, 0.9],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        fillColor: [0.9, 0.9, 1],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeWidth: 2,
        strokeColor: [0.2, 0.6, 1],
        fillColor: [0.1, 0.1, 0.1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        fillColor: [0.9, 0.85, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        fillColor: [0.8, 0.95, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Pulse }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        strokeAnimations: [{ type: ColorAnimationType.Pulse }],
        strokeWidth: 2,
        strokeColor: [0, 0.5, 1],
        fillColor: [0.95, 0.95, 0.95],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        fillColor: [1, 1, 1],
    },
    {
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.None }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [{ type: ColorAnimationType.Rainbow }],
        strokeWidth: 2,
        strokeColor: [1, 1, 1],
        fillColor: [0.06, 0.06, 0.06],
    },
];

async function initializeConfigs() {
    console.log('🚀 Initializing sticker configurations in Redis...');

    const stickerConfigManager = new StickerConfigManager(stickerCache.getRedis());

    try {
        const configIds = await stickerConfigManager.saveConfigs(
            DEFAULT_STICKER_VARIANTS,
            true // Enable all by default
        );

        console.log(`✅ Successfully initialized ${configIds.length} sticker configurations`);
        console.log('\nConfiguration IDs:');
        configIds.forEach((id, index) => {
            console.log(`  ${index + 1}. ${id}`);
        });

        const enabledCount = await stickerConfigManager.getEnabledCount();
        console.log(`\n📊 Total enabled configurations: ${enabledCount}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing configurations:', error);
        process.exit(1);
    }
}

// Run initialization
initializeConfigs();
