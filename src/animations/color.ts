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
        case ColorAnimationType.Rainbow: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.Rainbow],
                ...(params ?? {}),
            };
            const lettersCount = (params as any)?.lettersCount as number | undefined;
            const baseNormTimes = cfg.times as number[];
            const colors = cfg.colors as [number, number, number, number][];
            const direction = cfg.reverse ? -1 : 1;

            // Special per-letter window: compress track into window 1 / lettersCount
            const uniqueRgbCount = new Set(
                colors.map((c) => `${c[0]}_${c[1]}_${c[2]}`),
            ).size;
            const useWindow =
                typeof lettersCount === 'number' && lettersCount > 1 && uniqueRgbCount <= 1;

            if (useWindow) {
                const windowWidth = 1 / lettersCount;
                const clampedPhase = Math.max(0, Math.min(1, phase));
                const phaseForDir = direction === -1 ? 1 - clampedPhase : clampedPhase;
                const startNorm = phaseForDir * (1 - windowWidth);
                const times = baseNormTimes.map(
                    (t: number) => (startNorm + t * windowWidth) * duration,
                );
                return {
                    a: 1,
                    k: buildRawKeyframes(
                        cfg.colors as [number, number, number, number][],
                        times,
                        true,
                    ),
                };
            }

            // Generic wave: cyclic shift of full track
            const baseTimes = baseNormTimes.map((t: number) => t * duration);
            const shift = direction * phase * duration;
            const shifted = baseTimes.map((t: number) => (t + shift + duration) % duration);
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
        default: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.None],
                ...(params ?? {}),
            };
            return {
                a: 1,
                k: buildRawKeyframes(
                    [
                        [...(params?.baseColor ?? baseColor), 1],
                        [...(params?.baseColor ?? baseColor), 1],
                    ],
                    [0, duration],
                    cfg.loop ?? false,
                ),
            };
        }
    }
}
