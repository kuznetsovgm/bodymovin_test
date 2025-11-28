import { StrokeShape, LineCapType, LineJoinType, ShapeType } from '../interfaces/lottie';
import { ColorAnimationType } from '../domain/types';
import { buildRawKeyframes } from '../shared/keyframes';

export function createStroke(
    strokeAnimation: ColorAnimationType,
    duration: number,
    strokeWidth: number = 2,
    strokeColor: [number, number, number] = [0, 0, 0],
    phase: number = 0,
    cix: number = 3,
): StrokeShape {
    switch (strokeAnimation) {
        case ColorAnimationType.CycleRGB:
            return {
                cix,
                ty: ShapeType.Stroke,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [1, 0, 0, 1],
                            [0, 1, 0, 1],
                            [0, 0, 1, 1],
                            [1, 0, 0, 1],
                        ],
                        [0, duration / 3, (2 * duration) / 3, duration],
                        true,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                w: { a: 0, k: strokeWidth },
                lc: LineCapType.Round,
                lj: LineJoinType.Round,
                ml: 4,
                bm: 0,
                nm: 'Stroke RGB Cycle',
                hd: false,
            };
        case ColorAnimationType.Rainbow: {
            const colors = [
                [1, 0, 0, 1],
                [1, 0.5, 0, 1],
                [1, 1, 0, 1],
                [0, 1, 0, 1],
                [0, 0.5, 1, 1],
                [0, 0, 1, 1],
                [0.5, 0, 1, 1],
                [1, 0, 0.5, 1],
                [1, 0, 0, 1],
            ];
            const times = colors.map((_, idx) => (idx / 8) * duration);
            const shifted = times.map((t) => (t + phase * duration) % duration);
            const pairs = times
                .map((t, i) => ({ time: shifted[i], color: colors[i] }))
                .sort((a, b) => a.time - b.time);
            return {
                cix,
                ty: ShapeType.Stroke,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        pairs.map((p) => p.color),
                        pairs.map((p) => p.time),
                        true,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                w: { a: 0, k: strokeWidth },
                lc: LineCapType.Round,
                lj: LineJoinType.Round,
                ml: 4,
                bm: 0,
                nm: 'Stroke Rainbow',
                hd: false,
            };
        }
        case ColorAnimationType.None:
        default:
            return {
                cix,
                ty: ShapeType.Stroke,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [...strokeColor, 1],
                            [...strokeColor, 1],
                        ],
                        [0, duration],
                        false,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                w: { a: 0, k: strokeWidth },
                lc: LineCapType.Round,
                lj: LineJoinType.Round,
                ml: 4,
                bm: 0,
                nm: 'Stroke None',
                hd: false,
            };
    }
}
