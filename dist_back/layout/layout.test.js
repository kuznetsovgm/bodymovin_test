"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = __importDefault(require("node:assert"));
const wrap_1 = require("./wrap");
const layoutText_1 = require("./layoutText");
function createStubFont(glyphAdvance = 500, unitsPerEm = 1000) {
    return {
        unitsPerEm,
        getAdvanceWidth: (text, size) => (text.length * glyphAdvance * size) / unitsPerEm,
        charToGlyph: (_ch) => ({ advanceWidth: glyphAdvance }),
    };
}
// wrap should keep size if fits
(() => {
    const font = createStubFont();
    const { finalFontSize, lines } = (0, wrap_1.wrapAndScaleText)('HELLO WORLD', font, 100, 800, 800);
    node_assert_1.default.equal(lines.length, 1);
    node_assert_1.default.equal(finalFontSize, 100);
})();
// wrap should downscale to fit narrow width
(() => {
    const font = createStubFont();
    const { finalFontSize } = (0, wrap_1.wrapAndScaleText)('THIS TEXT IS TOO WIDE', font, 100, 200, 800);
    node_assert_1.default.ok(finalFontSize < 50, 'expected font to downscale for narrow width');
})();
// layoutText positions letters with proper advances
(() => {
    const font = createStubFont();
    const lines = ['AB'];
    const glyphs = (0, layoutText_1.layoutText)(lines, font, 100);
    node_assert_1.default.equal(glyphs.length, 2);
    node_assert_1.default.ok(glyphs[0].x < 0);
    node_assert_1.default.ok(glyphs[1].x > glyphs[0].x);
    node_assert_1.default.equal(glyphs[0].y, glyphs[1].y);
})();
//# sourceMappingURL=layout.test.js.map