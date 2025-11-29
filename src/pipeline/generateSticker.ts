import * as fs from 'fs/promises';
import * as path from 'path';
import opentype from 'opentype.js';

import { Sticker } from '../interfaces/sticker';
import {
    applyDefaults,
    DEFAULT_DURATION,
    DEFAULT_FONT_FILE,
    DEFAULT_FRAME_RATE,
    DEFAULT_HEIGHT,
    DEFAULT_SEED,
    DEFAULT_WIDTH,
} from '../domain/defaults';
import {
    AnimationDescriptor,
    ColorAnimationType,
    GenerateStickerOptions,
    LetterAnimationType,
    PathMorphAnimationType,
    TransformAnimationDescriptor,
    LetterAnimationDescriptor,
    ColorAnimationDescriptor,
    TransformAnimationType,
} from '../domain/types';
import { writeJsonGz, jsonToGzBuffer } from '../shared/fs';
import { Track } from '../shared/keyframes';
import { wrapAndScaleText } from '../layout/wrap';
import { loadFont } from '../layout/fontLoader';
import { layoutText } from '../layout/layoutText';
import { glyphToShapes } from '../shapes/glyphToShapes';
import { ensureFontSupportsText } from '../layout/fontSupport';
import { applyLetterAnimations } from '../animations/letter';
import { buildLetterStyles } from '../style/apply';
import { applyTransformsWithCompose, applyColorsWithCompose } from '../animations/composers';
import {
    Bezier,
    FillRule,
    GroupShapeElement,
    PathShape,
    RectShape,
    ShapeLayer,
    ShapeType,
} from '../interfaces/lottie';
import { transformRegistry, colorRegistry } from '../animations/registry';
import { applyPathMorphAnimations } from '../animations/pathMorph';
import { fontAnimationConfig } from '../config/animation-config';
import {
    BackgroundLayerDescriptor,
    BackgroundLayerType,
    KnockoutBackgroundOptions,
    PathMorphAnimationParams,
} from '../domain/types';
import { convertOpentypePathToBezier } from '../shapes/bezier';
import { buildLetterSeed } from '../shared/noise';

export async function generateSticker(opts: GenerateStickerOptions): Promise<Sticker> {
    const cfg = applyDefaults(opts);
    return generateTextSticker(cfg);
}

export async function generateTextSticker(opts: GenerateStickerOptions): Promise<Sticker> {
    const {
        text,
        backgroundLayers,
        knockoutBackground,
        transformAnimations,
        colorAnimations,
        strokeAnimations,
        letterAnimations,
        pathMorphAnimations,
        fontSize,
        fontFile = DEFAULT_FONT_FILE,
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
        frameRate = DEFAULT_FRAME_RATE,
        duration = DEFAULT_DURATION,
        seed = DEFAULT_SEED,
    } = opts;
    const resolvedFontSize = resolveFontSize(text, fontSize, width, height);
    const fontPath = path.resolve(fontAnimationConfig.fontDirectory, fontFile);
    const fontObj = await loadFont(fontPath);
    // Проверяем, что шрифт поддерживает все необходимые символы текста
    ensureFontSupportsText(fontObj, text);
    const { finalFontSize, layout } = prepareLayout(
        text,
        fontObj,
        resolvedFontSize,
        width,
        height,
    );

    const backgroundShapeLayers = buildBackgroundLayers(
        layout,
        finalFontSize,
        backgroundLayers,
        fontObj,
        {
            width,
            height,
            duration,
            seed,
        },
    );

    const knockoutLayer = buildKnockoutBackgroundLayer(
        layout,
        finalFontSize,
        knockoutBackground,
        fontObj,
        {
            width,
            height,
            duration,
            seed,
        },
        backgroundShapeLayers.length + 1,
    );

    const textLayerIndex = backgroundShapeLayers.length + (knockoutLayer ? 1 : 0) + 1;
    const layer = buildBaseLayer(width, height, duration, 'Text Layer', textLayerIndex);
    layer.ks = applyTransformsWithCompose(
        transformAnimations,
        layer.ks,
        {
            width,
            height,
            duration,
        },
        transformRegistry,
    );

    const lettersGroup = buildLettersGroup(
        layout,
        finalFontSize,
        colorAnimations,
        strokeAnimations,
        duration,
        letterAnimations,
        pathMorphAnimations,
        height,
        seed,
    );
    layer.shapes.push(lettersGroup);

    const layers: ShapeLayer[] = [...backgroundShapeLayers];
    if (knockoutLayer) layers.push(knockoutLayer);
    layers.push(layer);

    const sticker = buildStickerShell(text, width, height, frameRate, duration, layers);
    return sticker;
}

export async function saveStickerToFile(sticker: Sticker, outPath: string) {
    await writeJsonGz(sticker, outPath);
}

export async function stickerToBuffer(sticker: Sticker): Promise<Buffer> {
    return await jsonToGzBuffer(sticker);
}

function buildBaseLayer(width: number, height: number, duration: number, name: string, ind: number) {
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
        shapes: [] as any[],
        ip: 0,
        op: duration,
        st: 0,
        bm: 0,
    } satisfies Omit<ShapeLayer, 'shapes'> & { shapes: any[] };
    return layer as ShapeLayer;
}

function buildLettersGroup(
    layout: ReturnType<typeof layoutText>,
    fontSize: number,
    colorAnimations: ColorAnimationDescriptor[] | undefined,
    strokeAnimations: ColorAnimationDescriptor[] | undefined,
    duration: number,
    letterAnimations: LetterAnimationDescriptor[] | undefined,
    pathMorphAnimations: AnimationDescriptor<PathMorphAnimationType>[] | undefined,
    canvasHeight: number,
    seed: number,
): GroupShapeElement {
    const totalLetters = layout.length || 1;
    const group: GroupShapeElement = {
        ty: ShapeType.Group,
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
        const pathShapes = glyphToShapes(glyph, ch, letterIndex, {
            fontSize,
            duration,
            pathMorphAnimation: pickType(pathMorphAnimations, PathMorphAnimationType.None),
            pathMorphAnimations,
            seed,
        });

        const transform = applyLetterAnimations(letterAnimations, {
            letterIndex,
            x,
            y,
            duration,
            canvasHeight,
        });

        const items: any[] = [...pathShapes];
        const phase = (totalLetters - 1 - letterIndex) / totalLetters;
        const styles = buildLetterStyles(colorAnimations, strokeAnimations, {
            duration,
            letterPhase: phase,
            letterIndex,
        });
        if (styles.fill) items.push(styles.fill);
        if (styles.stroke) items.push(styles.stroke);
        items.push(transform);
        group.it.push({
            ty: ShapeType.Group,
            cix: 300 + letterIndex,
            it: items,
            nm: `letter_${letterIndex}`,
            bm: 0,
            hd: false,
        } as any);
    }
    return group;
}

function pickType<T>(descs: AnimationDescriptor<T>[] | undefined, fallback: T): T {
    if (!descs || descs.length === 0) return fallback;
    const sorted = [...descs].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return sorted[0].type;
}

function prepareLayout(
    text: string,
    font: opentype.Font,
    fontSize: number,
    width: number,
    height: number,
) {
    const { lines, finalFontSize } = wrapAndScaleText(
        text,
        font,
        fontSize,
        width * fontAnimationConfig.maxTextWidthFactor,
        height * fontAnimationConfig.maxTextHeightFactor,
    );
    const layout = layoutText(lines, font, finalFontSize);
    return { finalFontSize, layout };
}

function resolveFontSize(
    text: string,
    requestedFontSize: number | undefined,
    width: number,
    height: number,
) {
    if (typeof requestedFontSize === 'number' && requestedFontSize > 0) {
        return requestedFontSize;
    }
    return computeAutoFontSize(text, width, height);
}

function computeAutoFontSize(text: string, width: number, height: number) {
    const trimmed = text.trim();
    if (!trimmed) {
        return Math.min(height, width) * 0.5;
    }
    const lettersOnly = trimmed.replace(/\s+/g, '');
    const whitespaceCount = trimmed.length - lettersOnly.length;
    const effectiveGlyphs = Math.max(1, lettersOnly.length + whitespaceCount * 0.4);
    const availableWidth = width * fontAnimationConfig.maxTextWidthFactor;
    const availableHeight = height * fontAnimationConfig.maxTextHeightFactor;
    const targetArea = availableWidth * availableHeight * 0.85;
    const estimated = Math.sqrt(targetArea / effectiveGlyphs);
    const minSize = 32;
    const maxSize = availableHeight;
    return clamp(estimated, minSize, maxSize);
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function buildStickerShell(
    text: string,
    width: number,
    height: number,
    frameRate: number,
    duration: number,
    layers: ShapeLayer[],
): Sticker {
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

// ---------------- Background layers ----------------

type BackgroundBuildContext = {
    width: number;
    height: number;
    duration: number;
    seed: number;
};

function buildBackgroundLayers(
    layout: ReturnType<typeof layoutText>,
    fontSize: number,
    descs: BackgroundLayerDescriptor[] | undefined,
    font: opentype.Font,
    ctx: BackgroundBuildContext,
): ShapeLayer[] {
    if (!descs || !descs.length) return [];

    const layers: ShapeLayer[] = [];
    let layerIndex = 1;

    for (const desc of descs) {
        const layer = buildBaseLayer(ctx.width, ctx.height, ctx.duration, `Background:${desc.type}`, layerIndex++);
        layer.ks = applyTransformsWithCompose(
            desc.transformAnimations,
            layer.ks,
            { width: ctx.width, height: ctx.height, duration: ctx.duration },
            transformRegistry,
        );

        const group: GroupShapeElement = {
            ty: ShapeType.Group,
            cix: 1000,
            it: [],
            np: 1,
            nm: `bg_${desc.type}`,
            bm: 0,
            hd: false,
        };

        const shapes = buildBackgroundShapes(desc, layout, fontSize, font, ctx);
        if (shapes.length === 0) continue;

        group.it.push(...shapes);
        group.np = group.it.length;
        layer.shapes.push(group);
        layers.push(layer);
    }

    return layers;
}

function buildBackgroundShapes(
    desc: BackgroundLayerDescriptor,
    layout: ReturnType<typeof layoutText>,
    fontSize: number,
    font: opentype.Font,
    ctx: BackgroundBuildContext,
): any[] {
    switch (desc.type) {
        case BackgroundLayerType.Solid:
            return buildSolidBackground(desc, ctx);
        case BackgroundLayerType.Frame:
            return buildFrameBackground(desc, ctx);
        case BackgroundLayerType.Stripes:
            return buildStripesBackground(desc, ctx);
        case BackgroundLayerType.GlyphPattern:
        case BackgroundLayerType.TextLike:
        default:
            // Пока не реализовано — пропускаем
            return [];
    }
}

function buildSolidBackground(desc: BackgroundLayerDescriptor, ctx: BackgroundBuildContext): any[] {
    const padding = Math.max(0, Math.min(0.5, desc.params?.paddingFactor ?? 0));
    const cornerRadius = Math.max(0, desc.params?.cornerRadius ?? 0);
    const width = ctx.width * (1 + padding * 2);
    const height = ctx.height * (1 + padding * 2);

    const rect = createRectShape(width, height, cornerRadius, 10);
    const fill = buildFillFromAnimations(desc.colorAnimations, ctx.duration, 20);
    const stroke = buildStrokeFromAnimations(desc.strokeAnimations, ctx.duration, 30);

    return [rect, ...(fill ? [fill] : []), ...(stroke ? [stroke] : [])];
}

function buildFrameBackground(desc: BackgroundLayerDescriptor, ctx: BackgroundBuildContext): any[] {
    const padding = Math.max(0, Math.min(0.5, desc.params?.paddingFactor ?? 0.05));
    const cornerRadius = Math.max(0, desc.params?.cornerRadius ?? 0);
    const width = ctx.width * (1 + padding * 2);
    const height = ctx.height * (1 + padding * 2);

    const rect = createRectShape(width, height, cornerRadius, 40);
    const stroke = buildStrokeFromAnimations(desc.strokeAnimations, ctx.duration, 50);
    // Рамка: заливку не рисуем
    return [rect, ...(stroke ? [stroke] : [])];
}

function buildStripesBackground(desc: BackgroundLayerDescriptor, ctx: BackgroundBuildContext): any[] {
    const stripes = Math.max(1, Math.min(20, desc.params?.count ?? 5));
    const stripeHeightFactor = Math.max(0.01, Math.min(1, desc.params?.stripeHeightFactor ?? 0.1));
    const gapFactor = Math.max(0, Math.min(1, desc.params?.gapFactor ?? 0.05));

    const shapes: any[] = [];
    const totalHeight = ctx.height * (1 + gapFactor * 2);
    const stripeHeight = ctx.height * stripeHeightFactor;
    const usableHeight = totalHeight - stripeHeight;

    for (let i = 0; i < stripes; i++) {
        const y = -usableHeight / 2 + (usableHeight / Math.max(1, stripes - 1)) * i;
        const rect: RectShape = {
            ty: ShapeType.Rect,
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

function buildKnockoutBackgroundLayer(
    layout: ReturnType<typeof layoutText>,
    fontSize: number,
    opts: KnockoutBackgroundOptions | undefined,
    font: opentype.Font,
    ctx: BackgroundBuildContext,
    layerIndex: number,
): ShapeLayer | null {
    if (!opts) return null;

    const paddingFactor = Math.max(0, Math.min(0.5, opts.paddingFactor ?? 0.05));
    const cornerRadiusFactor = Math.max(0, Math.min(1, opts.cornerRadiusFactor ?? 0));

    const layer = buildBaseLayer(ctx.width, ctx.height, ctx.duration, 'Knockout Background', layerIndex);
    layer.ks = applyTransformsWithCompose(
        opts.transformAnimations,
        layer.ks,
        { width: ctx.width, height: ctx.height, duration: ctx.duration },
        transformRegistry,
    );

    const bounds = computeLayoutBounds(layout, fontSize, font);
    const textWidth = Math.max(1, bounds.maxX - bounds.minX);
    const textHeight = Math.max(1, bounds.maxY - bounds.minY);

    const paddedWidth = textWidth * (1 + paddingFactor * 2);
    const paddedHeight = textHeight * (1 + paddingFactor * 2);
    const cornerRadius = Math.min(paddedWidth, paddedHeight) * cornerRadiusFactor;

    const outerPath: PathShape = {
        ty: ShapeType.Path,
        ind: 1,
        hd: false,
        nm: 'knockout_outer',
        cix: 200,
        bm: 0,
        ks: { a: 0, k: buildRectBezier(paddedWidth, paddedHeight), ix: 0 },
    };

    const letterPaths = layout.flatMap((glyphInfo, idx) => {
        const path = glyphInfo.glyph.getPath(glyphInfo.x, glyphInfo.y, fontSize);
        const beziers = convertOpentypePathToBezier(path);
        if (!beziers || beziers.length === 0) return [];

        const morphDescs =
            opts.pathMorphAnimations && opts.pathMorphAnimations.length
                ? opts.pathMorphAnimations
                : [{ type: PathMorphAnimationType.None } as AnimationDescriptor<PathMorphAnimationType, PathMorphAnimationParams>];

        return beziers.map((bez, contourIdx) => {
            const morphSeed = buildLetterSeed(idx, glyphInfo.char.codePointAt(0) ?? 0, ctx.seed) + contourIdx * 0.1;
            const morphKf =
                morphDescs && morphDescs.length
                    ? applyPathMorphAnimations(bez, morphDescs as any, {
                          fontSize,
                          duration: ctx.duration,
                          seed: morphSeed,
                      })
                    : null;

            const pathShape: PathShape = {
                ty: ShapeType.Path,
                ind: 1000 + idx * 10 + contourIdx,
                hd: false,
                nm: `knockout_letter_${idx}_contour_${contourIdx}`,
                cix: 300 + idx * 10 + contourIdx,
                bm: 0,
                ks: morphKf ? ({ a: 1, k: morphKf, ix: 0 } as any) : { a: 0, k: bez, ix: 0 },
            };
            return pathShape;
        });
    });

    const shapes: any[] = [outerPath, ...letterPaths];

    const fill = buildFillFromAnimations(opts.colorAnimations, ctx.duration, 400, FillRule.EvenOdd);
    const stroke = buildStrokeFromAnimations(opts.strokeAnimations, ctx.duration, 410);

    if (fill) shapes.push(fill);
    if (stroke) shapes.push(stroke);

    const group: GroupShapeElement = {
        ty: ShapeType.Group,
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

function computeLayoutBounds(
    layout: ReturnType<typeof layoutText>,
    fontSize: number,
    font: opentype.Font,
) {
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

function buildRectBezier(width: number, height: number): Bezier {
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

function createRectShape(width: number, height: number, cornerRadius: number, cix: number): RectShape {
    return {
        ty: ShapeType.Rect,
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

function buildFillFromAnimations(
    animations: ColorAnimationDescriptor[] | undefined,
    duration: number,
    cix: number,
    fillRule: FillRule = FillRule.NonZero,
) {
    const baseColor = resolveBaseColor(animations);
    if (!baseColor) return null;

    const track = applyColorsWithCompose(
        animations,
        baseColor,
        { duration },
        0,
        colorRegistry,
    );

    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: ShapeType.Fill,
        c: { a: animated, k: colorTrack.k as any, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k as any } : { a: 0, k: 100 },
        r: fillRule,
        bm: 0,
        nm: 'Fill',
        hd: false,
    };
}

function buildStrokeFromAnimations(
    animations: ColorAnimationDescriptor[] | undefined,
    duration: number,
    cix: number,
) {
    if (!animations || !animations.length) return null;
    const strokeStyle = resolveStrokeStyle(animations);
    if (!strokeStyle) return null;

    const track = applyColorsWithCompose(
        animations,
        strokeStyle.color,
        { duration },
        0,
        colorRegistry,
    );

    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: ShapeType.Stroke,
        c: { a: animated, k: colorTrack.k as any, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k as any } : { a: 0, k: 100 },
        w: { a: 0, k: strokeStyle.width },
        lc: 2,
        lj: 2,
        ml: 4,
        bm: 0,
        nm: 'Stroke',
        hd: false,
    };
}

function resolveBaseColor(
    animations: ColorAnimationDescriptor[] | undefined,
    fallback?: [number, number, number],
): [number, number, number] | undefined {
    if (animations && animations.length) {
        const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const desc of sorted) {
            const base = extractBaseColor(desc.params as any);
            if (base) return base;
        }
    }
    return fallback;
}

function resolveStrokeStyle(
    animations: ColorAnimationDescriptor[] | undefined,
): { color: [number, number, number]; width: number } | null {
    if (!animations || !animations.length) return null;
    const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const desc of sorted) {
        const params = desc.params as any;
        const color = extractBaseColor(params);
        const width = params?.strokeWidth as number | undefined;
        if (color && typeof width === 'number' && Number.isFinite(width)) {
            return { color, width };
        }
    }
    return null;
}

function extractBaseColor(params: any): [number, number, number] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params.colors) && params.colors.length) {
        const [r, g, b] = params.colors[0];
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    const base = params.baseColor as [number, number, number] | undefined;
    if (Array.isArray(base) && base.length >= 3) {
        const [r, g, b] = base;
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    return undefined;
}

function splitColorTrack(
    track: Track<number[]>,
): { colorTrack: Track<number[]>; opacityTrack?: Track<number> } {
    if (track.a === 0) {
        const value = track.k as number[];
        if (Array.isArray(value) && value.length >= 4) {
            const alpha = value[3];
            const colorValue = value.slice(0, 3);
            const colorTrack: Track<number[]> = { a: 0, k: colorValue };
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

    const keyframes = track.k as any[];
    let alphaChanged = false;

    const colorKeyframes = keyframes.map((kf) => {
        const clone = { ...kf };
        if (Array.isArray(clone.s) && clone.s.length >= 4) {
            const alpha = clone.s[3];
            if (alpha !== 1) alphaChanged = true;
            clone.s = clone.s.slice(0, 3);
        }
        if (Array.isArray(clone.e) && clone.e.length >= 4) {
            const alpha = clone.e[3];
            if (alpha !== 1) alphaChanged = true;
            clone.e = clone.e.slice(0, 3);
        }
        return clone;
    });

    const opacityKeyframes = keyframes.map((kf) => {
        const startAlpha =
            Array.isArray(kf.s) && kf.s.length >= 4 ? (kf.s[3] ?? 1) : 1;
        const endAlpha =
            Array.isArray(kf.e) && kf.e.length >= 4 ? (kf.e[3] ?? 1) : undefined;
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

    const colorTrack: Track<number[]> = { a: 1, k: colorKeyframes as any };

    if (alphaChanged) {
        return {
            colorTrack,
            opacityTrack: { a: 1, k: opacityKeyframes as any },
        };
    }

    return { colorTrack };
}
