import { PathMorphAnimationType } from '../domain/types';
import { buildPathMorphKeyframes } from '../shapes/bezier';
import { Bezier } from '../interfaces/lottie';
import { ComposeFn } from '../domain/types';

export type PathMorphContext = {
    fontSize: number;
    duration: number;
    seed: number;
};

export type PathMorphDescriptor = {
    type: PathMorphAnimationType;
    compose?: ComposeFn<Bezier[], PathMorphContext>;
    priority?: number;
};

export function applyPathMorphAnimations(
    bez: Bezier,
    descs: PathMorphDescriptor[] | undefined,
    ctx: PathMorphContext,
): any[] | null {
    const list = descs && descs.length ? descs : [{ type: PathMorphAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce<Bezier[] | null>((acc, desc, idx) => {
        if (desc.type === PathMorphAnimationType.None) return acc;
        const keyframes = buildPathMorphKeyframes(
            idx === 0 ? bez : (acc?.[acc.length - 1] as Bezier),
            ctx.fontSize,
            ctx.duration,
            desc.type,
            ctx.seed,
        );
        if (!keyframes) return acc;
        const composed = desc.compose ? desc.compose(acc ?? [], keyframes as any, ctx) : keyframes as any;
        return composed as any;
    }, null);
}
