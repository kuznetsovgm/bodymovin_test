import { stickerCache } from './cache';
import { StickerConfigManager } from './config-manager';
import {
    TransformAnimationType,
    ColorAnimationType,
    GenerateStickerOptions,
    LetterAnimationType,
    PathMorphAnimationType,
} from './index';
import { DEFAULT_FONT_FILE } from './domain/defaults';

const BASE_STICKER_DEFAULTS: Partial<Omit<GenerateStickerOptions, 'text'>> = {
    fontFile: DEFAULT_FONT_FILE,
};

// Default sticker variants
const DEFAULT_STICKER_VARIANTS: Omit<GenerateStickerOptions, 'text'>[] = [
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        strokeAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [1, 0.1, 0.1],
                    strokeWidth: 3,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [0, 0, 0],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                },
            },
        ],
        pathMorphAnimations: [{ type: PathMorphAnimationType.WarpAiry }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.5, 0.5, 1],
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        strokeAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [1, 1, 1, 1],
                        [1, 1, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                    strokeWidth: 4,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.08, 0.08, 0.08],
                },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
        strokeAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [1, 1, 1, 1],
                        [1, 1, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        colorAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [0.9, 0.95, 1, 1],
                        [0.9, 0.95, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                },
            },
        ],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.95, 0.95] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
        colorAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [1, 1, 1, 1],
                        [1, 1, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: { baseColor: [1, 0.9, 0.9] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Vibrate }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.85, 1, 0.85] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: { baseColor: [0, 0.7, 1] },
            },
        ],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.2, 0.2, 0.2] },
            },
        ],
        strokeAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                    strokeWidth: 2,
                },
            },
        ],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [1, 1, 1, 1],
                        [1, 1, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.9, 0.8] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: { baseColor: [0.96, 0.96, 0.96] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [0.2, 0.2, 0.2],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [1, 0.9, 0.6] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.1, 0.1, 0.1] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Vibrate }],
        strokeAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.2, 0.6, 1],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.Bounce }],
        letterAnimations: [{ type: LetterAnimationType.Rotate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.TypingFall }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.95, 0.95] },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.ZigZag }],
        strokeAnimations: [
            {
                type: ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0, 0.5, 1],
                    strokeWidth: 2,
                },
            },
        ],
        pathMorphAnimations: [{ type: PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: ColorAnimationType.None,
                params: {
                    colors: [
                        [1, 1, 1, 1],
                        [1, 1, 1, 1],
                    ],
                    times: [0, 1],
                    loop: false,
                },
            },
        ],
        letterAnimations: [{ type: LetterAnimationType.Wave }],
        strokeAnimations: [
            {
                type: ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                    strokeWidth: 2,
                },
            },
        ],
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
