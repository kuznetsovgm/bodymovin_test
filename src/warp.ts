import * as zlib from 'zlib';
import * as fs from 'fs/promises';
import * as path from 'path';
import opentype from 'opentype.js';

import { Sticker } from './interfaces/sticker';
import {
    Bezier,
    FillShape,
    GroupShapeElement,
    PathShape,
    ShapeLayer,
    ShapeType,
    TransformShape,
} from './interfaces/lottie';

export enum TransformAnimationType {
    None = 'none',
    SlideLoop = 'slideLoop',
    ScalePulse = 'scalePulse',
    RotateContinuous = 'rotateContinuous',
    ShakeLoop = 'shakeLoop',
    Bounce = 'bounce',
    Vibrate = 'vibrate',
}
export enum ColorAnimationType {
    None = 'none',
    CycleRGB = 'cycleRGB',
    Pulse = 'pulse',
    Rainbow = 'rainbow',
}
export enum LetterAnimationType {
    None = 'none',
    Vibrate = 'vibrate',
    TypingFall = 'typingFall',
    Wave = 'wave',
    ZigZag = 'zigzag',
    Warp = 'warp',
}

export interface GenerateStickerOptions {
    text: string;
    transformAnimation?: TransformAnimationType;
    colorAnimation?: ColorAnimationType;
    letterAnimation?: LetterAnimationType;
    fontSize?: number;
    fontPath?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
}

const FONT = 'CyrillicRound.ttf';

function seededNoise(base: number, salt: number = 0) {
    const v = Math.sin(base * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
}
function buildLetterSeed(letterIndex: number, charCode: number) {
    return (letterIndex + 1) * 97.13 + charCode * 0.61;
}

function wrapAndScaleText(
    text: string,
    font: opentype.Font,
    initialFontSize: number,
    maxWidth: number,
    maxHeight: number,
) {
    let size = initialFontSize;
    let lines: string[] = [];
    const wrap = (fsz: number) => {
        const words = text.split(' ');
        const out: string[] = [];
        let line = '';
        for (const w of words) {
            const test = line ? line + ' ' + w : w;
            const wWidth = font.getAdvanceWidth(test, fsz);
            if (wWidth <= maxWidth) {
                line = test;
            } else {
                if (line) out.push(line);
                line = w;
            }
        }
        if (line) out.push(line);
        return out;
    };
    for (let a = 0; a < 20; a++) {
        lines = wrap(size);
        const lh = size * 1.2;
        const total = lines.length * lh;
        const allFit = lines.every(
            (l) => font.getAdvanceWidth(l, size) <= maxWidth,
        );
        if (allFit && total <= maxHeight) break;
        size *= 0.9;
    }
    return { lines, finalFontSize: size };
}

export async function generateTextSticker(
    opts: GenerateStickerOptions,
): Promise<Sticker> {
    const {
        text,
        transformAnimation = TransformAnimationType.None,
        colorAnimation = ColorAnimationType.None,
        letterAnimation = LetterAnimationType.None,
        fontSize = 72,
        fontPath = path.resolve(`./fonts/${FONT}`),
        width = 512,
        height = 512,
        frameRate = 60,
        duration = 180,
    } = opts;
    const fontObj = await promisify<opentype.Font>(opentype.load, fontPath);
    const { lines, finalFontSize } = wrapAndScaleText(
        text,
        fontObj,
        fontSize,
        width * 0.85,
        height * 0.85,
    );
    const sticker: Sticker = {
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
        layers: [],
    };
    const layer: ShapeLayer = {
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
        shapes: [],
        ip: 0,
        op: duration,
        st: 0,
        bm: 0,
    };
    switch (transformAnimation) {
        case TransformAnimationType.SlideLoop: {
            const amp = width * 0.3;
            layer.ks.p = {
                a: 1,
                k: buildLoopKeyframes(
                    [
                        [width / 2 - amp, height / 2, 0],
                        [width / 2 + amp, height / 2, 0],
                        [width / 2 - amp, height / 2, 0],
                    ],
                    [0, duration / 2, duration],
                ),
            } as any;
            break;
        }
        case TransformAnimationType.ScalePulse: {
            layer.ks.s = {
                a: 1,
                k: buildLoopKeyframes(
                    [
                        [90, 90, 100],
                        [120, 120, 100],
                        [90, 90, 100],
                    ],
                    [0, duration / 2, duration],
                ),
            } as any;
            break;
        }
        case TransformAnimationType.RotateContinuous: {
            layer.ks.r = {
                a: 1,
                k: buildValueKeyframes([0, 360], [0, duration], true),
            } as any;
            break;
        }
        case TransformAnimationType.ShakeLoop: {
            const steps = 16,
                intensity = 20,
                pts: number[][] = [],
                times: number[] = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                const off = (f % 2 === 0 ? intensity : -intensity) * (1 - f / steps);
                pts.push([width / 2 + off, height / 2, 0]);
                times.push(t);
            }
            pts[pts.length - 1] = [width / 2, height / 2, 0];
            layer.ks.p = { a: 1, k: buildRawKeyframes(pts, times, true) } as any;
            break;
        }
        case TransformAnimationType.Bounce: {
            const hAmp = height * 0.08;
            layer.ks.p = {
                a: 1,
                k: buildLoopKeyframes(
                    [
                        [width / 2, height / 2, 0],
                        [width / 2, height / 2 - hAmp, 0],
                        [width / 2, height / 2, 0],
                        [width / 2, height / 2 - hAmp * 0.5, 0],
                        [width / 2, height / 2, 0],
                    ],
                    [0, duration * 0.25, duration * 0.5, duration * 0.75, duration],
                ),
            } as any;
            break;
        }
        case TransformAnimationType.Vibrate: {
            const steps = 30,
                intensity = 4,
                pts: number[][] = [],
                times: number[] = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                pts.push([
                    width / 2 + (Math.random() - 0.5) * intensity * 2,
                    height / 2 + (Math.random() - 0.5) * intensity * 2,
                    0,
                ]);
                times.push(t);
            }
            layer.ks.p = { a: 1, k: buildRawKeyframes(pts, times, true) } as any;
            break;
        }
        case TransformAnimationType.None:
        default:
            break;
    }
    const lettersGroup = convertTextToShapes(
        lines,
        fontObj,
        finalFontSize,
        colorAnimation,
        duration,
        letterAnimation,
        height,
    );
    if (colorAnimation !== ColorAnimationType.Rainbow) {
        let cix = 1;
        if (colorAnimation === ColorAnimationType.CycleRGB) cix = 2;
        else if (colorAnimation === ColorAnimationType.Pulse) cix = 3;
        const fill = createFill(colorAnimation, duration, 0, cix);
        lettersGroup.it.push(fill);
    }
    layer.shapes.push(lettersGroup);
    sticker.layers!.push(layer);
    return sticker;
}

function convertTextToShapes(
    lines: string[],
    font: opentype.Font,
    fontSize: number,
    colorAnimation: ColorAnimationType,
    duration: number,
    letterAnimation: LetterAnimationType,
    canvasHeight: number,
): GroupShapeElement {
    const group: GroupShapeElement = {
        ty: ShapeType.Group,
        cix: 1,
        np: 1,
        it: [],
        nm: 'letters',
        bm: 0,
        hd: false,
    };
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    let letterIndex = 0;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx];
        const total = font.getAdvanceWidth(text, fontSize);
        let x = -total / 2;
        const y = -totalHeight / 2 + lineIdx * lineHeight + fontSize * 0.75;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === ' ') {
                const g = font.charToGlyph(ch);
                if (g) {
                    x += (g.advanceWidth * fontSize) / font.unitsPerEm;
                }
                continue;
            }
            const glyph = font.charToGlyph(ch);
            if (!glyph) continue;
            const path = glyph.getPath(0, 0, fontSize);
            const bez = convertOpentypePathToBezier(path);
            if (!bez) continue;
            const adv = (glyph.advanceWidth * fontSize) / font.unitsPerEm;
            const pathShape: PathShape = {
                ty: ShapeType.Path,
                ind: letterIndex,
                hd: false,
                nm: `letter_${ch}_${letterIndex}`,
                cix: 100 + letterIndex,
                bm: 0,
                ks: { ix: 0, a: 0, k: bez },
            };
            let transform: TransformShape;
            switch (letterAnimation) {
                case LetterAnimationType.Vibrate:
                    transform = createVibrateTransform(letterIndex, x, y, duration);
                    break;
                case LetterAnimationType.TypingFall:
                    transform = createTypingFallLetterTransform(
                        letterIndex,
                        x,
                        y,
                        duration,
                        canvasHeight,
                    );
                    break;
                case LetterAnimationType.Wave:
                    transform = createWaveTransform(letterIndex, x, y, duration);
                    break;
                case LetterAnimationType.ZigZag:
                    transform = createZigZagTransform(letterIndex, x, y, duration);
                    break;
                case LetterAnimationType.Warp:
                    transform = createWarpTransform(letterIndex, x, y, duration);
                    break;
                default:
                    transform = createStaticTransform(letterIndex, x, y);
            }
            if (letterAnimation === LetterAnimationType.Warp) {
                const seed = buildLetterSeed(letterIndex, ch.charCodeAt(0));
                const intensity = fontSize * 0.06;
                const stateCount = 6;
                const states: Bezier[] = [];
                for (let s = 0; s < stateCount; s++) {
                    const phase = (s / stateCount) * Math.PI * 2;
                    states.push(warpCornerMorphAiry(bez, intensity, phase, seed));
                }
                const seg = duration / stateCount;
                const kf: any[] = [];
                for (let s = 0; s < stateCount; s++) {
                    const t = s * seg;
                    const cur = states[s];
                    const nxt = states[(s + 1) % stateCount];
                    kf.push({ t, s: [cur], e: [nxt], i: linearIn(), o: linearOut() });
                }
                kf.push({ t: duration, s: [states[0]] });
                pathShape.ks = { ix: 0, a: 1, k: kf } as any;
            }
            const items: any[] = [pathShape];
            if (colorAnimation === ColorAnimationType.Rainbow) {
                const totalLetters = lines.join('').replace(/ /g, '').length;
                const phase = (totalLetters - 1 - letterIndex) / totalLetters;
                items.push(
                    createFill(colorAnimation, duration, phase, 500 + letterIndex),
                );
            }
            items.push(transform);
            group.it.push({
                ty: ShapeType.Group,
                cix: 300 + letterIndex,
                it: items,
                nm: `letter_${letterIndex}`,
                bm: 0,
                hd: false,
            } as any);
            x += adv;
            letterIndex++;
        }
    }
    return group;
}

function createStaticTransform(
    index: number,
    x: number,
    y: number = 0,
): TransformShape {
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        p: { a: 0, k: [x, y], ix: 2 },
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 0, k: [100, 100], ix: 3 },
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
    };
}
function createVibrateTransform(
    index: number,
    x: number,
    y: number,
    duration: number,
): TransformShape {
    const intensity = 2,
        steps = 30,
        pts: number[][] = [],
        times: number[] = [];
    for (let f = 0; f <= steps; f++) {
        const t = (f / steps) * duration;
        pts.push([
            x + (Math.random() - 0.5) * intensity * 2,
            y + (Math.random() - 0.5) * intensity * 2,
        ]);
        times.push(t);
    }
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        p: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 2 } as any,
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 0, k: [100, 100], ix: 3 },
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
    };
}
function createTypingFallLetterTransform(
    index: number,
    x: number,
    finalY: number,
    duration: number,
    canvasHeight: number,
): TransformShape {
    const delay = (index * duration) / 40;
    const fallDur = duration / 6;
    const startY = finalY - canvasHeight;
    const kf = [
        { t: 0, s: [x, startY], e: [x, startY], i: linearIn(), o: linearOut() },
        { t: delay, s: [x, startY], e: [x, finalY], i: linearIn(), o: linearOut() },
        { t: Math.min(delay + fallDur, duration), s: [x, finalY] },
    ];
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        p: { a: 1, k: kf, ix: 2 } as any,
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 0, k: [100, 100], ix: 3 },
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
    };
}
function createWaveTransform(
    index: number,
    x: number,
    y: number,
    duration: number,
): TransformShape {
    const amp = 12,
        steps = 40,
        pts: number[][] = [],
        times: number[] = [],
        phase = index * 0.4;
    for (let f = 0; f <= steps; f++) {
        const t = (f / steps) * duration;
        const angle = phase + (2 * Math.PI * t) / duration;
        pts.push([x, y + Math.sin(angle) * amp]);
        times.push(t);
    }
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        p: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 2 } as any,
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 0, k: [100, 100], ix: 3 },
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
    };
}
function createZigZagTransform(
    index: number,
    x: number,
    y: number,
    duration: number,
): TransformShape {
    const spread = 35,
        steps = 48,
        pts: number[][] = [],
        times: number[] = [],
        phase = index * Math.PI;
    for (let f = 0; f <= steps; f++) {
        const t = (f / steps) * duration;
        const angle = phase + (2 * Math.PI * t) / duration;
        const sy = 100 + Math.sin(angle) * spread;
        pts.push([100, sy]);
        times.push(t);
    }
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        p: { a: 0, k: [x, y], ix: 2 },
        a: { a: 0, k: [0, 0], ix: 1 },
        s: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 3 } as any,
        r: { a: 0, k: 0, ix: 6 },
        o: { a: 0, k: 100, ix: 7 },
        sk: { a: 0, k: 0, ix: 4 },
        sa: { a: 0, k: 0, ix: 5 },
    };
}
function createWarpTransform(
    index: number,
    x: number,
    y: number,
    duration: number,
): TransformShape {
    return createStaticTransform(index, x, y);
}

function convertOpentypePathToBezier(pathObj: opentype.Path): Bezier | null {
    const cmds = pathObj.commands;
    if (!cmds || !cmds.length) return null;
    const inT: number[][] = [];
    const outT: number[][] = [];
    const v: number[][] = [];
    for (let i = 0; i < cmds.length; i++) {
        const c = cmds[i];
        switch (c.type) {
            case 'M':
                v.push([c.x, c.y]);
                inT.push([0, 0]);
                outT.push([0, 0]);
                break;
            case 'L':
                v.push([c.x, c.y]);
                inT.push([0, 0]);
                outT.push([0, 0]);
                break;
            case 'C': {
                const last = v[v.length - 1];
                outT[outT.length - 1] = [c.x1 - last[0], c.y1 - last[1]];
                v.push([c.x, c.y]);
                inT.push([c.x2 - c.x, c.y2 - c.y]);
                outT.push([0, 0]);
                break;
            }
            case 'Q': {
                const last = v[v.length - 1];
                const qx: number = (c as any).x1;
                const qy: number = (c as any).y1;
                const x1c = last[0] + (2 / 3) * (qx - last[0]);
                const y1c = last[1] + (2 / 3) * (qy - last[1]);
                const x2c = c.x + (2 / 3) * (qx - c.x);
                const y2c = c.y + (2 / 3) * (qy - c.y);
                outT[outT.length - 1] = [x1c - last[0], y1c - last[1]];
                v.push([c.x, c.y]);
                inT.push([x2c - c.x, y2c - c.y]);
                outT.push([0, 0]);
                break;
            }
            case 'Z':
                break;
        }
    }
    return { c: true, i: inT, o: outT, v };
}
function warpHandle(vec: number[], angle: number, scale: number): number[] {
    if (!vec) return [0, 0];
    const cos = Math.cos(angle),
        sin = Math.sin(angle);
    return [
        (vec[0] * cos - vec[1] * sin) * scale,
        (vec[0] * sin + vec[1] * cos) * scale,
    ];
}
function warpCornerMorph(
    bez: Bezier,
    intensity: number,
    phase: number,
    seed: number,
): Bezier {
    const nV: number[][] = [];
    const nI: number[][] = [];
    const nO: number[][] = [];
    const count = bez.v.length;
    for (let i = 0; i < count; i++) {
        const prev = bez.v[(i - 1 + count) % count];
        const curr = bez.v[i];
        const next = bez.v[(i + 1) % count];
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        let nx = -ty,
            ny = tx;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const amp = intensity * (0.5 + seededNoise(seed, i) * 0.5);
        const wave = Math.sin(
            phase + i * 0.9 + seededNoise(seed, 100 + i) * Math.PI,
        );
        const dx = nx * amp * wave;
        const dy = ny * amp * wave;
        nV.push([curr[0] + dx, curr[1] + dy]);
        const inVec = bez.i[i] || [0, 0];
        const outVec = bez.o[i] || [0, 0];
        const scale = 1 + wave * 0.15;
        const rot = wave * 0.25;
        nI.push(warpHandle(inVec, rot, scale));
        nO.push(warpHandle(outVec, -rot, scale));
    }
    return { c: bez.c, i: nI, o: nO, v: nV };
}
function warpCornerMorphAiry(
    bez: Bezier,
    intensity: number,
    phase: number,
    seed: number,
): Bezier {
    const count = bez.v.length;
    const baseDisp: number[][] = [];
    const waves: number[] = [];
    const nI: number[][] = [];
    const nO: number[][] = [];
    const lowFreq = 0.35;
    const highFreq = 0.12;
    for (let i = 0; i < count; i++) {
        const prev = bez.v[(i - 1 + count) % count];
        const curr = bez.v[i];
        const next = bez.v[(i + 1) % count];
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        let nx = -ty,
            ny = tx;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const noiseA = seededNoise(seed, i);
        const noiseB = seededNoise(seed, 200 + i);
        const w1 = Math.sin(phase + i * lowFreq + noiseA * Math.PI * 2);
        const w2 = Math.cos(phase * 0.6 + i * highFreq + noiseB * Math.PI * 2);
        const wave = w1 * 0.65 + w2 * 0.35;
        waves.push(wave);
        const amp = intensity * (0.4 + noiseA * 0.4);
        baseDisp.push([nx * amp * wave, ny * amp * wave]);
    }
    for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < count; i++) {
            const prev = baseDisp[(i - 1 + count) % count];
            const curr = baseDisp[i];
            const next = baseDisp[(i + 1) % count];
            baseDisp[i] = [
                curr[0] * 0.5 + (prev[0] + next[0]) * 0.25,
                curr[1] * 0.5 + (prev[1] + next[1]) * 0.25,
            ];
        }
    }
    const newV: number[][] = [];
    for (let i = 0; i < count; i++) {
        const curr = bez.v[i];
        newV.push([curr[0] + baseDisp[i][0], curr[1] + baseDisp[i][1]]);
        const inVec = bez.i[i] || [0, 0];
        const outVec = bez.o[i] || [0, 0];
        const wave = waves[i];
        const scale = 1 + wave * 0.08;
        const rot = wave * 0.18;
        nI.push(warpHandle(inVec, rot, scale));
        nO.push(warpHandle(outVec, -rot, scale));
    }
    return { c: bez.c, i: nI, o: nO, v: newV };
}

function createFill(
    colorAnimation: ColorAnimationType,
    duration: number,
    phase: number = 0,
    cix: number = 2,
): FillShape {
    switch (colorAnimation) {
        case ColorAnimationType.CycleRGB:
            return {
                cix,
                ty: ShapeType.Fill,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [1, 0, 0, 1],
                            [0, 1, 0, 1],
                            [0, 0, 1, 1],
                            [1, 0, 0, 1],
                        ],
                        [0, duration / 3, (2 * duration) / 3, duration],
                        true,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill RGB Cycle',
                hd: false,
            };
        case ColorAnimationType.Pulse:
            return {
                cix,
                ty: ShapeType.Fill,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [1, 1, 1, 1],
                            [1, 0.7, 0.2, 1],
                            [1, 1, 1, 1],
                        ],
                        [0, duration / 2, duration],
                        true,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill Pulse',
                hd: false,
            };
        case ColorAnimationType.Rainbow: {
            const colors = [
                [1, 0, 0, 1],
                [1, 0.5, 0, 1],
                [1, 1, 0, 1],
                [0, 1, 0, 1],
                [0, 0.5, 1, 1],
                [0, 0, 1, 1],
                [0.5, 0, 1, 1],
                [1, 0, 0.5, 1],
                [1, 0, 0, 1],
            ];
            const times = colors.map((_, idx) => (idx / 8) * duration);
            const shifted = times.map((t) => (t + phase * duration) % duration);
            const pairs = times
                .map((t, i) => ({ time: shifted[i], color: colors[i] }))
                .sort((a, b) => a.time - b.time);
            return {
                cix,
                ty: ShapeType.Fill,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        pairs.map((p) => p.color),
                        pairs.map((p) => p.time),
                        true,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill Rainbow Wave',
                hd: false,
            };
        }
        case ColorAnimationType.None:
        default:
            return {
                cix,
                ty: ShapeType.Fill,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [1, 1, 1, 1],
                            [1, 1, 1, 1],
                        ],
                        [0, duration],
                        false,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill Static',
                hd: false,
            };
    }
}

function linearIn() {
    return { x: [0.667], y: [1] };
}
function linearOut() {
    return { x: [0.333], y: [0] };
}
function buildLoopKeyframes(points: number[][], times: number[]) {
    return buildRawKeyframes(points, times, true);
}
function buildValueKeyframes(values: number[], times: number[], loop: boolean) {
    return buildRawKeyframes(
        values.map((v) => [v]),
        times,
        loop,
    );
}
function buildRawKeyframes(points: number[][], times: number[], loop: boolean) {
    const k: any[] = [];
    for (let i = 0; i < points.length; i++) {
        const t = times[i];
        const s = points[i];
        if (i < points.length - 1) {
            const e = points[i + 1];
            k.push({ t, s, e, i: linearIn(), o: linearOut() });
        } else {
            k.push({ t, s });
        }
    }
    if (loop) {
        k[k.length - 1].s = points[0];
    }
    return k;
}

export async function saveStickerToFile(sticker: Sticker, outPath: string) {
    const json = JSON.stringify(sticker);
    const gz = await promisify<Buffer>(zlib.gzip, json);
    await ensureDir('./stickers');
    await fs.writeFile(outPath, gz as any);
}
async function ensureDir(p: string) {
    try {
        await fs.mkdir(path.resolve(p), { recursive: true });
    } catch { }
}
async function init() {
    const examples: { name: string; opts: GenerateStickerOptions }[] = [
        {
            name: 'very_long_text',
            opts: {
                text: 'THIS IS A VERY LONG TEXT THAT WILL WRAP AND SCALE TO FIT WITHIN THE STICKER AREA',
                transformAnimation: TransformAnimationType.ScalePulse,
                colorAnimation: ColorAnimationType.Rainbow,
            },
        },
        {
            name: 'typing_fall',
            opts: {
                text: 'HELLO WORLD',
                transformAnimation: TransformAnimationType.ScalePulse,
                colorAnimation: ColorAnimationType.Rainbow,
                letterAnimation: LetterAnimationType.TypingFall,
            },
        },
        {
            name: 'wave_letters',
            opts: {
                text: 'WAVE LETTERS',
                transformAnimation: TransformAnimationType.None,
                colorAnimation: ColorAnimationType.Rainbow,
                letterAnimation: LetterAnimationType.Wave,
            },
        },
        {
            name: 'zigzag_letters',
            opts: {
                text: 'ZIG ZAG',
                transformAnimation: TransformAnimationType.Vibrate,
                colorAnimation: ColorAnimationType.Pulse,
                letterAnimation: LetterAnimationType.ZigZag,
            },
        },
        {
            name: 'warp_letters',
            opts: {
                text: 'WARP TEXT',
                transformAnimation: TransformAnimationType.ShakeLoop,
                colorAnimation: ColorAnimationType.CycleRGB,
                letterAnimation: LetterAnimationType.Warp,
            },
        },
        {
            name: 'vibrate',
            opts: {
                text: 'BZZZZ',
                transformAnimation: TransformAnimationType.Vibrate,
                colorAnimation: ColorAnimationType.Pulse,
            },
        },
    ];
    for (const ex of examples) {
        const sticker = await generateTextSticker(ex.opts);
        await saveStickerToFile(sticker, path.resolve(`./stickers/${ex.name}.tgs`));
        await fs.writeFile(
            path.resolve(`./stickers/${ex.name}.json`),
            JSON.stringify(sticker, null, 2),
        );
    }
}
async function promisify<T = any>(
    fn: (...args: any[]) => any,
    ...args: any[]
): Promise<T> {
    return new Promise((resolve, reject) => {
        fn(...args, (err: Error | undefined, res: T) => {
            if (err) return reject(err);
            resolve(res);
        });
    });
}

if (require.main === module) {
    init();
}
