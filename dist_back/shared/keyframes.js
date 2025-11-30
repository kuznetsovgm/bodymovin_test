"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stitchKF = exports.lerpVecKF = exports.lerpKF = exports.sumVecKF = exports.sumKF = exports.buildVecTrack = exports.buildScalarTrack = exports.buildRawKeyframes = exports.buildValueKeyframes = exports.buildLoopKeyframes = exports.linearOut = exports.linearIn = void 0;
function linearIn() {
    return { x: [0.667], y: [1] };
}
exports.linearIn = linearIn;
function linearOut() {
    return { x: [0.333], y: [0] };
}
exports.linearOut = linearOut;
function buildLoopKeyframes(points, times) {
    return buildRawKeyframes(points, times, true);
}
exports.buildLoopKeyframes = buildLoopKeyframes;
function buildValueKeyframes(values, times, loop) {
    return buildRawKeyframes(values.map((v) => [v]), times, loop);
}
exports.buildValueKeyframes = buildValueKeyframes;
function buildRawKeyframes(points, times, loop) {
    const k = [];
    for (let i = 0; i < points.length; i++) {
        const t = times[i];
        const s = points[i];
        if (i < points.length - 1) {
            const e = points[i + 1];
            k.push({ t, s, e, i: linearIn(), o: linearOut() });
        }
        else {
            k.push({ t, s });
        }
    }
    if (loop && k.length > 0) {
        k[k.length - 1].s = points[0];
    }
    return k;
}
exports.buildRawKeyframes = buildRawKeyframes;
function buildScalarTrack(values, times, loop) {
    return buildValueKeyframes(values, times, loop);
}
exports.buildScalarTrack = buildScalarTrack;
function buildVecTrack(values, times, loop) {
    return buildRawKeyframes(values, times, loop);
}
exports.buildVecTrack = buildVecTrack;
const addValue = (a, b) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.map((v, idx) => v + (b[idx] ?? 0));
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a + b;
    }
    return b ?? a;
};
const lerpValue = (a, b, t) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.map((v, idx) => v + (b[idx] - v) * t);
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a + (b - a) * t;
    }
    return b ?? a;
};
function sumKF(trackA, trackB) {
    return trackA.map((kf, idx) => {
        const other = trackB[idx];
        if (!other)
            return kf;
        return {
            ...kf,
            s: addValue(kf.s, other.s),
            e: other.e !== undefined && kf.e !== undefined ? addValue(kf.e, other.e) : kf.e,
        };
    });
}
exports.sumKF = sumKF;
function sumVecKF(trackA, trackB) {
    return sumKF(trackA, trackB);
}
exports.sumVecKF = sumVecKF;
function lerpKF(trackA, trackB, t) {
    return trackA.map((kf, idx) => {
        const other = trackB[idx] ?? kf;
        return {
            ...kf,
            s: lerpValue(kf.s, other.s, t),
            e: other.e !== undefined && kf.e !== undefined ? lerpValue(kf.e, other.e, t) : kf.e,
        };
    });
}
exports.lerpKF = lerpKF;
function lerpVecKF(trackA, trackB, t) {
    return lerpKF(trackA, trackB, t);
}
exports.lerpVecKF = lerpVecKF;
function stitchKF(trackA = [], trackB = []) {
    if (!trackA.length)
        return trackB;
    const lastTime = trackA[trackA.length - 1].t ?? 0;
    const shifted = trackB.map((kf) => ({ ...kf, t: kf.t + lastTime }));
    return [...trackA, ...shifted];
}
exports.stitchKF = stitchKF;
//# sourceMappingURL=keyframes.js.map