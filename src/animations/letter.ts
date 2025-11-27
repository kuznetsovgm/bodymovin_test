import { TransformShape, ShapeType } from '../interfaces/lottie';
import { ComposeFn, LetterAnimationDescriptor, LetterAnimationType } from '../domain/types';
import { buildRawKeyframes, buildValueKeyframes, linearIn, linearOut } from '../shared/keyframes';
import { letterAnimationConfig } from '../config/animation-config';

export type LetterContext = {
    letterIndex: number;
    x: number;
    y: number;
    duration: number;
    canvasHeight: number;
};

function createBaseTransform(index: number, x: number, y: number): TransformShape {
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

export function buildLetterTransform(
    type: LetterAnimationType,
    ctx: LetterContext,
    params?: any,
): TransformShape {
    const { letterIndex, x, y, duration, canvasHeight } = ctx;
    switch (type) {
        case LetterAnimationType.Vibrate: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.Vibrate],
                ...(params ?? {}),
            };
            const intensity = cfg.intensity;
            const steps = cfg.steps;
            const pts: number[][] = [];
            const times: number[] = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                pts.push([
                    x + (Math.random() - 0.5) * intensity * 2,
                    y + (Math.random() - 0.5) * intensity * 2,
                ]);
                times.push(t);
            }
            return {
                ...createBaseTransform(letterIndex, x, y),
                p: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 2 } as any,
            };
        }
        case LetterAnimationType.TypingFall: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.TypingFall],
                ...(params ?? {}),
            };
            const delay = letterIndex * duration * cfg.delayPerLetterFactor;
            const fallDur = duration * cfg.fallDurationFactor;
            const startY = y - canvasHeight * cfg.startYOffsetFactor;
            const kf = [
                { t: 0, s: [x, startY], e: [x, startY], i: linearIn(), o: linearOut() },
                { t: delay, s: [x, startY], e: [x, y], i: linearIn(), o: linearOut() },
                { t: Math.min(delay + fallDur, duration), s: [x, y] },
            ];
            return {
                ...createBaseTransform(letterIndex, x, y),
                p: { a: 1, k: kf, ix: 2 } as any,
            };
        }
        case LetterAnimationType.Wave: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.Wave],
                ...(params ?? {}),
            };
            const amp = cfg.amplitude;
            const steps = cfg.steps;
            const pts: number[][] = [];
            const times: number[] = [];
            const phase = letterIndex * cfg.phasePerLetter;
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                const angle = phase + (2 * Math.PI * t) / duration;
                pts.push([x, y + Math.sin(angle) * amp]);
                times.push(t);
            }
            return {
                ...createBaseTransform(letterIndex, x, y),
                p: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 2 } as any,
            };
        }
        case LetterAnimationType.ZigZag: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.ZigZag],
                ...(params ?? {}),
            };
            const spread = cfg.spread;
            const steps = cfg.steps;
            const pts: number[][] = [];
            const times: number[] = [];
            const phase = letterIndex * cfg.phasePerLetter;
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                const angle = phase + (2 * Math.PI * t) / duration;
                const sy = cfg.baseScale + Math.sin(angle) * spread;
                pts.push([cfg.baseScale, sy]);
                times.push(t);
            }
            return {
                ...createBaseTransform(letterIndex, x, y),
                s: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 3 } as any,
            };
        }
        case LetterAnimationType.Rotate: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.Rotate],
                ...(params ?? {}),
            };
            const base = createBaseTransform(letterIndex, x, y);
            return {
                ...base,
                r: {
                    a: 1,
                    k: buildRawKeyframes(
                        [cfg.fromAngle, cfg.toAngle],
                        [0, duration],
                        cfg.loop,
                    ),
                    ix: 6,
                } as any,
            };
        }
        case LetterAnimationType.None:
        default:
            return createBaseTransform(letterIndex, x, y);
    }
}

export function applyLetterAnimations(
    descs: LetterAnimationDescriptor[] | undefined,
    ctx: LetterContext,
): TransformShape {
    const list = descs && descs.length ? descs : [{ type: LetterAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce<TransformShape | null>((acc, desc) => {
        const next = buildLetterTransform(desc.type, ctx, desc.params);
        if (!acc) return next;
        const compose = desc.compose as ComposeFn<TransformShape, LetterContext> | undefined;
        return compose ? compose(acc, next, ctx) : next;
    }, null) as TransformShape;
}

// Compose helper for letter transforms (mixes position/scale/rotation/opacities)
export function blendLetterTransform(weightNext: number) {
    return (base: TransformShape, next: TransformShape) => {
        const lerpNum = (a: number, b: number) => a + (b - a) * weightNext;
        const lerpVec = (a: number[] | undefined, b: number[] | undefined) => {
            if (!a || !b) return b ?? a;
            return a.map((v, i) => lerpNum(v, b[i] ?? v));
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
            if (bk.length !== nk.length) return null;
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
            // blend two static values
            if (!baseAnimated && !nextAnimated) {
                const blended = Array.isArray(baseProp.k)
                    ? lerpVec(baseProp.k, nextProp.k)
                    : lerpNum(baseProp.k, nextProp.k);
                return { ...baseProp, k: blended };
            }
            // both animated -> try blend frame by frame; if mismatch, keep base to preserve animation
            if (baseAnimated && nextAnimated) {
                const merged = blendAnimated(baseProp.k, nextProp.k);
                return merged ? { ...baseProp, k: merged } : baseProp;
            }
            // one animated, one static -> blend static value into animated keys
            if (baseAnimated && !nextAnimated) {
                return { ...baseProp, k: blendAnimatedWithStatic(baseProp.k, nextProp.k) };
            }
            if (!baseAnimated && nextAnimated) {
                return { ...nextProp, k: blendAnimatedWithStatic(nextProp.k, baseProp.k) };
            }
            return baseProp;
        };

        return {
            ...base,
            p: blendProp(base.p, next.p),
            s: blendProp(base.s, next.s),
            r: blendProp(base.r, next.r),
            o: blendProp(base.o, next.o),
        } as TransformShape;
    };
}

// Sum numeric/vector components where возможно, иначе берёт next
export function additiveLetterTransform() {
    return (base: TransformShape, next: TransformShape) => {
        const sumNum = (a: number, b: number) => a + b;
        const sumVec = (a: number[] | undefined, b: number[] | undefined) => {
            if (!a || !b) return b ?? a;
            return a.map((v, i) => v + (b[i] ?? 0));
        };
        const addProp = (bp: any, np: any) => {
            if (!np && !bp) return undefined;
            if (!np) return bp;
            if (!bp) return np;
            // обе статичные: берём следующий патч (не суммируем, чтобы не раздувать statics)
            if (bp.a === 0 && np.a === 0) {
                return np;
            }
            if (bp.a === 1 && np.a === 1 && Array.isArray(bp.k) && Array.isArray(np.k)) {
                if (bp.k.length !== np.k.length) return np;
                return {
                    ...bp,
                    k: bp.k.map((kf: any, idx: number) => {
                        const nkf = np.k[idx];
                        const s = Array.isArray(kf.s) ? sumVec(kf.s, nkf.s) : sumNum(kf.s, nkf.s);
                        const e =
                            kf.e !== undefined && nkf.e !== undefined
                                ? Array.isArray(kf.e)
                                    ? sumVec(kf.e, nkf.e)
                                    : sumNum(kf.e, nkf.e)
                                : nkf.e ?? kf.e;
                        return { ...kf, s, e };
                    }),
                };
            }
            // если один animated, другой static — добавляем static к каждому ключу animated
            if (bp.a === 1 && np.a === 0 && Array.isArray(bp.k)) {
                return {
                    ...bp,
                    k: bp.k.map((kf: any) => {
                        const s = Array.isArray(kf.s) ? sumVec(kf.s, np.k) : sumNum(kf.s, np.k);
                        const e =
                            kf.e !== undefined
                                ? Array.isArray(kf.e)
                                    ? sumVec(kf.e, np.k)
                                    : sumNum(kf.e, np.k)
                                : kf.e;
                        return { ...kf, s, e };
                    }),
                };
            }
            if (bp.a === 0 && np.a === 1 && Array.isArray(np.k)) {
                return {
                    ...np,
                    k: np.k.map((kf: any) => {
                        const s = Array.isArray(kf.s) ? sumVec(bp.k, kf.s) : sumNum(bp.k, kf.s);
                        const e =
                            kf.e !== undefined
                                ? Array.isArray(kf.e)
                                    ? sumVec(bp.k, kf.e)
                                    : sumNum(bp.k, kf.e)
                                : kf.e;
                        return { ...kf, s, e };
                    }),
                };
            }
            return np;
        };
        return {
            ...base,
            p: addProp(base.p, next.p),
            s: addProp(base.s, next.s),
            r: addProp(base.r, next.r),
            o: addProp(base.o, next.o),
        } as TransformShape;
    };
}
