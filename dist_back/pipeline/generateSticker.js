"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stickerToBuffer = exports.saveStickerToFile = exports.generateTextSticker = exports.generateSticker = void 0;
const path = __importStar(require("path"));
const defaults_1 = require("../domain/defaults");
const types_1 = require("../domain/types");
const fs_1 = require("../shared/fs");
const wrap_1 = require("../layout/wrap");
const fontLoader_1 = require("../layout/fontLoader");
const layoutText_1 = require("../layout/layoutText");
const glyphToShapes_1 = require("../shapes/glyphToShapes");
const fontSupport_1 = require("../layout/fontSupport");
const letter_1 = require("../animations/letter");
const apply_1 = require("../style/apply");
const composers_1 = require("../animations/composers");
const lottie_1 = require("../interfaces/lottie");
const registry_1 = require("../animations/registry");
const pathMorph_1 = require("../animations/pathMorph");
const animation_config_1 = require("../config/animation-config");
const types_2 = require("../domain/types");
const bezier_1 = require("../shapes/bezier");
const noise_1 = require("../shared/noise");
async function generateSticker(opts) {
    const cfg = (0, defaults_1.applyDefaults)(opts);
    return generateTextSticker(cfg);
}
exports.generateSticker = generateSticker;
async function generateTextSticker(opts) {
    const { text, backgroundLayers, knockoutBackground, transformAnimations, colorAnimations, strokeAnimations, letterAnimations, pathMorphAnimations, fontSize, fontFile = defaults_1.DEFAULT_FONT_FILE, width = defaults_1.DEFAULT_WIDTH, height = defaults_1.DEFAULT_HEIGHT, frameRate = defaults_1.DEFAULT_FRAME_RATE, duration = defaults_1.DEFAULT_DURATION, seed = defaults_1.DEFAULT_SEED, } = opts;
    const resolvedFontSize = resolveFontSize(text, fontSize, width, height);
    const fontPath = path.resolve(animation_config_1.fontAnimationConfig.fontDirectory, fontFile);
    const fontObj = await (0, fontLoader_1.loadFont)(fontPath);
    // Проверяем, что шрифт поддерживает все необходимые символы текста
    (0, fontSupport_1.ensureFontSupportsText)(fontObj, text);
    const { finalFontSize, layout } = prepareLayout(text, fontObj, resolvedFontSize, width, height);
    const backgroundShapeLayers = buildBackgroundLayers(layout, finalFontSize, backgroundLayers, fontObj, {
        width,
        height,
        duration,
        seed,
    });
    const knockoutLayer = buildKnockoutBackgroundLayer(layout, finalFontSize, knockoutBackground, fontObj, {
        width,
        height,
        duration,
        seed,
    }, backgroundShapeLayers.length + 1);
    const textLayerIndex = backgroundShapeLayers.length + (knockoutLayer ? 1 : 0) + 1;
    const layer = buildBaseLayer(width, height, duration, 'Text Layer', textLayerIndex);
    layer.ks = (0, composers_1.applyTransformsWithCompose)(transformAnimations, layer.ks, {
        width,
        height,
        duration,
    }, registry_1.transformRegistry);
    const lettersGroup = buildLettersGroup(layout, finalFontSize, colorAnimations, strokeAnimations, duration, letterAnimations, pathMorphAnimations, height, seed);
    layer.shapes.push(lettersGroup);
    const layers = [...backgroundShapeLayers];
    if (knockoutLayer)
        layers.push(knockoutLayer);
    layers.push(layer);
    const sticker = buildStickerShell(text, width, height, frameRate, duration, layers);
    return sticker;
}
exports.generateTextSticker = generateTextSticker;
async function saveStickerToFile(sticker, outPath) {
    await (0, fs_1.writeJsonGz)(sticker, outPath);
}
exports.saveStickerToFile = saveStickerToFile;
async function stickerToBuffer(sticker) {
    return await (0, fs_1.jsonToGzBuffer)(sticker);
}
exports.stickerToBuffer = stickerToBuffer;
function buildBaseLayer(width, height, duration, name, ind) {
    const layer = {
        ddd: 0,
        ind,
        ty: 4,
        nm: name,
        sr: 1,
        ks: {
            p: { a: 0, k: [width / 2, height / 2, 0] },
            a: { a: 0, k: [0, 0] },
            s: { a: 0, k: [100, 100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
        },
        ao: 0,
        shapes: [],
        ip: 0,
        op: duration,
        st: 0,
        bm: 0,
    };
    return layer;
}
function buildLettersGroup(layout, fontSize, colorAnimations, strokeAnimations, duration, letterAnimations, pathMorphAnimations, canvasHeight, seed) {
    const totalLetters = layout.length || 1;
    const group = {
        ty: lottie_1.ShapeType.Group,
        cix: 1,
        np: 1,
        it: [],
        nm: 'letters',
        bm: 0,
        hd: false,
    };
    // Layer-level style (applied once per group)
    for (const glyphInfo of layout) {
        const { char: ch, glyph, x, y, letterIndex } = glyphInfo;
        const pathShapes = (0, glyphToShapes_1.glyphToShapes)(glyph, ch, letterIndex, {
            fontSize,
            duration,
            pathMorphAnimation: pickType(pathMorphAnimations, types_1.PathMorphAnimationType.None),
            pathMorphAnimations,
            seed,
        });
        const transform = (0, letter_1.applyLetterAnimations)(letterAnimations, {
            letterIndex,
            x,
            y,
            duration,
            canvasHeight,
        });
        const items = [...pathShapes];
        const phase = (totalLetters - 1 - letterIndex) / totalLetters;
        const styles = (0, apply_1.buildLetterStyles)(colorAnimations, strokeAnimations, {
            duration,
            letterPhase: phase,
            letterIndex,
        });
        if (styles.fill)
            items.push(styles.fill);
        if (styles.stroke)
            items.push(styles.stroke);
        items.push(transform);
        group.it.push({
            ty: lottie_1.ShapeType.Group,
            cix: 300 + letterIndex,
            it: items,
            nm: `letter_${letterIndex}`,
            bm: 0,
            hd: false,
        });
    }
    return group;
}
function pickType(descs, fallback) {
    if (!descs || descs.length === 0)
        return fallback;
    const sorted = [...descs].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return sorted[0].type;
}
function prepareLayout(text, font, fontSize, width, height) {
    const { lines, finalFontSize } = (0, wrap_1.wrapAndScaleText)(text, font, fontSize, width * animation_config_1.fontAnimationConfig.maxTextWidthFactor, height * animation_config_1.fontAnimationConfig.maxTextHeightFactor);
    const layout = (0, layoutText_1.layoutText)(lines, font, finalFontSize);
    return { finalFontSize, layout };
}
function resolveFontSize(text, requestedFontSize, width, height) {
    if (typeof requestedFontSize === 'number' && requestedFontSize > 0) {
        return requestedFontSize;
    }
    return computeAutoFontSize(text, width, height);
}
function computeAutoFontSize(text, width, height) {
    const trimmed = text.trim();
    if (!trimmed) {
        return Math.min(height, width) * 0.5;
    }
    const lettersOnly = trimmed.replace(/\s+/g, '');
    const whitespaceCount = trimmed.length - lettersOnly.length;
    const effectiveGlyphs = Math.max(1, lettersOnly.length + whitespaceCount * 0.4);
    const availableWidth = width * animation_config_1.fontAnimationConfig.maxTextWidthFactor;
    const availableHeight = height * animation_config_1.fontAnimationConfig.maxTextHeightFactor;
    const targetArea = availableWidth * availableHeight * 0.85;
    const estimated = Math.sqrt(targetArea / effectiveGlyphs);
    const minSize = 32;
    const maxSize = availableHeight;
    return clamp(estimated, minSize, maxSize);
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function buildStickerShell(text, width, height, frameRate, duration, layers) {
    return {
        tgs: 1,
        v: '5.5.2',
        fr: frameRate,
        ip: 0,
        op: duration,
        w: width,
        h: height,
        nm: `Text: ${text}`,
        ddd: 0,
        assets: [],
        layers,
    };
}
function buildBackgroundLayers(layout, fontSize, descs, font, ctx) {
    if (!descs || !descs.length)
        return [];
    const layers = [];
    let layerIndex = 1;
    for (const desc of descs) {
        const layer = buildBaseLayer(ctx.width, ctx.height, ctx.duration, `Background:${desc.type}`, layerIndex++);
        layer.ks = (0, composers_1.applyTransformsWithCompose)(desc.transformAnimations, layer.ks, { width: ctx.width, height: ctx.height, duration: ctx.duration }, registry_1.transformRegistry);
        const group = {
            ty: lottie_1.ShapeType.Group,
            cix: 1000,
            it: [],
            np: 1,
            nm: `bg_${desc.type}`,
            bm: 0,
            hd: false,
        };
        const shapes = buildBackgroundShapes(desc, layout, fontSize, font, ctx);
        if (shapes.length === 0)
            continue;
        group.it.push(...shapes);
        group.np = group.it.length;
        layer.shapes.push(group);
        layers.push(layer);
    }
    return layers;
}
function buildBackgroundShapes(desc, layout, fontSize, font, ctx) {
    switch (desc.type) {
        case types_2.BackgroundLayerType.Solid:
            return buildSolidBackground(desc, ctx);
        case types_2.BackgroundLayerType.Frame:
            return buildFrameBackground(desc, ctx);
        case types_2.BackgroundLayerType.Stripes:
            return buildStripesBackground(desc, ctx);
        case types_2.BackgroundLayerType.GlyphPattern:
        case types_2.BackgroundLayerType.TextLike:
        default:
            // Пока не реализовано — пропускаем
            return [];
    }
}
function buildSolidBackground(desc, ctx) {
    const padding = Math.max(0, Math.min(0.5, desc.params?.paddingFactor ?? 0));
    const cornerRadius = Math.max(0, desc.params?.cornerRadius ?? 0);
    const width = ctx.width * (1 + padding * 2);
    const height = ctx.height * (1 + padding * 2);
    const rect = createRectShape(width, height, cornerRadius, 10);
    const fill = buildFillFromAnimations(desc.colorAnimations, ctx.duration, 20);
    const stroke = buildStrokeFromAnimations(desc.strokeAnimations, ctx.duration, 30);
    return [rect, ...(fill ? [fill] : []), ...(stroke ? [stroke] : [])];
}
function buildFrameBackground(desc, ctx) {
    const padding = Math.max(0, Math.min(0.5, desc.params?.paddingFactor ?? 0.05));
    const cornerRadius = Math.max(0, desc.params?.cornerRadius ?? 0);
    const width = ctx.width * (1 + padding * 2);
    const height = ctx.height * (1 + padding * 2);
    const rect = createRectShape(width, height, cornerRadius, 40);
    const stroke = buildStrokeFromAnimations(desc.strokeAnimations, ctx.duration, 50);
    // Рамка: заливку не рисуем
    return [rect, ...(stroke ? [stroke] : [])];
}
function buildStripesBackground(desc, ctx) {
    const stripes = Math.max(1, Math.min(20, desc.params?.count ?? 5));
    const stripeHeightFactor = Math.max(0.01, Math.min(1, desc.params?.stripeHeightFactor ?? 0.1));
    const gapFactor = Math.max(0, Math.min(1, desc.params?.gapFactor ?? 0.05));
    const shapes = [];
    const totalHeight = ctx.height * (1 + gapFactor * 2);
    const stripeHeight = ctx.height * stripeHeightFactor;
    const usableHeight = totalHeight - stripeHeight;
    for (let i = 0; i < stripes; i++) {
        const y = -usableHeight / 2 + (usableHeight / Math.max(1, stripes - 1)) * i;
        const rect = {
            ty: lottie_1.ShapeType.Rect,
            d: 1,
            s: { a: 0, k: [ctx.width, stripeHeight], ix: 2 },
            p: { a: 0, k: [0, y], ix: 3 },
            r: { a: 0, k: desc.params?.cornerRadius ?? 0, ix: 4 },
            cix: 60 + i,
            bm: 0,
            nm: `stripe_${i}`,
            hd: false,
        };
        shapes.push(rect);
    }
    const fill = buildFillFromAnimations(desc.colorAnimations, ctx.duration, 80);
    const stroke = buildStrokeFromAnimations(desc.strokeAnimations, ctx.duration, 90);
    return [...shapes, ...(fill ? [fill] : []), ...(stroke ? [stroke] : [])];
}
// ---------------- Knockout background (дырка) ----------------
function buildKnockoutBackgroundLayer(layout, fontSize, opts, font, ctx, layerIndex) {
    if (!opts)
        return null;
    const paddingFactor = Math.max(0, Math.min(0.5, opts.paddingFactor ?? 0.05));
    const cornerRadiusFactor = Math.max(0, Math.min(1, opts.cornerRadiusFactor ?? 0));
    const layer = buildBaseLayer(ctx.width, ctx.height, ctx.duration, 'Knockout Background', layerIndex);
    layer.ks = (0, composers_1.applyTransformsWithCompose)(opts.transformAnimations, layer.ks, { width: ctx.width, height: ctx.height, duration: ctx.duration }, registry_1.transformRegistry);
    const bounds = computeLayoutBounds(layout, fontSize, font);
    const textWidth = Math.max(1, bounds.maxX - bounds.minX);
    const textHeight = Math.max(1, bounds.maxY - bounds.minY);
    const paddedWidth = textWidth * (1 + paddingFactor * 2);
    const paddedHeight = textHeight * (1 + paddingFactor * 2);
    const cornerRadius = Math.min(paddedWidth, paddedHeight) * cornerRadiusFactor;
    const outerPath = {
        ty: lottie_1.ShapeType.Path,
        ind: 1,
        hd: false,
        nm: 'knockout_outer',
        cix: 200,
        bm: 0,
        ks: { a: 0, k: buildRectBezier(paddedWidth, paddedHeight), ix: 0 },
    };
    const letterPaths = layout.flatMap((glyphInfo, idx) => {
        const path = glyphInfo.glyph.getPath(glyphInfo.x, glyphInfo.y, fontSize);
        const beziers = (0, bezier_1.convertOpentypePathToBezier)(path);
        if (!beziers || beziers.length === 0)
            return [];
        const morphDescs = opts.pathMorphAnimations && opts.pathMorphAnimations.length
            ? opts.pathMorphAnimations
            : [{ type: types_1.PathMorphAnimationType.None }];
        return beziers.map((bez, contourIdx) => {
            const morphSeed = (0, noise_1.buildLetterSeed)(idx, glyphInfo.char.codePointAt(0) ?? 0, ctx.seed) + contourIdx * 0.1;
            const morphKf = morphDescs && morphDescs.length
                ? (0, pathMorph_1.applyPathMorphAnimations)(bez, morphDescs, {
                    fontSize,
                    duration: ctx.duration,
                    seed: morphSeed,
                })
                : null;
            const pathShape = {
                ty: lottie_1.ShapeType.Path,
                ind: 1000 + idx * 10 + contourIdx,
                hd: false,
                nm: `knockout_letter_${idx}_contour_${contourIdx}`,
                cix: 300 + idx * 10 + contourIdx,
                bm: 0,
                ks: morphKf ? { a: 1, k: morphKf, ix: 0 } : { a: 0, k: bez, ix: 0 },
            };
            return pathShape;
        });
    });
    const shapes = [outerPath, ...letterPaths];
    const fill = buildFillFromAnimations(opts.colorAnimations, ctx.duration, 400, lottie_1.FillRule.EvenOdd);
    const stroke = buildStrokeFromAnimations(opts.strokeAnimations, ctx.duration, 410);
    if (fill)
        shapes.push(fill);
    if (stroke)
        shapes.push(stroke);
    const group = {
        ty: lottie_1.ShapeType.Group,
        cix: 1500,
        it: shapes,
        np: shapes.length,
        nm: 'knockout_group',
        bm: 0,
        hd: false,
    };
    layer.shapes.push(group);
    return layer;
}
function computeLayoutBounds(layout, fontSize, font) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const scale = fontSize / font.unitsPerEm;
    for (const g of layout) {
        const bbox = g.glyph.getBoundingBox();
        const gx1 = g.x + bbox.x1 * scale;
        const gx2 = g.x + bbox.x2 * scale;
        const gy1 = g.y + bbox.y1 * scale;
        const gy2 = g.y + bbox.y2 * scale;
        minX = Math.min(minX, gx1);
        maxX = Math.max(maxX, gx2);
        minY = Math.min(minY, gy1);
        maxY = Math.max(maxY, gy2);
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        minX = -fontSize;
        maxX = fontSize;
        minY = -fontSize;
        maxY = fontSize;
    }
    return { minX, minY, maxX, maxY };
}
// ---------------- Shared shape builders ----------------
function buildRectBezier(width, height) {
    const hw = width / 2;
    const hh = height / 2;
    const v = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
    ];
    const zeros = Array.from({ length: 4 }, () => [0, 0]);
    return { c: true, i: zeros, o: zeros, v };
}
function createRectShape(width, height, cornerRadius, cix) {
    return {
        ty: lottie_1.ShapeType.Rect,
        d: 1,
        s: { a: 0, k: [width, height], ix: 2 },
        p: { a: 0, k: [0, 0], ix: 3 },
        r: { a: 0, k: cornerRadius, ix: 4 },
        cix,
        bm: 0,
        nm: 'Rect',
        hd: false,
    };
}
function buildFillFromAnimations(animations, duration, cix, fillRule = lottie_1.FillRule.NonZero) {
    const baseColor = resolveBaseColor(animations);
    if (!baseColor)
        return null;
    const track = (0, composers_1.applyColorsWithCompose)(animations, baseColor, { duration }, 0, registry_1.colorRegistry);
    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: lottie_1.ShapeType.Fill,
        c: { a: animated, k: colorTrack.k, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k } : { a: 0, k: 100 },
        r: fillRule,
        bm: 0,
        nm: 'Fill',
        hd: false,
    };
}
function buildStrokeFromAnimations(animations, duration, cix) {
    if (!animations || !animations.length)
        return null;
    const strokeStyle = resolveStrokeStyle(animations);
    if (!strokeStyle)
        return null;
    const track = (0, composers_1.applyColorsWithCompose)(animations, strokeStyle.color, { duration }, 0, registry_1.colorRegistry);
    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: lottie_1.ShapeType.Stroke,
        c: { a: animated, k: colorTrack.k, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k } : { a: 0, k: 100 },
        w: { a: 0, k: strokeStyle.width },
        lc: 2,
        lj: 2,
        ml: 4,
        bm: 0,
        nm: 'Stroke',
        hd: false,
    };
}
function resolveBaseColor(animations, fallback) {
    if (animations && animations.length) {
        const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const desc of sorted) {
            const base = extractBaseColor(desc.params);
            if (base)
                return base;
        }
    }
    return fallback;
}
function resolveStrokeStyle(animations) {
    if (!animations || !animations.length)
        return null;
    const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const desc of sorted) {
        const params = desc.params;
        const color = extractBaseColor(params);
        const width = params?.strokeWidth;
        if (color && typeof width === 'number' && Number.isFinite(width)) {
            return { color, width };
        }
    }
    return null;
}
function extractBaseColor(params) {
    if (!params)
        return undefined;
    if (Array.isArray(params.colors) && params.colors.length) {
        const [r, g, b] = params.colors[0];
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    const base = params.baseColor;
    if (Array.isArray(base) && base.length >= 3) {
        const [r, g, b] = base;
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    return undefined;
}
function splitColorTrack(track) {
    if (track.a === 0) {
        const value = track.k;
        if (Array.isArray(value) && value.length >= 4) {
            const alpha = value[3];
            const colorValue = value.slice(0, 3);
            const colorTrack = { a: 0, k: colorValue };
            if (alpha !== 1) {
                return {
                    colorTrack,
                    opacityTrack: { a: 0, k: alpha * 100 },
                };
            }
            return { colorTrack };
        }
        return { colorTrack: track };
    }
    if (!Array.isArray(track.k)) {
        return { colorTrack: track };
    }
    const keyframes = track.k;
    let alphaChanged = false;
    const colorKeyframes = keyframes.map((kf) => {
        const clone = { ...kf };
        if (Array.isArray(clone.s) && clone.s.length >= 4) {
            const alpha = clone.s[3];
            if (alpha !== 1)
                alphaChanged = true;
            clone.s = clone.s.slice(0, 3);
        }
        if (Array.isArray(clone.e) && clone.e.length >= 4) {
            const alpha = clone.e[3];
            if (alpha !== 1)
                alphaChanged = true;
            clone.e = clone.e.slice(0, 3);
        }
        return clone;
    });
    const opacityKeyframes = keyframes.map((kf) => {
        const startAlpha = Array.isArray(kf.s) && kf.s.length >= 4 ? (kf.s[3] ?? 1) : 1;
        const endAlpha = Array.isArray(kf.e) && kf.e.length >= 4 ? (kf.e[3] ?? 1) : undefined;
        if (startAlpha !== 1 || (endAlpha !== undefined && endAlpha !== 1)) {
            alphaChanged = true;
        }
        return {
            t: kf.t,
            s: startAlpha * 100,
            e: endAlpha !== undefined ? endAlpha * 100 : undefined,
            i: kf.i,
            o: kf.o,
        };
    });
    const colorTrack = { a: 1, k: colorKeyframes };
    if (alphaChanged) {
        return {
            colorTrack,
            opacityTrack: { a: 1, k: opacityKeyframes },
        };
    }
    return { colorTrack };
}
//# sourceMappingURL=generateSticker.js.map