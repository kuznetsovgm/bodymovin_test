import {
    ColorAnimationDescriptor,
    ColorAnimationType,
    TransformAnimationDescriptor,
    TransformAnimationType,
    ComposeFn,
} from '../domain/types';
import { Track, buildRawKeyframes } from '../shared/keyframes';
import { ShapeLayer } from '../interfaces/lottie';
import { TransformPatch, buildTransformPatch } from './transform';
import { ColorContext, buildColorTrack } from './color';

type TransformComposeCtx = {
    width: number;
    height: number;
    duration: number;
    desc: TransformAnimationDescriptor;
};
export type TransformCompose = ComposeFn<ShapeLayer['ks'], TransformComposeCtx>;

export type ColorCompose = (
    base: Track<number[]>,
    next: Track<number[]>,
    ctx: ColorContext,
) => Track<number[]>;

export function additiveTransform(base: ShapeLayer['ks'], next: ShapeLayer['ks']) {
    return { ...base, ...next };
}

export function timelineColor(
    base: Track<number[]>,
    next: Track<number[]>,
) {
    if (next.a !== 1 || !Array.isArray(next.k)) return base;
    const baseK = Array.isArray(base.k) ? base.k : buildRawKeyframes([base.k], [0], false);
    const merged = [...baseK, ...next.k].sort((a, b) => {
        const ta = typeof a === 'number' ? 0 : a.t ?? 0;
        const tb = typeof b === 'number' ? 0 : b.t ?? 0;
        return ta - tb;
    });
    return { a: 1, k: merged };
}

export function applyTransformsWithCompose(
    descs: TransformAnimationDescriptor[] | undefined,
    baseKs: ShapeLayer['ks'],
    ctx: { width: number; height: number; duration: number },
    registry?: Record<
        TransformAnimationType,
        (ctx: { width: number; height: number; duration: number }, params?: any) => TransformPatch
    >,
) {
    const list = descs && descs.length ? descs : [{ type: TransformAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce((ks, desc) => {
        const patchBuilder =
            registry && registry[desc.type]
                ? registry[desc.type]
                : (localCtx: { width: number; height: number; duration: number }, params?: any) =>
                      buildTransformPatch(desc.type, localCtx, params);
        const patch: TransformPatch = patchBuilder(ctx, desc.params);
        const proposed = { ...ks, ...patch };
        const compose = desc.compose as TransformCompose | undefined;
        const ctxWithDesc = { ...ctx, desc };
        return compose ? compose(ks, proposed, ctxWithDesc) : proposed;
    }, { ...baseKs });
}

export function applyColorsWithCompose(
    descs: ColorAnimationDescriptor[] | undefined,
    baseColor: [number, number, number],
    ctx: ColorContext,
    phase: number = 0,
    registry?: Record<
        ColorAnimationType,
        (ctx: ColorContext, phase?: number, baseColor?: [number, number, number], params?: any) => Track<number[]>
    >,
) {
    const list = descs && descs.length ? descs : [{ type: ColorAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce((track, desc) => {
        const builder =
            registry && registry[desc.type]
                ? registry[desc.type]
                : (c: ColorContext, p?: number, b?: [number, number, number], paramsOverride?: any) =>
                      buildColorTrack(desc.type, c, p, b, paramsOverride);
        const next = builder(ctx, phase, baseColor, desc.params);
        const compose = desc.compose as ColorCompose | undefined;
        return compose ? compose(track, next, ctx) : next;
    }, buildColorTrack(ColorAnimationType.None, ctx, 0, baseColor));
}

// ------- compose helpers (can be passed into AnimationDescriptor.compose) -------

export function blendTransform(weightNext: number): TransformCompose {
    return (base: ShapeLayer['ks'], next: ShapeLayer['ks']) => {
        const lerp = (a: any, b: any) => {
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
        } as ShapeLayer['ks'];
    };
}

export function priorityTransform(minPriority: number): TransformCompose {
    return (base, next, ctx) => {
        if ((ctx.desc.priority ?? 0) < minPriority) return base;
        return next;
    };
}

export function blendColor(weightNext: number): ColorCompose {
    return (
        base: Track<number[]>,
        next: Track<number[]>,
    ) => {
        if (base.a === 0 && next.a === 0) {
            const a = base.k as number[];
            const b = next.k as number[];
            const len = Math.min(a.length, b.length);
            const mixed = Array.from({ length: len }, (_, i) => a[i] + (b[i] - a[i]) * weightNext);
            return { a: 0, k: mixed };
        }
        return next;
    };
}

// Adds color components (clamped 0..1) when both tracks static; otherwise takes next
export function additiveColor(): ColorCompose {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return (
        base: Track<number[]>,
        next: Track<number[]>,
    ) => {
        if (base.a === 0 && next.a === 0) {
            const a = base.k as number[];
            const b = next.k as number[];
            const len = Math.min(a.length, b.length);
            return { a: 0, k: Array.from({ length: len }, (_, i) => clamp((a[i] ?? 0) + (b[i] ?? 0))) as any };
        }
        return next;
    };
}
