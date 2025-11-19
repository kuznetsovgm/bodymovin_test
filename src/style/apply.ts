import { AnimationDescriptor, ColorAnimationType } from '../domain/types';
import { FillShape, StrokeShape } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';
import { applyColorsWithCompose } from '../animations/composers';
import { colorRegistry } from '../animations/registry';
import { ShapeType, LineCapType, LineJoinType } from '../interfaces/lottie';

type StyleContext = {
    duration: number;
    strokeWidth: number;
    strokeColor: [number, number, number];
    fillColor?: [number, number, number];
    letterPhase: number;
    letterIndex: number;
};

export function buildLetterStyles(
    colorAnimations: AnimationDescriptor<ColorAnimationType>[] | undefined,
    strokeAnimations: AnimationDescriptor<ColorAnimationType>[] | undefined,
    ctx: StyleContext,
): { fill?: FillShape; stroke?: StrokeShape } {
    const { duration, strokeWidth, strokeColor, fillColor, letterPhase, letterIndex } = ctx;

    const out: { fill?: FillShape; stroke?: StrokeShape } = {};

    if (fillColor) {
        const track = applyColorsWithCompose(colorAnimations, fillColor, { duration }, letterPhase, colorRegistry);
        out.fill = trackToFill(track, 500 + letterIndex);
    }

    const strokeTrack = applyColorsWithCompose(strokeAnimations, strokeColor, { duration }, letterPhase, colorRegistry);
    if (strokeTrack) {
        out.stroke = trackToStroke(strokeTrack, strokeWidth, 600 + letterIndex);
    }

    return out;
}

function trackToFill(
    track: Track<number[]>,
    cix: number,
): FillShape {
    const animated = Array.isArray(track.k) ? 1 : track.a;
    // If alpha component varies, move it to separate opacity track (Lottie uses 'o' not color alpha)
    if (Array.isArray(track.k)) {
        const kf = track.k as any[]; // Keyframe<number[]>[]
        const hasAlphaVariation = kf.some((f) => {
            const s = f.s?.[3];
            const e = f.e?.[3];
            return (s !== undefined && s !== 1) || (e !== undefined && e !== 1);
        });
        if (hasAlphaVariation) {
            // Build opacity keyframes from alpha (0..1 -> 0..100)
            const opacityKF = kf.map((f) => ({
                t: f.t,
                s: (f.s?.[3] ?? 1) * 100,
                e: f.e ? (f.e[3] ?? 1) * 100 : undefined,
                i: f.i,
                o: f.o,
            }));
            // Build color keyframes with alpha forced to 1
            const colorKF = kf.map((f) => ({
                t: f.t,
                s: [f.s[0], f.s[1], f.s[2], 1],
                e: f.e ? [f.e[0], f.e[1], f.e[2], 1] : undefined,
                i: f.i,
                o: f.o,
            }));
            return {
                cix,
                ty: ShapeType.Fill,
                c: { a: 1, k: colorKF as any, ix: 5 },
                o: { a: 1, k: opacityKF as any },
                r: 1,
                bm: 0,
                nm: 'Fill',
                hd: false,
            };
        }
    }
    return {
        cix,
        ty: ShapeType.Fill,
        c: { a: animated, k: track.k as any, ix: 5 },
        o: { a: 0, k: 100 },
        r: 1,
        bm: 0,
        nm: 'Fill',
        hd: false,
    };
}

function trackToStroke(
    track: Track<number[]>,
    width: number,
    cix: number,
): StrokeShape {
    const animated = Array.isArray(track.k) ? 1 : track.a;
    if (Array.isArray(track.k)) {
        const kf = track.k as any[];
        const hasAlphaVariation = kf.some((f) => {
            const s = f.s?.[3];
            const e = f.e?.[3];
            return (s !== undefined && s !== 1) || (e !== undefined && e !== 1);
        });
        if (hasAlphaVariation) {
            const opacityKF = kf.map((f) => ({
                t: f.t,
                s: (f.s?.[3] ?? 1) * 100,
                e: f.e ? (f.e[3] ?? 1) * 100 : undefined,
                i: f.i,
                o: f.o,
            }));
            const colorKF = kf.map((f) => ({
                t: f.t,
                s: [f.s[0], f.s[1], f.s[2], 1],
                e: f.e ? [f.e[0], f.e[1], f.e[2], 1] : undefined,
                i: f.i,
                o: f.o,
            }));
            return {
                cix,
                ty: ShapeType.Stroke,
                c: { a: 1, k: colorKF as any, ix: 5 },
                o: { a: 1, k: opacityKF as any },
                w: { a: 0, k: width },
                lc: LineCapType.Round,
                lj: LineJoinType.Round,
                ml: 4,
                bm: 0,
                nm: 'Stroke',
                hd: false,
            };
        }
    }
    return {
        cix,
        ty: ShapeType.Stroke,
        c: { a: animated, k: track.k as any, ix: 5 },
        o: { a: 0, k: 100 },
        w: { a: 0, k: width },
        lc: LineCapType.Round,
        lj: LineJoinType.Round,
        ml: 4,
        bm: 0,
        nm: 'Stroke',
        hd: false,
    };
}
