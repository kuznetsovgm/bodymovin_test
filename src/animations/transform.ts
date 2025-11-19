import { ShapeLayer } from '../interfaces/lottie';
import { AnimationDescriptor, TransformAnimationType } from '../domain/types';
import { buildLoopKeyframes, buildRawKeyframes, buildValueKeyframes } from '../shared/keyframes';

export type TransformContext = {
    width: number;
    height: number;
    duration: number;
};

type TransformComposeCtx = TransformContext & { desc?: AnimationDescriptor<TransformAnimationType> };

export type TransformPatch = Partial<ShapeLayer['ks']>;

export function buildTransformPatch(
    type: TransformAnimationType,
    ctx: TransformContext,
): TransformPatch {
    const { width, height, duration } = ctx;
    switch (type) {
        case TransformAnimationType.SlideLoop: {
            const amp = width * 0.25;
            return {
                p: {
                    a: 1,
                    k: buildLoopKeyframes(
                        [
                            [width / 2 - amp, height / 2, 0],
                            [width / 2 + amp, height / 2, 0],
                            [width / 2 - amp, height / 2, 0],
                        ],
                        [0, duration / 2, duration],
                    ),
                } as any,
            };
        }
        case TransformAnimationType.ScalePulse:
            return {
                s: {
                    a: 1,
                    k: buildLoopKeyframes(
                        [
                            [90, 90, 100],
                            [120, 120, 100],
                            [90, 90, 100],
                        ],
                        [0, duration / 2, duration],
                    ),
                } as any,
            };
        case TransformAnimationType.RotateContinuous:
            return {
                r: {
                    a: 1,
                    k: buildValueKeyframes([0, 360], [0, duration], true),
                } as any,
            };
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
            return { p: { a: 1, k: buildRawKeyframes(pts, times, true) } as any };
        }
        case TransformAnimationType.Bounce: {
            const hAmp = height * 0.08;
            return {
                p: {
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
                } as any,
            };
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
            return { p: { a: 1, k: buildRawKeyframes(pts, times, true) } as any };
        }
        case TransformAnimationType.None:
        default:
            return {};
    }
}

function mergeTransform(base: ShapeLayer['ks'], patch: TransformPatch): ShapeLayer['ks'] {
    return { ...base, ...patch };
}

export function applyTransformAnimations(
    descs: AnimationDescriptor<TransformAnimationType>[] | undefined,
    baseKs: ShapeLayer['ks'],
    ctx: TransformContext,
) {
    const list = descs && descs.length ? descs : [{ type: TransformAnimationType.None }];
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

// Compose helper for layer transforms (blends base and next tracks)
export function blendLayerTransform(weightNext: number) {
    const lerpNum = (a: number, b: number) => a + (b - a) * weightNext;
    const lerpVec = (a: number[] | undefined, b: number[] | undefined) => {
        if (!a || !b) return b ?? a;
        const len = Math.min(a.length, b.length);
        return Array.from({ length: len }, (_, i) => lerpNum(a[i] ?? 0, b[i] ?? 0));
    };

    const blendAnimatedWithStatic = (animK: any, staticVal: any) => {
        if (!Array.isArray(animK)) return animK;
        const toVec = (v: any) => (Array.isArray(v) ? v : [v]);
        const sv = toVec(staticVal);
        return animK.map((kf: any) => {
            const s = Array.isArray(kf.s) ? lerpVec(sv, kf.s) : lerpNum(staticVal, kf.s);
            const e =
                kf.e !== undefined
                    ? Array.isArray(kf.e)
                        ? lerpVec(sv, kf.e)
                        : lerpNum(staticVal, kf.e)
                    : kf.e;
            return { ...kf, s, e };
        });
    };

    const blendAnimated = (bk: any, nk: any) => {
        if (!Array.isArray(bk) || !Array.isArray(nk)) return null;
        // Если треки несовместимы по длине/структуре — выбираем один из них,
        // чтобы не нарушить валидность keyframes.
        if (bk.length !== nk.length) {
            return weightNext >= 0.5 ? nk : bk;
        }
        return bk.map((kf: any, idx: number) => {
            const nkf = nk[idx];
            const s = Array.isArray(kf.s) ? lerpVec(kf.s, nkf.s) : lerpNum(kf.s, nkf.s);
            const e =
                kf.e !== undefined && nkf.e !== undefined
                    ? Array.isArray(kf.e)
                        ? lerpVec(kf.e, nkf.e)
                        : lerpNum(kf.e, nkf.e)
                    : nkf.e ?? kf.e;
            return { ...kf, s, e };
        });
    };

    const blendProp = (baseProp: any, nextProp: any) => {
        if (!nextProp) return baseProp;
        if (!baseProp) return nextProp;

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

    return (base: ShapeLayer['ks'], next: ShapeLayer['ks']) => {
        return {
            ...base,
            p: blendProp(base.p, next.p),
            s: blendProp(base.s, next.s),
            r: blendProp(base.r, next.r),
            o: blendProp(base.o, next.o),
            sk: blendProp(base.sk, next.sk),
            sa: blendProp(base.sa, next.sa),
        } as ShapeLayer['ks'];
    };
}
