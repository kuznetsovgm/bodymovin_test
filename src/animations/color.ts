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
        case ColorAnimationType.Chase: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.Chase],
                ...(params ?? {}),
            };
            const palette = (cfg.colors as [number, number, number, number][] | undefined) || [];
            const n = palette.length;
            if (n === 0) {
                return {
                    a: 0,
                    k: [...baseColor, 1] as any,
                };
            }
            const letterIndex = (params as any)?.letterIndex as number | undefined;
            const lettersCount = (params as any)?.lettersCount as number | undefined;
            const totalLetters =
                typeof lettersCount === 'number' && lettersCount > 0 ? Math.floor(lettersCount) : 1;
            const reverse = !!(cfg.reverse || (params as any)?.reverse);

            const rawWindowFraction =
                (params as any)?.windowFraction ?? (cfg as any)?.windowFraction;
            let activeCount = 1;
            if (
                typeof rawWindowFraction === 'number' &&
                Number.isFinite(rawWindowFraction) &&
                rawWindowFraction > 0
            ) {
                const clamped = Math.max(0, Math.min(1, rawWindowFraction));
                if (totalLetters > 0) {
                    const approx = Math.round(clamped * totalLetters);
                    activeCount = Math.max(1, Math.min(totalLetters, approx));
                }
            }

            const steps = Math.max(totalLetters * 2, n * 2);
            const colorsOut: [number, number, number, number][] = [];
            const timesOut: number[] = [];

            for (let k = 0; k <= steps; k += 1) {
                const tNorm = steps === 0 ? 0 : k / steps;
                const progress = tNorm; // 0..1
                let head = totalLetters > 0 ? Math.floor(progress * totalLetters) % totalLetters : 0;
                if (reverse) {
                    head = (totalLetters - 1 - head + totalLetters) % totalLetters;
                }

                let color: [number, number, number, number];
                if (typeof letterIndex === 'number' && Number.isFinite(letterIndex) && totalLetters > 0) {
                    const idxLetter = ((Math.floor(letterIndex) % totalLetters) + totalLetters) % totalLetters;
                    const d = ((idxLetter - head + totalLetters) % totalLetters + totalLetters) % totalLetters;
                    const active = d < activeCount;
                    if (active) {
                        const paletteIdx = d % n;
                        color = palette[paletteIdx];
                    } else {
                        color = palette[0];
                    }
                } else {
                    const paletteIdx = Math.floor(progress * n) % n;
                    color = palette[paletteIdx];
                }

                colorsOut.push(color);
                timesOut.push(tNorm * duration);
            }

            return {
                a: 1,
                k: buildRawKeyframes(colorsOut, timesOut, true),
            };
        }
        case ColorAnimationType.Zebra: {
            const cfg = {
                ...colorAnimationConfig[ColorAnimationType.Zebra],
                ...(params ?? {}),
            };
            const colors = (cfg.colors as [number, number, number, number][] | undefined) || [];
            const effectiveColors =
                colors.length > 0
                    ? colors
                    : [[...(baseColor as [number, number, number]), 1]];
            const n = effectiveColors.length;
            if (n === 0) {
                return {
                    a: 0,
                    k: [...baseColor, 1] as any,
                };
            }
            const letterIndex = (params as any)?.letterIndex as number | undefined;
            let index: number;
            if (typeof letterIndex === 'number' && Number.isFinite(letterIndex)) {
                const mod = letterIndex % n;
                index = mod < 0 ? mod + n : mod;
            } else {
                const phaseNorm = Math.max(0, Math.min(0.999999, phase ?? 0));
                index = Math.floor(phaseNorm * n);
            }
            const color = effectiveColors[index] as [number, number, number, number];
            return {
                a: 0,
                k: color as any,
            };
        }
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

            const rawWindowFraction = (params as any)?.windowFraction as number | undefined;
            const hasWindowFraction =
                typeof rawWindowFraction === 'number' &&
                Number.isFinite(rawWindowFraction) &&
                rawWindowFraction > 0 &&
                rawWindowFraction < 1;

            if (hasWindowFraction && typeof lettersCount === 'number' && lettersCount > 0) {
                const clampedRaw = Math.max(0, Math.min(1, rawWindowFraction));
                const minWidth = 1 / lettersCount;
                const windowWidth = Math.min(1, Math.max(clampedRaw, minWidth));
                const clampedPhase = Math.max(0, Math.min(1, phase ?? 0));
                const phaseForDir = direction === -1 ? 1 - clampedPhase : clampedPhase;
                const startNorm = phaseForDir * (1 - windowWidth);
                const times = baseNormTimes.map(
                    (t: number) => (startNorm + t * windowWidth) * duration,
                );
                return {
                    a: 1,
                    k: buildRawKeyframes(
                        colors as [number, number, number, number][],
                        times,
                        true,
                    ),
                };
            }

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
            const clampedPhase = Math.max(0, Math.min(0.999999, phase ?? 0));
            const shift = direction * clampedPhase * duration;
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
