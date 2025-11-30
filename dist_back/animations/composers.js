"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.additiveColor = exports.blendColor = exports.priorityTransform = exports.blendTransform = exports.applyColorsWithCompose = exports.applyTransformsWithCompose = exports.timelineColor = exports.additiveTransform = void 0;
const types_1 = require("../domain/types");
const keyframes_1 = require("../shared/keyframes");
const transform_1 = require("./transform");
const color_1 = require("./color");
function additiveTransform(base, next) {
    return { ...base, ...next };
}
exports.additiveTransform = additiveTransform;
function timelineColor(base, next) {
    if (next.a !== 1 || !Array.isArray(next.k))
        return base;
    const baseK = Array.isArray(base.k) ? base.k : (0, keyframes_1.buildRawKeyframes)([base.k], [0], false);
    const merged = [...baseK, ...next.k].sort((a, b) => {
        const ta = typeof a === 'number' ? 0 : a.t ?? 0;
        const tb = typeof b === 'number' ? 0 : b.t ?? 0;
        return ta - tb;
    });
    return { a: 1, k: merged };
}
exports.timelineColor = timelineColor;
function applyTransformsWithCompose(descs, baseKs, ctx, registry) {
    const list = descs && descs.length ? descs : [{ type: types_1.TransformAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce((ks, desc) => {
        const patchBuilder = registry && registry[desc.type]
            ? registry[desc.type]
            : (localCtx, params) => (0, transform_1.buildTransformPatch)(desc.type, localCtx, params);
        const patch = patchBuilder(ctx, desc.params);
        const proposed = { ...ks, ...patch };
        const compose = desc.compose;
        const ctxWithDesc = { ...ctx, desc };
        return compose ? compose(ks, proposed, ctxWithDesc) : proposed;
    }, { ...baseKs });
}
exports.applyTransformsWithCompose = applyTransformsWithCompose;
function applyColorsWithCompose(descs, baseColor, ctx, phase = 0, registry) {
    const list = descs && descs.length ? descs : [{ type: types_1.ColorAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce((track, desc) => {
        const builder = registry && registry[desc.type]
            ? registry[desc.type]
            : (c, p, b, paramsOverride) => (0, color_1.buildColorTrack)(desc.type, c, p, b, paramsOverride);
        const next = builder(ctx, phase, baseColor, desc.params);
        const compose = desc.compose;
        return compose ? compose(track, next, ctx) : next;
    }, (0, color_1.buildColorTrack)(types_1.ColorAnimationType.None, ctx, 0, baseColor));
}
exports.applyColorsWithCompose = applyColorsWithCompose;
// ------- compose helpers (can be passed into AnimationDescriptor.compose) -------
function blendTransform(weightNext) {
    return (base, next) => {
        const lerp = (a, b) => {
            if (Array.isArray(a) && Array.isArray(b)) {
                return a.map((v, i) => v + (b[i] - v) * weightNext);
            }
            if (typeof a === 'number' && typeof b === 'number') {
                return a + (b - a) * weightNext;
            }
            return b ?? a;
        };
        return {
            ...base,
            p: next.p ?? base.p,
            s: next.s ?? base.s,
            r: lerp(base.r, next.r),
            o: lerp(base.o, next.o),
        };
    };
}
exports.blendTransform = blendTransform;
function priorityTransform(minPriority) {
    return (base, next, ctx) => {
        if ((ctx.desc.priority ?? 0) < minPriority)
            return base;
        return next;
    };
}
exports.priorityTransform = priorityTransform;
function blendColor(weightNext) {
    return (base, next) => {
        if (base.a === 0 && next.a === 0) {
            const a = base.k;
            const b = next.k;
            const len = Math.min(a.length, b.length);
            const mixed = Array.from({ length: len }, (_, i) => a[i] + (b[i] - a[i]) * weightNext);
            return { a: 0, k: mixed };
        }
        return next;
    };
}
exports.blendColor = blendColor;
// Adds color components (clamped 0..1) when both tracks static; otherwise takes next
function additiveColor() {
    const clamp = (v) => Math.max(0, Math.min(1, v));
    return (base, next) => {
        if (base.a === 0 && next.a === 0) {
            const a = base.k;
            const b = next.k;
            const len = Math.min(a.length, b.length);
            return { a: 0, k: Array.from({ length: len }, (_, i) => clamp((a[i] ?? 0) + (b[i] ?? 0))) };
        }
        return next;
    };
}
exports.additiveColor = additiveColor;
//# sourceMappingURL=composers.js.map