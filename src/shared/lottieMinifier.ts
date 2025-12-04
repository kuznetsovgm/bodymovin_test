import {
    FillShape,
    GroupShapeElement,
    PathShape,
    RectShape,
    ShapeElement,
    ShapeLayer,
    ShapeProperty,
    ShapeType,
    StrokeShape,
    Transform,
    TransformShape,
} from '../interfaces/lottie';
import { Sticker } from '../interfaces/sticker';

function isShapeLayer(layer: any): layer is ShapeLayer {
    return layer && Array.isArray(layer.shapes);
}

export function minifySticker(sticker: Sticker): Sticker {
    if (Array.isArray(sticker.layers)) {
        sticker.layers.forEach((layer) => {
            if (isShapeLayer(layer)) {
                minifyLayer(layer);
            }
        });
    }
    if (Array.isArray(sticker.assets) && sticker.assets.length === 0) {
        delete (sticker as any).assets;
    }
    return sticker;
}

function minifyLayer(layer: ShapeLayer) {
    dropIfValue(layer, 'ddd', 0);
    dropIfValue(layer, 'sr', 1);
    dropIfValue(layer, 'ao', 0);
    dropIfValue(layer, 'bm', 0);
    dropIfValue(layer, 'st', 0);
    dropIfValue(layer, 'ip', 0);
    if (layer.ks) {
        minifyTransform(layer.ks);
    }
    if (Array.isArray(layer.shapes)) {
        layer.shapes = layer.shapes
            .map((shape) => minifyShape(shape))
            .filter(Boolean) as ShapeElement[];
    }
}

function minifyTransform(transform: Transform) {
    Object.keys(transform as any).forEach((key) => {
        const value = (transform as any)[key];
        minifyAnimatable(value);
    });
}

function minifyShape(shape: ShapeElement | null): ShapeElement | null {
    if (!shape) return null;
    dropIfValue(shape, 'bm', 0);
    dropIfValue(shape, 'hd', false);
    delete (shape as any).cix;
    delete (shape as any).nm;
    switch (shape.ty) {
        case ShapeType.Group: {
            const group = shape as GroupShapeElement;
            if (Array.isArray(group.it)) {
                group.it = group.it.map((child) => minifyShape(child)).filter(Boolean) as ShapeElement[];
            }
            delete (group as any).np;
            return group.it.length ? group : null;
        }
        case ShapeType.Path:
            minifyShapeProperty((shape as PathShape).ks);
            return shape;
        case ShapeType.TransformShape:
            minifyTransform(shape as TransformShape);
            return shape;
        case ShapeType.Fill: {
            const fill = shape as FillShape;
            minifyAnimatable(fill.c);
            minifyAnimatable(fill.o);
            dropIfValue(fill, 'r', FillShapeDefaults.r);
            return fill;
        }
        case ShapeType.Stroke: {
            const stroke = shape as StrokeShape;
            minifyAnimatable(stroke.c);
            minifyAnimatable(stroke.o);
            minifyAnimatable((stroke as any).w);
            dropIfValue(stroke as any, 'lc', 1);
            dropIfValue(stroke as any, 'lj', 1);
            dropIfValue(stroke as any, 'ml', 4);
            return stroke;
        }
        case ShapeType.Rect: {
            const rect = shape as RectShape;
            minifyAnimatable(rect.p);
            minifyAnimatable(rect.s);
            minifyAnimatable(rect.r);
            dropIfValue(rect, 'd', 1);
            return rect;
        }
        case ShapeType.Ellipse: {
            const ellipse = shape as any;
            minifyAnimatable(ellipse.p);
            minifyAnimatable(ellipse.s);
            return ellipse;
        }
        default:
            return shape;
    }
}

function minifyShapeProperty(prop: ShapeProperty | undefined) {
    if (!prop) return;
    if (prop.ix !== undefined) delete (prop as any).ix;
    if (prop.a === 0) delete prop.a;
    const keyframes = prop.k as any;
    if (Array.isArray(keyframes) && keyframes.length && typeof keyframes[0] === 'object' && 't' in keyframes[0]) {
        prop.k = minifyKeyframeTrack(keyframes);
    }
}

function minifyAnimatable(value: any) {
    if (!value || typeof value !== 'object') return;
    if ('ix' in value) delete value.ix;
    if ('a' in value && value.a === 0) delete value.a;
    if ('k' in value) {
        const data = value.k;
        if (Array.isArray(data) && data.length && typeof data[0] === 'object' && 't' in data[0]) {
            value.k = minifyKeyframeTrack(data);
        }
    }
}

function minifyKeyframeTrack<T extends { t: number }>(track: T[]): T[] {
    const compact: T[] = [];
    for (const entry of track) {
        if (!entry) continue;
        const prev = compact[compact.length - 1];
        const entryAny = entry as any;
        if (
            prev &&
            prev.t === entry.t &&
            valuesEqual((prev as any).s, entryAny.s) &&
            valuesEqual((prev as any).e ?? null, entryAny.e ?? null)
        ) {
            continue;
        }
        if (
            prev &&
            valuesEqual(resolveEndValue(prev), entryAny.s) &&
            (!('e' in entryAny) || !entryAny.e || valuesEqual(entryAny.s, entryAny.e)) &&
            valuesEqual((prev as any).s, resolveEndValue(prev))
        ) {
            (prev as any).h = 1;
            delete (prev as any).e;
            delete (prev as any).i;
            delete (prev as any).o;
            continue;
        }
        compact.push(entry);
    }
    return compact;
}

function resolveEndValue(entry: any) {
    return entry && entry.e !== undefined ? entry.e : entry?.s;
}

function valuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!valuesEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const keysA = Object.keys(a);
        if (keysA.length !== Object.keys(b).length) return false;
        return keysA.every((k) => valuesEqual(a[k], b[k]));
    }
    return false;
}

function isPlainObject(value: any): value is Record<string, any> {
    return value != null && typeof value === 'object' && !Array.isArray(value);
}

function dropIfValue<T extends Record<string, any>>(obj: T, key: keyof T, value: any) {
    if (obj[key] === value) {
        delete obj[key];
    }
}

const FillShapeDefaults = {
    r: 1,
};
