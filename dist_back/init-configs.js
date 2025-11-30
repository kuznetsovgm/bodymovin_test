"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("./cache");
const config_manager_1 = require("./config-manager");
const index_1 = require("./index");
const defaults_1 = require("./domain/defaults");
const BASE_STICKER_DEFAULTS = {
    fontFile: defaults_1.DEFAULT_FONT_FILE,
};
// Default sticker variants
const DEFAULT_STICKER_VARIANTS = [
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [1, 0.1, 0.1],
                    strokeWidth: 3,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ShakeLoop }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: {
                    baseColor: [0, 0, 0],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                },
            },
        ],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.WarpAiry }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.SlideLoop }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.5, 0.5, 1],
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.Bounce }],
        letterAnimations: [{ type: index_1.LetterAnimationType.TypingFall }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.08, 0.08, 0.08],
                },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.TypingFall }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        transformAnimations: [{ type: index_1.TransformAnimationType.Bounce }],
        letterAnimations: [{ type: index_1.LetterAnimationType.ZigZag }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.RotateContinuous }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.95, 0.95] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Rotate }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        transformAnimations: [{ type: index_1.TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.ZigZag }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.Bounce }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: { baseColor: [1, 0.9, 0.9] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.TypingFall }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.Vibrate }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.85, 1, 0.85] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: { baseColor: [0, 0.7, 1] },
            },
        ],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.2, 0.2, 0.2] },
            },
        ],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: {
                    baseColor: [1, 1, 1],
                    strokeWidth: 2,
                },
            },
        ],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.RotateContinuous }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [1, 1, 1] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.Bounce }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.9, 0.8] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Rotate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: { baseColor: [0.96, 0.96, 0.96] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
                params: {
                    baseColor: [0.2, 0.2, 0.2],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [1, 0.9, 0.6] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.SlideLoop }],
        colorAnimations: [{ type: index_1.ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: index_1.ColorAnimationType.CycleRGB }],
        letterAnimations: [{ type: index_1.LetterAnimationType.ZigZag }],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewSwing }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ShakeLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.1, 0.1, 0.1] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.Vibrate }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0.2, 0.6, 1],
                    strokeWidth: 2,
                },
            },
        ],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.Bounce }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Rotate }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [{ type: index_1.ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: index_1.LetterAnimationType.TypingFall }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.SlideLoop }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: { baseColor: [0.95, 0.95, 0.95] },
            },
        ],
        letterAnimations: [{ type: index_1.LetterAnimationType.ZigZag }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.CycleRGB,
                params: {
                    baseColor: [0, 0.5, 1],
                    strokeWidth: 2,
                },
            },
        ],
        pathMorphAnimations: [{ type: index_1.PathMorphAnimationType.SkewPulse }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.RotateContinuous }],
        colorAnimations: [{ type: index_1.ColorAnimationType.Rainbow }],
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
    },
    {
        ...BASE_STICKER_DEFAULTS,
        transformAnimations: [{ type: index_1.TransformAnimationType.ScalePulse }],
        colorAnimations: [
            {
                type: index_1.ColorAnimationType.None,
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
        letterAnimations: [{ type: index_1.LetterAnimationType.Wave }],
        strokeAnimations: [
            {
                type: index_1.ColorAnimationType.Rainbow,
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
    const stickerConfigManager = new config_manager_1.StickerConfigManager(cache_1.stickerCache.getRedis());
    try {
        const configIds = await stickerConfigManager.saveConfigs(DEFAULT_STICKER_VARIANTS, true // Enable all by default
        );
        console.log(`✅ Successfully initialized ${configIds.length} sticker configurations`);
        console.log('\nConfiguration IDs:');
        configIds.forEach((id, index) => {
            console.log(`  ${index + 1}. ${id}`);
        });
        const enabledCount = await stickerConfigManager.getEnabledCount();
        console.log(`\n📊 Total enabled configurations: ${enabledCount}`);
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error initializing configurations:', error);
        process.exit(1);
    }
}
// Run initialization
initializeConfigs();
//# sourceMappingURL=init-configs.js.map