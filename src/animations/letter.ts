import { TransformShape, ShapeType, MultiDimensional, OffsetKeyframe } from '../interfaces/lottie';
import { ComposeFn, LetterAnimationDescriptor, LetterAnimationType, LetterContext } from '../domain/types';
import {
    buildRawKeyframes,
    buildValueKeyframes,
    buildVecTrack,
    Keyframe,
    linearIn,
    linearOut,
} from '../shared/keyframes';
import { FRACTION_DIGITS, letterAnimationConfig } from '../config/animation-config';

function createBaseTransform(index: number, x: number, y: number, anchorX = 0, anchorY = 0): TransformShape {
    return {
        cix: 200 + index,
        ty: ShapeType.TransformShape,
        bm: 0,
        nm: `Transform_${index}`,
        hd: false,
        // компенсируем anchor, чтобы буква визуально оставалась на месте
        p: { a: 0, k: [x + anchorX, y + anchorY], ix: 2 },
        a: { a: 0, k: [anchorX, anchorY], ix: 1 },
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
    const { letterIndex, x, y, duration, canvasHeight, anchorX = 0, anchorY = 0 } = ctx;
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
                    +(x + anchorX + (Math.random() - 0.5) * intensity * 2).toFixed(FRACTION_DIGITS),
                    +(y + anchorY + (Math.random() - 0.5) * intensity * 2).toFixed(FRACTION_DIGITS),
                ]);
                times.push(+(t).toFixed(FRACTION_DIGITS));
            }
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
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
                { t: 0, s: [x + anchorX, startY + anchorY], e: [x + anchorX, startY + anchorY], i: linearIn(), o: linearOut() },
                { t: delay, s: [x + anchorX, startY + anchorY], e: [x + anchorX, y + anchorY], i: linearIn(), o: linearOut() },
                { t: Math.min(delay + fallDur, duration), s: [x + anchorX, y + anchorY] },
            ];
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
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
                pts.push([x + anchorX, y + anchorY + Math.sin(angle) * amp]);
                times.push(+(t).toFixed(FRACTION_DIGITS));
            }
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
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
                times.push(+(t).toFixed(FRACTION_DIGITS));
            }
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
                s: { a: 1, k: buildRawKeyframes(pts, times, true), ix: 3 } as any,
            };
        }
        case LetterAnimationType.Rotate: {
            const cfg = {
                ...letterAnimationConfig[LetterAnimationType.Rotate],
                ...(params ?? {}),
            };
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
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
        case LetterAnimationType.SnakeScale: {
            const cfg = { ...letterAnimationConfig[LetterAnimationType.SnakeScale], ...(params ?? {}) };
            const windowSize = Math.max(1, Math.round(cfg.windowSize || 1));
            const minScale = Math.max(0, cfg.minScale || 0);
            const maxScale = Math.max(minScale, cfg.maxScale || minScale);
            const steps = Math.max(4, Math.round(cfg.steps || 16));
            const totalLetters = typeof ctx.lettersCount === 'number' ? Math.max(1, ctx.lettersCount) : Math.max(1, letterIndex + 1);
            const idx = cfg.reverse ? totalLetters - 1 - letterIndex : letterIndex;
            const times: number[] = [];
            const values: number[][] = [];
            for (let f = 0; f <= steps; f++) {
                const tNorm = f / steps;
                const head = tNorm * (totalLetters + windowSize);
                const dist = head - idx;
                let factor: number;
                if (dist < 0 || dist > windowSize) {
                    factor = 0;
                } else {
                    const edge = Math.min(dist, windowSize - dist);
                    factor = 1 - edge / Math.max(1, windowSize);
                }
                const scale = minScale + (maxScale - minScale) * factor;
                times.push(tNorm * duration);
                values.push([scale, scale]);
            }
            const kf = buildVecTrack(values, times, true);
            return {
                ...createBaseTransform(letterIndex, x, y, anchorX, anchorY),
                s: { a: 1, k: kf as any, ix: 3 } as any,
            };
        }
        case LetterAnimationType.None:
        default:
            return createBaseTransform(letterIndex, x, y, anchorX, anchorY);
    }
}

export function applyLetterAnimations(
    descs: LetterAnimationDescriptor[] | undefined,
    ctx: LetterContext,
): TransformShape {
    const list = descs && descs.length ? descs : [{ type: LetterAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const composed = sorted.reduce<TransformShape | null>((acc, desc) => {
        const next = buildLetterTransform(desc.type, ctx, desc.params);
        if (!acc) return next;
        const compose = desc.compose as ComposeFn<TransformShape, LetterContext> | undefined;
        return compose ? compose(acc, next, ctx) : next;
    }, null) as TransformShape;
    const scaleFactor = Math.max(0, typeof ctx.scaleFactor === 'number' ? ctx.scaleFactor : 1);
    const scaled = scaleFactor === 1 ? composed : applyScaleFactorToTransform(composed, scaleFactor);
    const rotationDeg = typeof ctx.curveRotation === 'number' ? ctx.curveRotation : 0;
    return Math.abs(rotationDeg) < 1e-6 ? scaled : applyCurveRotationToTransform(scaled, rotationDeg);
}

function applyScaleFactorToTransform(transform: TransformShape, scaleFactor: number): TransformShape {
    if (!transform || scaleFactor === 1) return transform;
    const scaled: TransformShape = { ...transform };
    if (transform.s) {
        scaled.s = scaleMultiDimensional(transform.s, scaleFactor);
    }
    return scaled;
}

function scaleMultiDimensional(value: MultiDimensional, factor: number): MultiDimensional {
    if (!value || !Array.isArray(value.k)) return value;
    const scaled: MultiDimensional = { ...value };
    if (value.k.length === 0) {
        scaled.k = [];
        return scaled;
    }
    const first = value.k[0];
    if (typeof first === 'number') {
        scaled.k = (value.k as number[]).map((v) => v * factor);
        return scaled;
    }
    scaled.k = (value.k as Keyframe<number[]>[]).map((kf) => scaleKeyframe(kf, factor));
    return scaled;
}

function scaleKeyframe(kf: Keyframe<number[]>, factor: number): Keyframe<number[]> {
    return {
        ...kf,
        s: scaleVector(kf.s, factor),
        e: kf.e !== undefined ? scaleVector(kf.e, factor) : undefined,
    };
}

function scaleVector(value: number[], factor: number): number[] {
    return value.map((v) => v * factor);
}

function applyCurveRotationToTransform(transform: TransformShape, rotationDeg: number): TransformShape {
    if (!transform) return transform;
    if (!rotationDeg) return transform;
    const rotated: TransformShape = { ...transform };
    const existing = transform.r || { a: 0, k: 0 };
    rotated.r = {
        ...existing,
        k: addRotationValue(existing.k, rotationDeg),
    };
    return rotated;
}

function addRotationValue(
    value: number | number[] | OffsetKeyframe[] | undefined,
    delta: number,
): number | number[] | OffsetKeyframe[] {
    if (value === undefined) return delta;
    if (typeof value === 'number') {
        return value + delta;
    }
    if (Array.isArray(value)) {
        if (isOffsetKeyframeArray(value)) {
            const kfArray = value as OffsetKeyframe[];
            const rotated = kfArray.map((kf) => ({
                ...kf,
                s: addRotationValue(kf.s as number | number[] | undefined, delta) as number | number[],
                e:
                    kf.e !== undefined
                        ? (addRotationValue(kf.e as number | number[] | undefined, delta) as number | number[])
                        : undefined,
            })) as OffsetKeyframe[];
            return rotated;
        }
        const numbers = value as number[];
        return numbers.map((entry) => entry + delta);
    }
    return value;
}

function isOffsetKeyframeArray(arr: any[]): arr is OffsetKeyframe[] {
    return (
        arr.length > 0 &&
        arr[0] !== null &&
        typeof arr[0] === 'object' &&
        't' in arr[0]
    );
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
