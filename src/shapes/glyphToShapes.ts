import opentype from 'opentype.js';

import { PathShape, ShapeType } from '../interfaces/lottie';
import { PathMorphAnimationType } from '../domain/types';
import { buildLetterSeed } from '../shared/noise';
import { Bezier } from '../interfaces/lottie';
import { buildPathMorphKeyframes, convertOpentypePathToBezier } from './bezier';
import { applyPathMorphAnimations, PathMorphDescriptor } from '../animations/pathMorph';

export type GlyphToShapesParams = {
    fontSize: number;
    duration: number;
    pathMorphAnimation: PathMorphAnimationType;
    pathMorphAnimations?: PathMorphDescriptor[];
    seed: number;
    contours?: Bezier[];
    glyphInstanceIndex?: number;
};

export function glyphToShapes(
    glyph: opentype.Glyph,
    char: string,
    letterIndex: number,
    params: GlyphToShapesParams,
): PathShape[] {
    const { fontSize, duration, pathMorphAnimation, pathMorphAnimations, seed, contours: presetContours, glyphInstanceIndex } = params;
    const baseIndex = glyphInstanceIndex != null ? glyphInstanceIndex : letterIndex;
    const path = presetContours ? null : glyph.getPath(0, 0, fontSize);
    const contours = presetContours ?? convertOpentypePathToBezier(path!);
    if (!contours || contours.length === 0) return [];

    return contours.map((bez, contourIdx) => {
        const pathShape: PathShape = {
            ty: ShapeType.Path,
            ind: baseIndex * 100 + contourIdx,
            hd: false,
            nm: `letter_${char}_${baseIndex}_contour_${contourIdx}`,
            cix: 100 + baseIndex * 10 + contourIdx,
            bm: 0,
            ks: { ix: 0, a: 0, k: bez },
        };

        const morphSeed =
            buildLetterSeed(baseIndex, char.charCodeAt(0), seed) + contourIdx * 0.1;
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
