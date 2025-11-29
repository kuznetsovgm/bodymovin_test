import { PathMorphAnimationType } from '../domain/types';
import { buildPathMorphKeyframes } from '../shapes/bezier';
import { Bezier } from '../interfaces/lottie';

export type PathMorphContext = {
    fontSize: number;
    duration: number;
    seed: number;
};

export type PathMorphDescriptor = {
    type: PathMorphAnimationType;
    compose?: any;
    priority?: number;
    params?: any;
};

// Последовательное применение морфингов: каждый следующий фильтр применяется к результату предыдущего.
export function applyPathMorphAnimations(
    bez: Bezier,
    descs: PathMorphDescriptor[] | undefined,
    ctx: PathMorphContext,
): any[] | null {
    const list = descs && descs.length ? descs : [{ type: PathMorphAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    let currentBezier = bez;
    let lastTrack: any[] | null = null;

    for (const desc of sorted) {
        if (desc.type === PathMorphAnimationType.None) continue;
        const track = buildPathMorphKeyframes(
            currentBezier,
            ctx.fontSize,
            ctx.duration,
            desc.type,
            ctx.seed,
            desc.params,
        );
        if (!track || !track.length) continue;

        lastTrack = track as any[];

        // Обновляем текущую форму по последнему ключевому кадру
        const lastKf = track[track.length - 1] as any;
        const lastState =
            (Array.isArray(lastKf.e) && lastKf.e[0]) ||
            (Array.isArray(lastKf.s) && lastKf.s[0]) ||
            currentBezier;
        currentBezier = lastState as Bezier;
    }

    return lastTrack;
}
