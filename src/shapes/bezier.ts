import opentype from 'opentype.js';

import { Bezier } from '../interfaces/lottie';
import { PathMorphAnimationType } from '../domain/types';
import { linearIn, linearOut } from '../shared/keyframes';
import { seededNoise } from '../shared/noise';
import { pathMorphAnimationConfig } from '../config/animation-config';

export function buildPathMorphKeyframes(
    bez: Bezier,
    fontSize: number,
    duration: number,
    morph: PathMorphAnimationType,
    seed: number,
    params?: any,
): any[] | null {
    if (morph === PathMorphAnimationType.None) return null;
    const baseCfg = {
        ...pathMorphAnimationConfig[morph],
        ...(params ?? {}),
    } as any;
    const intensity = fontSize * baseCfg.intensityFactor;

    const phases =
        morph === PathMorphAnimationType.Warp || morph === PathMorphAnimationType.WarpAiry
            ? pathMorphAnimationConfig[morph].phases
            : [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    const states =
        morph === PathMorphAnimationType.SkewSwing
            ? buildSwingStates(bez, intensity)
            : phases.map((ph) => applyMorph(bez, morph, intensity, ph, seed));

    const stateCount = states.length;
    const times = Array.from({ length: stateCount + 1 }, (_, idx) => (idx / stateCount) * duration);
    const kf: any[] = [];
    for (let s = 0; s < stateCount; s++) {
        const t = times[s];
        const cur = states[s];
        const nxt = states[(s + 1) % stateCount];
        kf.push({ t, s: [cur], e: [nxt], i: linearIn(), o: linearOut() });
    }
    kf.push({ t: duration, s: [states[0]] });
    return kf;
}

export function convertOpentypePathToBezier(pathObj: opentype.Path): Bezier[] {
    const cmds = pathObj.commands;
    if (!cmds || !cmds.length) return [];

    const contours: Bezier[] = [];
    let inT: number[][] = [];
    let outT: number[][] = [];
    let v: number[][] = [];

    for (let i = 0; i < cmds.length; i++) {
        const c = cmds[i] as any;
        switch (c.type) {
            case 'M':
                if (v.length > 0) {
                    contours.push({ c: true, i: inT, o: outT, v });
                    inT = [];
                    outT = [];
                    v = [];
                }
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
                const qx: number = c.x1;
                const qy: number = c.y1;
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
                if (v.length > 0) {
                    contours.push({ c: true, i: inT, o: outT, v });
                    inT = [];
                    outT = [];
                    v = [];
                }
                break;
        }
    }

    if (v.length > 0) {
        contours.push({ c: true, i: inT, o: outT, v });
    }

    return contours;
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
        const wave = Math.sin(phase + i * 0.9 + seededNoise(seed, 100 + i) * Math.PI);
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

function skewMorphWithK(bez: Bezier, k: number): Bezier {
    const nV: number[][] = [];
    const nI: number[][] = [];
    const nO: number[][] = [];
    for (let i = 0; i < bez.v.length; i++) {
        const [x, y] = bez.v[i];
        const iv = bez.i[i] || [0, 0];
        const ov = bez.o[i] || [0, 0];
        nV.push([x + y * k, y]);
        nI.push([iv[0] + iv[1] * k, iv[1]]);
        nO.push([ov[0] + ov[1] * k, ov[1]]);
    }
    return { c: bez.c, i: nI, o: nO, v: nV };
}

function warpCornerMorphAiry(
    bez: Bezier,
    intensity: number,
    phase: number,
    seed: number,
): Bezier {
    const cfg = pathMorphAnimationConfig[PathMorphAnimationType.WarpAiry];
    const count = bez.v.length;
    const baseDisp: number[][] = [];
    const waves: number[] = [];
    const nI: number[][] = [];
    const nO: number[][] = [];
    const lowFreq = cfg.lowFrequency;
    const highFreq = cfg.highFrequency;
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
        const scale = 1 + wave * cfg.scaleFactor;
        const rot = wave * cfg.rotationFactor;
        nI.push(warpHandle(inVec, rot, scale));
        nO.push(warpHandle(outVec, -rot, scale));
    }
    return { c: bez.c, i: nI, o: nO, v: newV };
}

function skewMorph(bez: Bezier, phase: number, amount: number): Bezier {
    const k = Math.sin(phase) * amount;
    const nV: number[][] = [];
    const nI: number[][] = [];
    const nO: number[][] = [];
    for (let i = 0; i < bez.v.length; i++) {
        const [x, y] = bez.v[i];
        const iv = bez.i[i] || [0, 0];
        const ov = bez.o[i] || [0, 0];
        nV.push([x + y * k, y]);
        nI.push([iv[0] + iv[1] * k, iv[1]]);
        nO.push([ov[0] + ov[1] * k, ov[1]]);
    }
    return { c: bez.c, i: nI, o: nO, v: nV };
}

function applyMorph(
    bez: Bezier,
    morph: PathMorphAnimationType,
    intensity: number,
    phase: number,
    seed: number,
): Bezier {
    switch (morph) {
        case PathMorphAnimationType.WarpAiry:
            return warpCornerMorphAiry(bez, intensity, phase, seed);
        case PathMorphAnimationType.SkewPulse:
            return skewMorph(bez, phase, skewAmount(intensity));
        case PathMorphAnimationType.SkewSwing:
            return skewMorph(bez, phase, skewAmount(intensity) * 0.7);
        case PathMorphAnimationType.Warp:
        default:
            return warpCornerMorph(bez, intensity, phase, seed);
    }
}

function skewAmount(intensity: number) {
    const baseCfg = pathMorphAnimationConfig[PathMorphAnimationType.SkewPulse];
    const norm = intensity > 0 ? Math.min(intensity / baseCfg.skewNormDivisor, 2) : 1;
    return Math.min(baseCfg.skewMax, Math.max(baseCfg.skewMin, baseCfg.skewBase * norm));
}

function buildSwingStates(bez: Bezier, intensity: number) {
    const cfg = pathMorphAnimationConfig[PathMorphAnimationType.SkewSwing];
    const amp = skewAmount(intensity) * cfg.swingAmplitudeScale;
    const ks = [amp, 0, -amp, 0];
    return ks.map((k) => skewMorphWithK(bez, k));
}
