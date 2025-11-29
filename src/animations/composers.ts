import {
    ColorAnimationDescriptor,
    ColorAnimationType,
    TransformAnimationDescriptor,
    TransformAnimationType,
    ComposeFn,
} from '../domain/types';
import { Track, Keyframe, buildRawKeyframes } from '../shared/keyframes';
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

// Registries for string-based compose identifiers (used in configs/UI)
export const transformComposeRegistry: Record<string, TransformCompose> = {
    add: additiveTransform,
    blend: blendTransform(0.5),
};

export const colorComposeRegistry: Record<string, ColorCompose> = {
    add: additiveColor(),
    mul: multiplyColor(),
    blend: blendColor(0.5),
};

export function additiveTransform(base: ShapeLayer['ks'], next: ShapeLayer['ks']) {
    return { ...base, ...next };
}

export function timelineColor(
    base: Track<number[]>,
    next: Track<number[]>,
): Track<number[]> {
    if (next.a !== 1 || !Array.isArray(next.k)) return base;
    const baseK: Keyframe<number[]>[] = Array.isArray(base.k)
        ? (base.k as Keyframe<number[]>[])
        : buildRawKeyframes(base.k as number[][], [0], false);
    const nextK = next.k as Keyframe<number[]>[];
    const merged = [...baseK, ...nextK].sort((a, b) => {
        const ta = a.t ?? 0;
        const tb = b.t ?? 0;
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
        let compose: TransformCompose | undefined;
        if (typeof desc.compose === 'string') {
            compose = transformComposeRegistry[desc.compose] as TransformCompose | undefined;
        } else {
            compose = desc.compose as TransformCompose | undefined;
        }
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
        let compose: ColorCompose | undefined;
        if (typeof desc.compose === 'string') {
            compose = colorComposeRegistry[desc.compose] as ColorCompose | undefined;
        } else {
            compose = desc.compose as ColorCompose | undefined;
        }
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

// Adds color components (clamped 0..1) для статичных и анимированных треков
export function additiveColor(): ColorCompose {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return (
        base: Track<number[]>,
        next: Track<number[]>,
    ) => {
        // оба статичные
        if (base.a === 0 && next.a === 0) {
            const a = base.k as number[];
            const b = next.k as number[];
            const len = Math.min(a.length, b.length);
            return {
                a: 0,
                k: Array.from({ length: len }, (_, i) => clamp((a[i] ?? 0) + (b[i] ?? 0))) as any,
            };
        }

        // оба анимированные и совместимы по длине
        if (base.a === 1 && next.a === 1 && Array.isArray(base.k) && Array.isArray(next.k)) {
            const bk = base.k as Keyframe<number[]>[];
            const nk = next.k as Keyframe<number[]>[];
            if (bk.length === nk.length) {
                const merged = bk.map((kf, idx) => {
                    const other = nk[idx];
                    const sum = (a: number[], b: number[]) =>
                        a.map((v, i) => clamp((v ?? 0) + (b[i] ?? 0)));
                    const s = Array.isArray(kf.s) && Array.isArray(other.s) ? sum(kf.s, other.s) : kf.s;
                    const e =
                        kf.e && other.e && Array.isArray(kf.e) && Array.isArray(other.e)
                            ? sum(kf.e, other.e)
                            : kf.e ?? other.e;
                    return { ...kf, s, e };
                });
                return { a: 1, k: merged };
            }
        }

        // базовый анимированный, next статичный
        if (base.a === 1 && next.a === 0 && Array.isArray(base.k)) {
            const offset = next.k as number[];
            const bk = base.k as Keyframe<number[]>[];
            const merged = bk.map((kf) => {
                const add = (a: number[]) => a.map((v, i) => clamp((v ?? 0) + (offset[i] ?? 0)));
                const s = Array.isArray(kf.s) ? add(kf.s) : kf.s;
                const e = Array.isArray(kf.e) ? add(kf.e) : kf.e;
                return { ...kf, s, e };
            });
            return { a: 1, k: merged };
        }

        // базовый статичный, next анимированный
        if (base.a === 0 && next.a === 1 && Array.isArray(next.k)) {
            const offset = base.k as number[];
            const nk = next.k as Keyframe<number[]>[];
            const merged = nk.map((kf) => {
                const add = (a: number[]) => a.map((v, i) => clamp((v ?? 0) + (offset[i] ?? 0)));
                const s = Array.isArray(kf.s) ? add(kf.s) : kf.s;
                const e = Array.isArray(kf.e) ? add(kf.e) : kf.e;
                return { ...kf, s, e };
            });
            return { a: 1, k: merged };
        }

        // fallback — берём next, чтобы не ломать анимацию
        return next;
    };
}

// Multiplies color components (clamped 0..1) для статичных и анимированных треков
export function multiplyColor(): ColorCompose {
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    return (
        base: Track<number[]>,
        next: Track<number[]>,
    ) => {
        // оба статичные
        if (base.a === 0 && next.a === 0) {
            const a = base.k as number[];
            const b = next.k as number[];
            const len = Math.min(a.length, b.length);
            return {
                a: 0,
                k: Array.from(
                    { length: len },
                    (_, i) => clamp((a[i] ?? 1) * (b[i] ?? 1)),
                ) as any,
            };
        }

        // оба анимированные и совместимы по длине
        if (base.a === 1 && next.a === 1 && Array.isArray(base.k) && Array.isArray(next.k)) {
            const bk = base.k as Keyframe<number[]>[];
            const nk = next.k as Keyframe<number[]>[];
            if (bk.length === nk.length) {
                const merged = bk.map((kf, idx) => {
                    const other = nk[idx];
                    const mul = (a: number[], b: number[]) =>
                        a.map((v, i) => clamp((v ?? 1) * (b[i] ?? 1)));
                    const s = Array.isArray(kf.s) && Array.isArray(other.s) ? mul(kf.s, other.s) : kf.s;
                    const e =
                        kf.e && other.e && Array.isArray(kf.e) && Array.isArray(other.e)
                            ? mul(kf.e, other.e)
                            : kf.e ?? other.e;
                    return { ...kf, s, e };
                });
                return { a: 1, k: merged };
            }
        }

        // базовый анимированный, next статичный
        if (base.a === 1 && next.a === 0 && Array.isArray(base.k)) {
            const factor = next.k as number[];
            const bk = base.k as Keyframe<number[]>[];
            const merged = bk.map((kf) => {
                const mul = (a: number[]) => a.map((v, i) => clamp((v ?? 1) * (factor[i] ?? 1)));
                const s = Array.isArray(kf.s) ? mul(kf.s) : kf.s;
                const e = Array.isArray(kf.e) ? mul(kf.e) : kf.e;
                return { ...kf, s, e };
            });
            return { a: 1, k: merged };
        }

        // базовый статичный, next анимированный
        if (base.a === 0 && next.a === 1 && Array.isArray(next.k)) {
            const factor = base.k as number[];
            const nk = next.k as Keyframe<number[]>[];
            const merged = nk.map((kf) => {
                const mul = (a: number[]) => a.map((v, i) => clamp((v ?? 1) * (factor[i] ?? 1)));
                const s = Array.isArray(kf.s) ? mul(kf.s) : kf.s;
                const e = Array.isArray(kf.e) ? mul(kf.e) : kf.e;
                return { ...kf, s, e };
            });
            return { a: 1, k: merged };
        }

        // fallback — берём next
        return next;
    };
}
