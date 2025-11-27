import * as fs from 'fs/promises';
import * as path from 'path';
import opentype from 'opentype.js';

import { Sticker } from '../interfaces/sticker';
import {
    applyDefaults,
    DEFAULT_DURATION,
    DEFAULT_FONT_FILE,
    DEFAULT_FONT_SIZE,
    DEFAULT_FRAME_RATE,
    DEFAULT_HEIGHT,
    DEFAULT_SEED,
    DEFAULT_STROKE_COLOR,
    DEFAULT_STROKE_WIDTH,
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
import { wrapAndScaleText } from '../layout/wrap';
import { loadFont } from '../layout/fontLoader';
import { layoutText } from '../layout/layoutText';
import { glyphToShapes } from '../shapes/glyphToShapes';
import { applyLetterAnimations } from '../animations/letter';
import { buildLetterStyles } from '../style/apply';
import { applyTransformsWithCompose, applyColorsWithCompose } from '../animations/composers';
import { ShapeLayer, GroupShapeElement, ShapeType } from '../interfaces/lottie';
import { transformRegistry, colorRegistry } from '../animations/registry';
import { applyPathMorphAnimations } from '../animations/pathMorph';
import { fontAnimationConfig } from '../config/animation-config';

export async function generateSticker(opts: GenerateStickerOptions): Promise<Sticker> {
    const cfg = applyDefaults(opts);
    return generateTextSticker(cfg);
}

export async function generateTextSticker(opts: GenerateStickerOptions): Promise<Sticker> {
    const {
        text,
        transformAnimations,
        colorAnimations,
        strokeAnimations,
        letterAnimations,
        pathMorphAnimations,
        fontSize = DEFAULT_FONT_SIZE,
        fontFile = DEFAULT_FONT_FILE,
        width = DEFAULT_WIDTH,
        height = DEFAULT_HEIGHT,
        frameRate = DEFAULT_FRAME_RATE,
        duration = DEFAULT_DURATION,
        strokeWidth = DEFAULT_STROKE_WIDTH,
        strokeColor = DEFAULT_STROKE_COLOR,
        fillColor,
        seed = DEFAULT_SEED,
    } = opts;
    const fontPath = path.resolve(fontAnimationConfig.fontDirectory, fontFile);
    const fontObj = await loadFont(fontPath);
    const { lines, finalFontSize, layout } = prepareLayout(text, fontObj, fontSize, width, height);

    const layer = buildBaseLayer(width, height, duration);
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
        strokeWidth,
        strokeColor,
        fillColor,
        seed,
    );
    layer.shapes.push(lettersGroup);

    const sticker = buildStickerShell(text, width, height, frameRate, duration, [layer]);
    return sticker;
}

export async function saveStickerToFile(sticker: Sticker, outPath: string) {
    await writeJsonGz(sticker, outPath);
}

export async function stickerToBuffer(sticker: Sticker): Promise<Buffer> {
    return await jsonToGzBuffer(sticker);
}

function buildBaseLayer(width: number, height: number, duration: number) {
    const layer = {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Text Layer',
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
    strokeWidth: number,
    strokeColor: [number, number, number],
    fillColor: [number, number, number] | undefined,
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
    const baseStyles = buildLetterStyles(colorAnimations, strokeAnimations, {
        duration,
        strokeWidth,
        strokeColor,
        fillColor,
        letterPhase: 0,
        letterIndex: -1,
    });
    if (baseStyles.fill) group.it.push(baseStyles.fill);
    if (baseStyles.stroke) group.it.push(baseStyles.stroke);

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
            strokeWidth,
            strokeColor,
            fillColor,
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
    return { lines, finalFontSize, layout };
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
