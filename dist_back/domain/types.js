"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundLayerType = exports.PathMorphAnimationType = exports.LetterAnimationType = exports.ColorAnimationType = exports.TransformAnimationType = void 0;
var TransformAnimationType;
(function (TransformAnimationType) {
    TransformAnimationType["None"] = "none";
    TransformAnimationType["SlideLoop"] = "slideLoop";
    TransformAnimationType["ScalePulse"] = "scalePulse";
    TransformAnimationType["RotateContinuous"] = "rotateContinuous";
    TransformAnimationType["ShakeLoop"] = "shakeLoop";
    TransformAnimationType["Bounce"] = "bounce";
    TransformAnimationType["Vibrate"] = "vibrate";
})(TransformAnimationType || (exports.TransformAnimationType = TransformAnimationType = {}));
var ColorAnimationType;
(function (ColorAnimationType) {
    ColorAnimationType["None"] = "none";
    ColorAnimationType["CycleRGB"] = "cycleRGB";
    ColorAnimationType["Rainbow"] = "rainbow";
})(ColorAnimationType || (exports.ColorAnimationType = ColorAnimationType = {}));
var LetterAnimationType;
(function (LetterAnimationType) {
    LetterAnimationType["None"] = "none";
    LetterAnimationType["Vibrate"] = "vibrate";
    LetterAnimationType["TypingFall"] = "typingFall";
    LetterAnimationType["Wave"] = "wave";
    LetterAnimationType["ZigZag"] = "zigzag";
    LetterAnimationType["Rotate"] = "rotate";
})(LetterAnimationType || (exports.LetterAnimationType = LetterAnimationType = {}));
var PathMorphAnimationType;
(function (PathMorphAnimationType) {
    PathMorphAnimationType["None"] = "none";
    PathMorphAnimationType["Warp"] = "warp";
    PathMorphAnimationType["WarpAiry"] = "warpAiry";
    PathMorphAnimationType["SkewPulse"] = "skewPulse";
    PathMorphAnimationType["SkewSwing"] = "skewSwing";
})(PathMorphAnimationType || (exports.PathMorphAnimationType = PathMorphAnimationType = {}));
var BackgroundLayerType;
(function (BackgroundLayerType) {
    BackgroundLayerType["Solid"] = "solid";
    BackgroundLayerType["Frame"] = "frame";
    BackgroundLayerType["Stripes"] = "stripes";
    BackgroundLayerType["GlyphPattern"] = "glyphPattern";
    BackgroundLayerType["TextLike"] = "textLike";
})(BackgroundLayerType || (exports.BackgroundLayerType = BackgroundLayerType = {}));
//# sourceMappingURL=types.js.map