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
