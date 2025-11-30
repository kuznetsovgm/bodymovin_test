"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyPathMorphAnimations = void 0;
const types_1 = require("../domain/types");
const bezier_1 = require("../shapes/bezier");
function applyPathMorphAnimations(bez, descs, ctx) {
    const list = descs && descs.length ? descs : [{ type: types_1.PathMorphAnimationType.None }];
    const sorted = [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return sorted.reduce((acc, desc, idx) => {
        if (desc.type === types_1.PathMorphAnimationType.None)
            return acc;
        const keyframes = (0, bezier_1.buildPathMorphKeyframes)(idx === 0 ? bez : acc?.[acc.length - 1], ctx.fontSize, ctx.duration, desc.type, ctx.seed, desc.params);
        if (!keyframes)
            return acc;
        const composed = desc.compose ? desc.compose(acc ?? [], keyframes, ctx) : keyframes;
        return composed;
    }, null);
}
exports.applyPathMorphAnimations = applyPathMorphAnimations;
//# sourceMappingURL=pathMorph.js.map