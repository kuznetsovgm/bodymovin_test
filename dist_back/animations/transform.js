"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blendLayerTransform = exports.applyTransformAnimations = exports.buildTransformPatch = void 0;
const types_1 = require("../domain/types");
const keyframes_1 = require("../shared/keyframes");
const animation_config_1 = require("../config/animation-config");
function buildTransformPatch(type, ctx, params) {
    const { width, height, duration } = ctx;
    switch (type) {
        case types_1.TransformAnimationType.SlideLoop: {
            const cfg = {
                ...animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.SlideLoop],
                ...(params ?? {}),
            };
            const amp = width * cfg.amplitudeXFactor;
            return {
                p: {
                    a: 1,
                    k: (0, keyframes_1.buildLoopKeyframes)([
                        [width / 2 - amp, height / 2, 0],
                        [width / 2 + amp, height / 2, 0],
                        [width / 2 - amp, height / 2, 0],
                    ], [0, duration / 2, duration]),
                },
            };
        }
        case types_1.TransformAnimationType.ScalePulse:
            return {
                s: {
                    a: 1,
                    k: (0, keyframes_1.buildLoopKeyframes)([
                        [
                            (params?.minScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].minScale),
                            (params?.minScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].minScale),
                            100,
                        ],
                        [
                            (params?.maxScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].maxScale),
                            (params?.maxScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].maxScale),
                            100,
                        ],
                        [
                            (params?.minScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].minScale),
                            (params?.minScale ??
                                animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ScalePulse].minScale),
                            100,
                        ],
                    ], [0, duration / 2, duration]),
                },
            };
        case types_1.TransformAnimationType.RotateContinuous:
            return {
                r: {
                    a: 1,
                    k: (0, keyframes_1.buildValueKeyframes)([
                        (params?.fromAngle ??
                            animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.RotateContinuous].fromAngle),
                        (params?.toAngle ??
                            animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.RotateContinuous].toAngle),
                    ], [0, duration], true),
                },
            };
        case types_1.TransformAnimationType.ShakeLoop: {
            const cfg = {
                ...animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.ShakeLoop],
                ...(params ?? {}),
            };
            const steps = Math.max(4, Math.ceil(cfg.steps * 0.5));
            const intensity = cfg.intensity;
            const pts = [];
            const times = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                const off = (f % 2 === 0 ? intensity : -intensity) * (1 - f / steps);
                pts.push([width / 2 + off, height / 2, 0]);
                times.push(t);
            }
            pts[pts.length - 1] = [width / 2, height / 2, 0];
            return { p: { a: 1, k: (0, keyframes_1.buildRawKeyframes)(pts, times, true) } };
        }
        case types_1.TransformAnimationType.Bounce: {
            const cfg = {
                ...animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.Bounce],
                ...(params ?? {}),
            };
            const hAmp = height * cfg.heightAmplitudeFactor;
            return {
                p: {
                    a: 1,
                    k: (0, keyframes_1.buildLoopKeyframes)([
                        [width / 2, height / 2, 0],
                        [width / 2, height / 2 - hAmp, 0],
                        [width / 2, height / 2, 0],
                        [width / 2, height / 2 - hAmp * cfg.secondaryBounceFactor, 0],
                        [width / 2, height / 2, 0],
                    ], [0, duration * 0.25, duration * 0.5, duration * 0.75, duration]),
                },
            };
        }
        case types_1.TransformAnimationType.Vibrate: {
            const cfg = {
                ...animation_config_1.transformAnimationConfig[types_1.TransformAnimationType.Vibrate],
                ...(params ?? {}),
            };
            const steps = Math.max(8, Math.ceil(cfg.steps * 0.4));
            const intensity = cfg.intensity;
            const pts = [];
            const times = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                pts.push([
                    width / 2 + (Math.random() - 0.5) * intensity * 2,
                    height / 2 + (Math.random() - 0.5) * intensity * 2,
                    0,
                ]);
                times.push(t);
            }
            return { p: { a: 1, k: (0, keyframes_1.buildRawKeyframes)(pts, times, true) } };
        }
        case types_1.TransformAnimationType.None:
        default:
            return {
                p: {
                    a: 1,
                    k: (0, keyframes_1.buildLoopKeyframes)([
                        [width / 2, height / 2, 0],
                        [width / 2, height / 2, 0],
                    ], [0, duration]),
                },
            };
    }
}
exports.buildTransformPatch = buildTransformPatch;
function mergeTransform(base, patch) {
    return { ...base, ...patch };
}
function applyTransformAnimations(descs, baseKs, ctx) {
    const list = descs && descs.length ? descs : [{ type: types_1.TransformAnimationType.None }];
    return list
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .reduce((ks, desc) => {
        const patch = buildTransformPatch(desc.type, ctx);
        const composed = desc.compose
            ? desc.compose(ks, mergeTransform(ks, patch), ctx)
            : mergeTransform(ks, patch);
        return composed;
    }, { ...baseKs });
}
exports.applyTransformAnimations = applyTransformAnimations;
// Compose helper for layer transforms (blends base and next tracks)
function blendLayerTransform(weightNext) {
    const lerpNum = (a, b) => a + (b - a) * weightNext;
    const lerpVec = (a, b) => {
        if (!a || !b)
            return b ?? a;
        const len = Math.min(a.length, b.length);
        return Array.from({ length: len }, (_, i) => lerpNum(a[i] ?? 0, b[i] ?? 0));
    };
    const blendAnimatedWithStatic = (animK, staticVal) => {
        if (!Array.isArray(animK))
            return animK;
        const toVec = (v) => (Array.isArray(v) ? v : [v]);
        const sv = toVec(staticVal);
        return animK.map((kf) => {
            const s = Array.isArray(kf.s) ? lerpVec(sv, kf.s) : lerpNum(staticVal, kf.s);
            const e = kf.e !== undefined
                ? Array.isArray(kf.e)
                    ? lerpVec(sv, kf.e)
                    : lerpNum(staticVal, kf.e)
                : kf.e;
            return { ...kf, s, e };
        });
    };
    const blendAnimated = (bk, nk) => {
        if (!Array.isArray(bk) || !Array.isArray(nk))
            return null;
        // Если треки несовместимы по длине/структуре — выбираем один из них,
        // чтобы не нарушить валидность keyframes.
        if (bk.length !== nk.length) {
            return weightNext >= 0.5 ? nk : bk;
        }
        return bk.map((kf, idx) => {
            const nkf = nk[idx];
            const s = Array.isArray(kf.s) ? lerpVec(kf.s, nkf.s) : lerpNum(kf.s, nkf.s);
            const e = kf.e !== undefined && nkf.e !== undefined
                ? Array.isArray(kf.e)
                    ? lerpVec(kf.e, nkf.e)
                    : lerpNum(kf.e, nkf.e)
                : nkf.e ?? kf.e;
            return { ...kf, s, e };
        });
    };
    const blendProp = (baseProp, nextProp) => {
        if (!nextProp)
            return baseProp;
        if (!baseProp)
            return nextProp;
        const baseAnimated = baseProp.a === 1;
        const nextAnimated = nextProp.a === 1;
        if (!baseAnimated && !nextAnimated) {
            const blended = Array.isArray(baseProp.k)
                ? lerpVec(baseProp.k, nextProp.k)
                : lerpNum(baseProp.k, nextProp.k);
            return { ...baseProp, k: blended };
        }
        if (baseAnimated && nextAnimated) {
            const merged = blendAnimated(baseProp.k, nextProp.k);
            return merged ? { ...nextProp, k: merged, a: 1 } : { ...nextProp, a: 1 };
        }
        if (baseAnimated && !nextAnimated) {
            return { ...baseProp, k: blendAnimatedWithStatic(baseProp.k, nextProp.k) };
        }
        if (!baseAnimated && nextAnimated) {
            return { ...nextProp, k: blendAnimatedWithStatic(nextProp.k, baseProp.k) };
        }
        return baseProp;
    };
    return (base, next) => {
        return {
            ...base,
            p: blendProp(base.p, next.p),
            s: blendProp(base.s, next.s),
            r: blendProp(base.r, next.r),
            o: blendProp(base.o, next.o),
            sk: blendProp(base.sk, next.sk),
            sa: blendProp(base.sa, next.sa),
        };
    };
}
exports.blendLayerTransform = blendLayerTransform;
//# sourceMappingURL=transform.js.map