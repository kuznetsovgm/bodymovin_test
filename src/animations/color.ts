import { ColorAnimationType } from '../domain/types';
import { Track, buildRawKeyframes } from '../shared/keyframes';
import { colorAnimationConfig } from '../config/animation-config';

export type ColorContext = {
    duration: number;
};

export function buildColorTrack(
    type: ColorAnimationType,
    ctx: ColorContext,
    phase: number = 0,
    baseColor: [number, number, number] = [1, 1, 1],
    params?: any,
): Track<number[]> {
    const { duration } = ctx;
    switch (type) {
        case ColorAnimationType.CycleRGB: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.CycleRGB],
                ...(params ?? {}),
            };
            const times = cfg.times.map((t: number) => t * duration);
            return {
                a: 1,
                k: buildRawKeyframes(
                    cfg.colors as [number, number, number, number][],
                    times,
                    cfg.loop,
                ),
            };
        }
        case ColorAnimationType.Pulse:
            return {
                a: 1,
                k: buildRawKeyframes(
                    [
                        [...baseColor, 1],
                        [
                            ...baseColor.map(
                                (c: number) =>
                                    c *
                                    (params?.darkenFactor ??
                                        colorAnimationConfig[ColorAnimationType.Pulse].darkenFactor),
                            ) as [number, number, number],
                            1,
                        ],
                        [...baseColor, 1],
                    ],
                    [0, duration / 2, duration],
                    params?.loop ?? colorAnimationConfig[ColorAnimationType.Pulse].loop,
                ),
            };
        case ColorAnimationType.TransparencyPulse: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.TransparencyPulse],
                ...(params ?? {}),
            };
            const times = cfg.times.map((t: number) => t * duration);
            // Используем цвета из конфига, но с базовым цветом по RGB
            const colors = cfg.colors.map((c: [number, number, number, number]) => {
                const alpha = c[3];
                return [...baseColor, alpha] as [number, number, number, number];
            });
            return {
                a: 1,
                k: buildRawKeyframes(colors, times, cfg.loop),
            };
        }
        case ColorAnimationType.Rainbow: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.Rainbow],
                ...(params ?? {}),
            };
            const baseTimes = cfg.times.map((t: number) => t * duration);
            const shifted = baseTimes.map((t: number) => (t + phase * duration) % duration);
            const pairs = baseTimes
                .map((t: number, i: number) => ({ time: shifted[i], color: cfg.colors[i] }))
                .sort((a: { time: number }, b: { time: number }) => a.time - b.time);
            return {
                a: 1,
                k: buildRawKeyframes(
                    pairs.map(
                        (p: { color: [number, number, number, number] }) =>
                            p.color as [number, number, number, number],
                    ),
                    pairs.map((p: { time: number }) => p.time),
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
                    params?.loop ?? colorAnimationConfig[ColorAnimationType.None].loop,
                ),
            };
    }
}
