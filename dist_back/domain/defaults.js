"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDefaults = exports.DEFAULT_SEED = exports.DEFAULT_FONT_FILE = exports.DEFAULT_DURATION = exports.DEFAULT_FRAME_RATE = exports.DEFAULT_HEIGHT = exports.DEFAULT_WIDTH = void 0;
const types_1 = require("./types");
const animation_config_1 = require("../config/animation-config");
exports.DEFAULT_WIDTH = 512;
exports.DEFAULT_HEIGHT = 512;
exports.DEFAULT_FRAME_RATE = 60;
exports.DEFAULT_DURATION = 180;
exports.DEFAULT_FONT_FILE = animation_config_1.fontAnimationConfig.defaultFontFile;
exports.DEFAULT_SEED = 1;
function applyDefaults(opts) {
    if (!opts.text) {
        throw new Error('text is required');
    }
    const { transformAnimations = [{ type: types_1.TransformAnimationType.None }], letterAnimations = [{ type: types_1.LetterAnimationType.None }], colorAnimations = [{ type: types_1.ColorAnimationType.None }], strokeAnimations = [{ type: types_1.ColorAnimationType.None }], pathMorphAnimations = [{ type: types_1.PathMorphAnimationType.None }], backgroundLayers, knockoutBackground, frameRate = exports.DEFAULT_FRAME_RATE, duration = exports.DEFAULT_DURATION, fontSize, fontFile = exports.DEFAULT_FONT_FILE, seed = exports.DEFAULT_SEED, } = opts;
    return {
        text: opts.text,
        transformAnimations,
        letterAnimations,
        colorAnimations,
        strokeAnimations,
        pathMorphAnimations,
        backgroundLayers: backgroundLayers,
        knockoutBackground: knockoutBackground,
        width: exports.DEFAULT_WIDTH,
        height: exports.DEFAULT_HEIGHT,
        frameRate,
        duration,
        fontSize,
        fontFile,
        seed,
    };
}
exports.applyDefaults = applyDefaults;
//# sourceMappingURL=defaults.js.map