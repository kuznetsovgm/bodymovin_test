import opentype from 'opentype.js';

import { PathShape, ShapeType } from '../interfaces/lottie';
import { PathMorphAnimationType } from '../domain/types';
import { buildLetterSeed } from '../shared/noise';
import { buildPathMorphKeyframes, convertOpentypePathToBezier } from './bezier';
import { applyPathMorphAnimations, PathMorphDescriptor } from '../animations/pathMorph';

export type GlyphToShapesParams = {
    fontSize: number;
    duration: number;
    pathMorphAnimation: PathMorphAnimationType;
    pathMorphAnimations?: PathMorphDescriptor[];
    seed: number;
};

export function glyphToShapes(
    glyph: opentype.Glyph,
    char: string,
    letterIndex: number,
    params: GlyphToShapesParams,
): PathShape[] {
    const { fontSize, duration, pathMorphAnimation, pathMorphAnimations, seed } = params;
    const path = glyph.getPath(0, 0, fontSize);
    const contours = convertOpentypePathToBezier(path);
    if (!contours || contours.length === 0) return [];

    return contours.map((bez, contourIdx) => {
        const pathShape: PathShape = {
            ty: ShapeType.Path,
            ind: letterIndex * 100 + contourIdx,
            hd: false,
            nm: `letter_${char}_${letterIndex}_contour_${contourIdx}`,
            cix: 100 + letterIndex * 10 + contourIdx,
            bm: 0,
            ks: { ix: 0, a: 0, k: bez },
        };

        const morphSeed =
            buildLetterSeed(letterIndex, char.charCodeAt(0), seed) + contourIdx * 0.1;
        const morphDescs: PathMorphDescriptor[] =
            pathMorphAnimations && pathMorphAnimations.length
                ? pathMorphAnimations
                : [{ type: pathMorphAnimation }];
        const morphKeyframes =
            pathMorphAnimation === PathMorphAnimationType.None && (!pathMorphAnimations || !pathMorphAnimations.length)
                ? null
                : applyPathMorphAnimations(bez, morphDescs, {
                      fontSize,
                      duration,
                      seed: morphSeed,
                  });
        if (morphKeyframes) {
            pathShape.ks = { ix: 0, a: 1, k: morphKeyframes } as any;
        }

        return pathShape;
    });
}
