"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.glyphToShapes = void 0;
const lottie_1 = require("../interfaces/lottie");
const types_1 = require("../domain/types");
const noise_1 = require("../shared/noise");
const bezier_1 = require("./bezier");
const pathMorph_1 = require("../animations/pathMorph");
function glyphToShapes(glyph, char, letterIndex, params) {
    const { fontSize, duration, pathMorphAnimation, pathMorphAnimations, seed } = params;
    const path = glyph.getPath(0, 0, fontSize);
    const contours = (0, bezier_1.convertOpentypePathToBezier)(path);
    if (!contours || contours.length === 0)
        return [];
    return contours.map((bez, contourIdx) => {
        const pathShape = {
            ty: lottie_1.ShapeType.Path,
            ind: letterIndex * 100 + contourIdx,
            hd: false,
            nm: `letter_${char}_${letterIndex}_contour_${contourIdx}`,
            cix: 100 + letterIndex * 10 + contourIdx,
            bm: 0,
            ks: { ix: 0, a: 0, k: bez },
        };
        const morphSeed = (0, noise_1.buildLetterSeed)(letterIndex, char.charCodeAt(0), seed) + contourIdx * 0.1;
        const morphDescs = pathMorphAnimations && pathMorphAnimations.length
            ? pathMorphAnimations
            : [{ type: pathMorphAnimation }];
        const morphKeyframes = pathMorphAnimation === types_1.PathMorphAnimationType.None && (!pathMorphAnimations || !pathMorphAnimations.length)
            ? null
            : (0, pathMorph_1.applyPathMorphAnimations)(bez, morphDescs, {
                fontSize,
                duration,
                seed: morphSeed,
            });
        if (morphKeyframes) {
            pathShape.ks = { ix: 0, a: 1, k: morphKeyframes };
        }
        return pathShape;
    });
}
exports.glyphToShapes = glyphToShapes;
//# sourceMappingURL=glyphToShapes.js.map