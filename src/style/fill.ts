import { FillShape, LineCapType, LineJoinType, ShapeType } from '../interfaces/lottie';
import { ColorAnimationType } from '../domain/types';
import { buildRawKeyframes } from '../shared/keyframes';

export function createFill(
    colorAnimation: ColorAnimationType,
    duration: number,
    phase: number = 0,
    cix: number = 2,
    fillColor: [number, number, number] = [1, 1, 1],
): FillShape {
    switch (colorAnimation) {
        case ColorAnimationType.CycleRGB:
            return {
                cix,
                ty: ShapeType.Fill,
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
                r: 1,
                bm: 0,
                nm: 'Fill RGB Cycle',
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
                ty: ShapeType.Fill,
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
                r: 1,
                bm: 0,
                nm: 'Fill Rainbow Wave',
                hd: false,
            };
        }
        case ColorAnimationType.None:
        default:
            return {
                cix,
                ty: ShapeType.Fill,
                c: {
                    a: 1,
                    k: buildRawKeyframes(
                        [
                            [...fillColor, 1],
                            [...fillColor, 1],
                        ],
                        [0, duration],
                        false,
                    ),
                    ix: 5,
                },
                o: { a: 0, k: 100 },
                r: 1,
                bm: 0,
                nm: 'Fill None',
                hd: false,
            };
    }
}
