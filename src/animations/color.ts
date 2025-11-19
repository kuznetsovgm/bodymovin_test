import { ColorAnimationType } from '../domain/types';
import { Track, buildRawKeyframes } from '../shared/keyframes';

export type ColorContext = {
    duration: number;
};

export function buildColorTrack(
    type: ColorAnimationType,
    ctx: ColorContext,
    phase: number = 0,
    baseColor: [number, number, number] = [1, 1, 1],
): Track<number[]> {
    const { duration } = ctx;
    switch (type) {
        case ColorAnimationType.CycleRGB:
            return {
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
            };
        case ColorAnimationType.Pulse:
            return {
                a: 1,
                k: buildRawKeyframes(
                    [
                        [...baseColor, 1],
                        [...baseColor.map((c) => c * 0.7) as [number, number, number], 1],
                        [...baseColor, 1],
                    ],
                    [0, duration / 2, duration],
                    true,
                ),
            };
        case ColorAnimationType.TransparencyPulse:
            return {
                a: 1,
                k: buildRawKeyframes(
                    [
                        [...baseColor, 0],
                        [...baseColor, 1],
                        [...baseColor, 0],
                    ],
                    [0, duration / 2, duration],
                    true,
                ),
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
                a: 1,
                k: buildRawKeyframes(
                    pairs.map((p) => p.color as [number, number, number, number]),
                    pairs.map((p) => p.time),
                    true,
                ),
            };
        }
        case ColorAnimationType.None:
        default:
            return {
                a: 1,
                k: buildRawKeyframes(
                    [
                        [...baseColor, 1],
                        [...baseColor, 1],
                    ],
                    [0, duration],
                    false,
                ),
            };
    }
}
