"use strict";
/**
 * https://github.com/marcusstenbeck/lottie-types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FontPathOrigin = exports.LineJoinType = exports.LineCapType = exports.FillRule = exports.ShapeType = exports.VerticalJustify = exports.TextJustify = exports.LayerType = exports.EffectType = exports.EffectValueType = exports.AutoOrientMode = exports.Layer3DMode = exports.MatteMode = exports.BlendMode = void 0;
var BlendMode;
(function (BlendMode) {
    BlendMode[BlendMode["Normal"] = 0] = "Normal";
    BlendMode[BlendMode["Multiply"] = 1] = "Multiply";
    BlendMode[BlendMode["Screen"] = 2] = "Screen";
    BlendMode[BlendMode["Overlay"] = 3] = "Overlay";
    BlendMode[BlendMode["Darken"] = 4] = "Darken";
    BlendMode[BlendMode["Lighten"] = 5] = "Lighten";
    BlendMode[BlendMode["ColorDodge"] = 6] = "ColorDodge";
    BlendMode[BlendMode["ColorBurn"] = 7] = "ColorBurn";
    BlendMode[BlendMode["HardLight"] = 8] = "HardLight";
    BlendMode[BlendMode["SoftLight"] = 9] = "SoftLight";
    BlendMode[BlendMode["Difference"] = 10] = "Difference";
    BlendMode[BlendMode["Exclusion"] = 11] = "Exclusion";
    BlendMode[BlendMode["Hue"] = 12] = "Hue";
    BlendMode[BlendMode["Saturation"] = 13] = "Saturation";
    BlendMode[BlendMode["Color"] = 14] = "Color";
    BlendMode[BlendMode["Luminosity"] = 15] = "Luminosity";
})(BlendMode || (exports.BlendMode = BlendMode = {}));
var MatteMode;
(function (MatteMode) {
    MatteMode[MatteMode["Normal"] = 0] = "Normal";
    MatteMode[MatteMode["Alpha"] = 1] = "Alpha";
    MatteMode[MatteMode["InvertedAlpha"] = 2] = "InvertedAlpha";
    MatteMode[MatteMode["Luma"] = 3] = "Luma";
    MatteMode[MatteMode["InvertedLuma"] = 4] = "InvertedLuma";
})(MatteMode || (exports.MatteMode = MatteMode = {}));
var Layer3DMode;
(function (Layer3DMode) {
    Layer3DMode[Layer3DMode["Off"] = 0] = "Off";
    Layer3DMode[Layer3DMode["On"] = 1] = "On";
})(Layer3DMode || (exports.Layer3DMode = Layer3DMode = {}));
var AutoOrientMode;
(function (AutoOrientMode) {
    AutoOrientMode[AutoOrientMode["Off"] = 0] = "Off";
    AutoOrientMode[AutoOrientMode["On"] = 1] = "On";
})(AutoOrientMode || (exports.AutoOrientMode = AutoOrientMode = {}));
var EffectValueType;
(function (EffectValueType) {
    EffectValueType[EffectValueType["Number"] = 0] = "Number";
    EffectValueType[EffectValueType["Color"] = 2] = "Color";
    EffectValueType[EffectValueType["MultiDimensional"] = 3] = "MultiDimensional";
    EffectValueType[EffectValueType["Boolean"] = 7] = "Boolean";
})(EffectValueType || (exports.EffectValueType = EffectValueType = {}));
var EffectType;
(function (EffectType) {
    EffectType[EffectType["Transform"] = 5] = "Transform";
    EffectType[EffectType["DropShadow"] = 25] = "DropShadow";
})(EffectType || (exports.EffectType = EffectType = {}));
var LayerType;
(function (LayerType) {
    LayerType[LayerType["precomp"] = 0] = "precomp";
    LayerType[LayerType["solid"] = 1] = "solid";
    LayerType[LayerType["still"] = 2] = "still";
    LayerType[LayerType["null"] = 3] = "null";
    LayerType[LayerType["shape"] = 4] = "shape";
    LayerType[LayerType["text"] = 5] = "text";
    LayerType[LayerType["audio"] = 6] = "audio";
    LayerType[LayerType["pholderVideo"] = 7] = "pholderVideo";
    LayerType[LayerType["imageSeq"] = 8] = "imageSeq";
    LayerType[LayerType["video"] = 9] = "video";
    LayerType[LayerType["pholderStill"] = 10] = "pholderStill";
    LayerType[LayerType["guide"] = 11] = "guide";
    LayerType[LayerType["adjustment"] = 12] = "adjustment";
    LayerType[LayerType["camera"] = 13] = "camera";
    LayerType[LayerType["light"] = 14] = "light";
})(LayerType || (exports.LayerType = LayerType = {}));
var TextJustify;
(function (TextJustify) {
    TextJustify[TextJustify["Left"] = 0] = "Left";
    TextJustify[TextJustify["Right"] = 1] = "Right";
    TextJustify[TextJustify["Center"] = 2] = "Center";
})(TextJustify || (exports.TextJustify = TextJustify = {}));
var VerticalJustify;
(function (VerticalJustify) {
    VerticalJustify[VerticalJustify["Top"] = 0] = "Top";
    VerticalJustify[VerticalJustify["Center"] = 1] = "Center";
    VerticalJustify[VerticalJustify["Bottom"] = 2] = "Bottom";
})(VerticalJustify || (exports.VerticalJustify = VerticalJustify = {}));
var ShapeType;
(function (ShapeType) {
    ShapeType["Group"] = "gr";
    ShapeType["Rect"] = "rc";
    ShapeType["Ellipse"] = "el";
    ShapeType["Fill"] = "fl";
    ShapeType["TransformShape"] = "tr";
    ShapeType["Path"] = "sh";
    ShapeType["Stroke"] = "st";
})(ShapeType || (exports.ShapeType = ShapeType = {}));
var FillRule;
(function (FillRule) {
    FillRule[FillRule["NonZero"] = 1] = "NonZero";
    FillRule[FillRule["EvenOdd"] = 2] = "EvenOdd";
})(FillRule || (exports.FillRule = FillRule = {}));
var LineCapType;
(function (LineCapType) {
    LineCapType[LineCapType["Butt"] = 1] = "Butt";
    LineCapType[LineCapType["Round"] = 2] = "Round";
    LineCapType[LineCapType["Square"] = 3] = "Square";
})(LineCapType || (exports.LineCapType = LineCapType = {}));
var LineJoinType;
(function (LineJoinType) {
    LineJoinType[LineJoinType["Miter"] = 1] = "Miter";
    LineJoinType[LineJoinType["Round"] = 2] = "Round";
    LineJoinType[LineJoinType["Bevel"] = 3] = "Bevel";
})(LineJoinType || (exports.LineJoinType = LineJoinType = {}));
var FontPathOrigin;
(function (FontPathOrigin) {
    FontPathOrigin[FontPathOrigin["CssUrl"] = 1] = "CssUrl";
    FontPathOrigin[FontPathOrigin["ScriptUrl"] = 2] = "ScriptUrl";
    FontPathOrigin[FontPathOrigin["FontUrl"] = 3] = "FontUrl";
})(FontPathOrigin || (exports.FontPathOrigin = FontPathOrigin = {}));
//# sourceMappingURL=lottie.js.map