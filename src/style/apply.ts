import { ColorAnimationDescriptor } from '../domain/types';
import { FillShape, StrokeShape } from '../interfaces/lottie';
import { Track } from '../shared/keyframes';
import { applyColorsWithCompose } from '../animations/composers';
import { colorRegistry } from '../animations/registry';
import { ShapeType, LineCapType, LineJoinType } from '../interfaces/lottie';

type StyleContext = {
    duration: number;
    letterPhase: number;
    letterIndex: number;
};

export function buildLetterStyles(
    colorAnimations: ColorAnimationDescriptor[] | undefined,
    strokeAnimations: ColorAnimationDescriptor[] | undefined,
    ctx: StyleContext,
): { fill?: FillShape; stroke?: StrokeShape } {
    const { duration, letterPhase, letterIndex } = ctx;

    const out: { fill?: FillShape; stroke?: StrokeShape } = {};

    const baseFillColor = resolveBaseColor(colorAnimations, undefined);
    if (baseFillColor) {
        const track = applyColorsWithCompose(
            colorAnimations,
            baseFillColor,
            { duration },
            letterPhase,
            colorRegistry,
        );
        out.fill = trackToFill(track, 500 + letterIndex);
    }

    const strokeStyle = resolveStrokeStyle(strokeAnimations);
    if (strokeStyle) {
        const strokeTrack = applyColorsWithCompose(
            strokeAnimations,
            strokeStyle.color,
            { duration },
            letterPhase,
            colorRegistry,
        );
        if (strokeTrack) {
            out.stroke = trackToStroke(strokeTrack, strokeStyle.width, 600 + letterIndex);
        }
    }

    return out;
}

function trackToFill(track: Track<number[]>, cix: number): FillShape {
    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: ShapeType.Fill,
        c: { a: animated, k: colorTrack.k as any, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k as any } : { a: 0, k: 100 },
        r: 1,
        bm: 0,
        nm: 'Fill',
        hd: false,
    };
}

function resolveBaseColor(
    animations: ColorAnimationDescriptor[] | undefined,
    fallback?: [number, number, number],
): [number, number, number] | undefined {
    if (animations && animations.length) {
        const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        for (const desc of sorted) {
            const p = desc.params as any;
            const base = extractBaseColor(p);
            if (base) return base;
        }
    }
    return fallback;
}

function resolveStrokeStyle(
    animations: ColorAnimationDescriptor[] | undefined,
): { color: [number, number, number]; width: number } | null {
    if (!animations || !animations.length) {
        return null;
    }
    const sorted = [...animations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const desc of sorted) {
        const p = desc.params as any;
        const color = extractBaseColor(p);
        const width = p?.strokeWidth as number | undefined;
        if (color && typeof width === 'number') {
            return { color, width };
        }
    }
    // Если ни одна stroke-анимация не определяет и цвет, и толщину, просто не рисуем обводку
    return null;
}

function extractBaseColor(params: any): [number, number, number] | undefined {
    if (!params) return undefined;
    if (Array.isArray(params.colors) && params.colors.length) {
        const [r, g, b] = params.colors[0];
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    const base = params.baseColor as [number, number, number] | undefined;
    if (Array.isArray(base) && base.length >= 3) {
        const [r, g, b] = base;
        if ([r, g, b].every((v) => typeof v === 'number')) {
            return [r, g, b];
        }
    }
    return undefined;
}

function trackToStroke(track: Track<number[]>, width: number, cix: number): StrokeShape {
    const { colorTrack, opacityTrack } = splitColorTrack(track);
    const animated = Array.isArray(colorTrack.k) ? 1 : colorTrack.a;
    return {
        cix,
        ty: ShapeType.Stroke,
        c: { a: animated, k: colorTrack.k as any, ix: 5 },
        o: opacityTrack ? { a: opacityTrack.a, k: opacityTrack.k as any } : { a: 0, k: 100 },
        w: { a: 0, k: width },
        lc: LineCapType.Round,
        lj: LineJoinType.Round,
        ml: 4,
        bm: 0,
        nm: 'Stroke',
        hd: false,
    };
}

function splitColorTrack(
    track: Track<number[]>,
): { colorTrack: Track<number[]>; opacityTrack?: Track<number> } {
    if (track.a === 0) {
        const value = track.k as number[];
        if (Array.isArray(value) && value.length >= 4) {
            const alpha = value[3];
            const colorValue = value.slice(0, 3);
            const colorTrack: Track<number[]> = { a: 0, k: colorValue };
            if (alpha !== 1) {
                return {
                    colorTrack,
                    opacityTrack: { a: 0, k: alpha * 100 },
                };
            }
            return { colorTrack };
        }
        return { colorTrack: track };
    }

    if (!Array.isArray(track.k)) {
        return { colorTrack: track };
    }

    const keyframes = track.k as any[];
    let alphaChanged = false;

    const colorKeyframes = keyframes.map((kf) => {
        const clone = { ...kf };
        if (Array.isArray(clone.s) && clone.s.length >= 4) {
            const alpha = clone.s[3];
            if (alpha !== 1) alphaChanged = true;
            clone.s = clone.s.slice(0, 3);
        }
        if (Array.isArray(clone.e) && clone.e.length >= 4) {
            const alpha = clone.e[3];
            if (alpha !== 1) alphaChanged = true;
            clone.e = clone.e.slice(0, 3);
        }
        return clone;
    });

    const opacityKeyframes = keyframes.map((kf) => {
        const startAlpha =
            Array.isArray(kf.s) && kf.s.length >= 4 ? (kf.s[3] ?? 1) : 1;
        const endAlpha =
            Array.isArray(kf.e) && kf.e.length >= 4 ? (kf.e[3] ?? 1) : undefined;
        if (startAlpha !== 1 || (endAlpha !== undefined && endAlpha !== 1)) {
            alphaChanged = true;
        }
        return {
            t: kf.t,
            s: startAlpha * 100,
            e: endAlpha !== undefined ? endAlpha * 100 : undefined,
            i: kf.i,
            o: kf.o,
        };
    });

    const colorTrack: Track<number[]> = { a: 1, k: colorKeyframes as any };

    if (alphaChanged) {
        return {
            colorTrack,
            opacityTrack: { a: 1, k: opacityKeyframes as any },
        };
    }

    return { colorTrack };
}
