"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertOpentypePathToBezier = exports.buildPathMorphKeyframes = void 0;
const types_1 = require("../domain/types");
const keyframes_1 = require("../shared/keyframes");
const noise_1 = require("../shared/noise");
const animation_config_1 = require("../config/animation-config");
function buildPathMorphKeyframes(bez, fontSize, duration, morph, seed, params) {
    if (morph === types_1.PathMorphAnimationType.None)
        return null;
    const baseCfg = {
        ...animation_config_1.pathMorphAnimationConfig[morph],
        ...(params ?? {}),
    };
    const intensity = fontSize * baseCfg.intensityFactor;
    const phases = morph === types_1.PathMorphAnimationType.Warp || morph === types_1.PathMorphAnimationType.WarpAiry
        ? animation_config_1.pathMorphAnimationConfig[morph].phases
        : [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    const rawStates = morph === types_1.PathMorphAnimationType.SkewSwing
        ? buildSwingStates(bez, intensity)
        : phases.map((ph) => applyMorph(bez, morph, intensity, ph, seed));
    const states = rawStates.map((state) => quantizeBezier(state));
    const stateCount = states.length;
    const times = Array.from({ length: stateCount + 1 }, (_, idx) => (idx / stateCount) * duration);
    const kf = [];
    for (let s = 0; s < stateCount; s++) {
        const t = times[s];
        const cur = states[s];
        const nxt = states[(s + 1) % stateCount];
        kf.push({ t, s: [cur], e: [nxt], i: (0, keyframes_1.linearIn)(), o: (0, keyframes_1.linearOut)() });
    }
    kf.push({ t: duration, s: [states[0]] });
    return kf;
}
exports.buildPathMorphKeyframes = buildPathMorphKeyframes;
function convertOpentypePathToBezier(pathObj) {
    const cmds = pathObj.commands;
    if (!cmds || !cmds.length)
        return [];
    const contours = [];
    let inT = [];
    let outT = [];
    let v = [];
    for (let i = 0; i < cmds.length; i++) {
        const c = cmds[i];
        switch (c.type) {
            case 'M':
                if (v.length > 0) {
                    contours.push(quantizeBezier({ c: true, i: inT, o: outT, v }, 2));
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
                const qx = c.x1;
                const qy = c.y1;
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
        contours.push(quantizeBezier({ c: true, i: inT, o: outT, v }, 2));
    }
    return contours;
}
exports.convertOpentypePathToBezier = convertOpentypePathToBezier;
function warpHandle(vec, angle, scale) {
    if (!vec)
        return [0, 0];
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return [
        (vec[0] * cos - vec[1] * sin) * scale,
        (vec[0] * sin + vec[1] * cos) * scale,
    ];
}
function warpCornerMorph(bez, intensity, phase, seed) {
    const nV = [];
    const nI = [];
    const nO = [];
    const count = bez.v.length;
    for (let i = 0; i < count; i++) {
        const prev = bez.v[(i - 1 + count) % count];
        const curr = bez.v[i];
        const next = bez.v[(i + 1) % count];
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        let nx = -ty, ny = tx;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const amp = intensity * (0.5 + (0, noise_1.seededNoise)(seed, i) * 0.5);
        const wave = Math.sin(phase + i * 0.9 + (0, noise_1.seededNoise)(seed, 100 + i) * Math.PI);
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
function skewMorphWithK(bez, k) {
    const nV = [];
    const nI = [];
    const nO = [];
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
function warpCornerMorphAiry(bez, intensity, phase, seed) {
    const cfg = animation_config_1.pathMorphAnimationConfig[types_1.PathMorphAnimationType.WarpAiry];
    const count = bez.v.length;
    const baseDisp = [];
    const waves = [];
    const nI = [];
    const nO = [];
    const lowFreq = cfg.lowFrequency;
    const highFreq = cfg.highFrequency;
    for (let i = 0; i < count; i++) {
        const prev = bez.v[(i - 1 + count) % count];
        const curr = bez.v[i];
        const next = bez.v[(i + 1) % count];
        const tx = next[0] - prev[0];
        const ty = next[1] - prev[1];
        let nx = -ty, ny = tx;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len;
        ny /= len;
        const noiseA = (0, noise_1.seededNoise)(seed, i);
        const noiseB = (0, noise_1.seededNoise)(seed, 200 + i);
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
    const newV = [];
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
function skewMorph(bez, phase, amount) {
    const k = Math.sin(phase) * amount;
    const nV = [];
    const nI = [];
    const nO = [];
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
function applyMorph(bez, morph, intensity, phase, seed) {
    switch (morph) {
        case types_1.PathMorphAnimationType.WarpAiry:
            return warpCornerMorphAiry(bez, intensity, phase, seed);
        case types_1.PathMorphAnimationType.SkewPulse:
            return skewMorph(bez, phase, skewAmount(intensity));
        case types_1.PathMorphAnimationType.SkewSwing:
            return skewMorph(bez, phase, skewAmount(intensity) * 0.7);
        case types_1.PathMorphAnimationType.Warp:
        default:
            return warpCornerMorph(bez, intensity, phase, seed);
    }
}
function skewAmount(intensity) {
    const baseCfg = animation_config_1.pathMorphAnimationConfig[types_1.PathMorphAnimationType.SkewPulse];
    const norm = intensity > 0 ? Math.min(intensity / baseCfg.skewNormDivisor, 2) : 1;
    return Math.min(baseCfg.skewMax, Math.max(baseCfg.skewMin, baseCfg.skewBase * norm));
}
function buildSwingStates(bez, intensity) {
    const cfg = animation_config_1.pathMorphAnimationConfig[types_1.PathMorphAnimationType.SkewSwing];
    const amp = skewAmount(intensity) * cfg.swingAmplitudeScale;
    const ks = [amp, 0, -amp, 0];
    return ks.map((k) => skewMorphWithK(bez, k));
}
const PATH_MORPH_PRECISION = 2;
function quantizeNumber(value, decimals = PATH_MORPH_PRECISION) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
function quantizePoint(point, decimals = PATH_MORPH_PRECISION) {
    return [quantizeNumber(point[0], decimals), quantizeNumber(point[1], decimals)];
}
function quantizeBezier(bez, decimals = PATH_MORPH_PRECISION) {
    const quantizeList = (list) => list.map((pt) => quantizePoint(pt, decimals));
    return {
        c: bez.c,
        v: quantizeList(bez.v),
        i: quantizeList(bez.i),
        o: quantizeList(bez.o),
    };
}
//# sourceMappingURL=bezier.js.map