export type Keyframe<T extends number | number[]> = { t: number; s: T; e?: T; i?: any; o?: any };
export type Track<T extends number | number[]> = { a: 0 | 1; k: T | Keyframe<T>[] };

export function linearIn() {
    return { x: [0.667], y: [1] };
}

export function linearOut() {
    return { x: [0.333], y: [0] };
}

export function buildLoopKeyframes(points: number[][], times: number[]) {
    return buildRawKeyframes(points, times, true);
}

export function buildValueKeyframes(values: number[], times: number[], loop: boolean) {
    return buildRawKeyframes(
        values.map((v) => [v]),
        times,
        loop,
    );
}

export function buildRawKeyframes<T extends number | number[]>(
    points: T[],
    times: number[],
    loop: boolean,
): Keyframe<T>[] {
    const k: Keyframe<T>[] = [];
    for (let i = 0; i < points.length; i++) {
        const t = times[i];
        const s = points[i];
        if (i < points.length - 1) {
            const e = points[i + 1];
            k.push({ t, s, e, i: linearIn(), o: linearOut() });
        } else {
            k.push({ t, s });
        }
    }
    if (loop && k.length > 0) {
        k[k.length - 1].s = points[0];
    }
    return k;
}

export function buildScalarTrack(values: number[], times: number[], loop: boolean) {
    return buildValueKeyframes(values, times, loop);
}

export function buildVecTrack(values: number[][], times: number[], loop: boolean) {
    return buildRawKeyframes(values, times, loop);
}

const addValue = (a: any, b: any) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.map((v, idx) => v + (b[idx] ?? 0));
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a + b;
    }
    return b ?? a;
};

const lerpValue = (a: any, b: any, t: number) => {
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.map((v, idx) => v + (b[idx] - v) * t);
    }
    if (typeof a === 'number' && typeof b === 'number') {
        return a + (b - a) * t;
    }
    return b ?? a;
};

export function sumKF(trackA: Keyframe<number>[], trackB: Keyframe<number>[]) {
    return trackA.map((kf, idx) => {
        const other = trackB[idx];
        if (!other) return kf;
        return {
            ...kf,
            s: addValue(kf.s, other.s),
            e: other.e !== undefined && kf.e !== undefined ? addValue(kf.e, other.e) : kf.e,
        };
    });
}

export function sumVecKF(trackA: Keyframe<number[]>[], trackB: Keyframe<number[]>[]) {
    return sumKF(trackA as any, trackB as any) as Keyframe<number[]>[];
}

export function lerpKF(trackA: Keyframe<number>[], trackB: Keyframe<number>[], t: number) {
    return trackA.map((kf, idx) => {
        const other = trackB[idx] ?? kf;
        return {
            ...kf,
            s: lerpValue(kf.s, other.s, t),
            e: other.e !== undefined && kf.e !== undefined ? lerpValue(kf.e, other.e, t) : kf.e,
        };
    });
}

export function lerpVecKF(trackA: Keyframe<number[]>[], trackB: Keyframe<number[]>[], t: number) {
    return lerpKF(trackA as any, trackB as any, t) as Keyframe<number[]>[];
}

export function stitchKF(trackA: Keyframe<number>[] = [], trackB: Keyframe<number>[] = []) {
    if (!trackA.length) return trackB;
    const lastTime = trackA[trackA.length - 1].t ?? 0;
    const shifted = trackB.map((kf) => ({ ...kf, t: kf.t + lastTime }));
    return [...trackA, ...shifted];
}
