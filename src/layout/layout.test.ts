import assert from 'node:assert';
import { wrapAndScaleText } from './wrap';
import { layoutText } from './layoutText';

type StubGlyph = { advanceWidth: number };
type StubFont = {
    unitsPerEm: number;
    getAdvanceWidth: (text: string, size: number) => number;
    charToGlyph: (ch: string) => StubGlyph;
};

function createStubFont(glyphAdvance = 500, unitsPerEm = 1000): StubFont {
    return {
        unitsPerEm,
        getAdvanceWidth: (text, size) => (text.length * glyphAdvance * size) / unitsPerEm,
        charToGlyph: (_ch) => ({ advanceWidth: glyphAdvance }),
    };
}

// wrap should keep size if fits
(() => {
    const font = createStubFont();
    const { finalFontSize, lines } = wrapAndScaleText(
        'HELLO WORLD',
        font as any,
        100,
        800,
        800,
    );
    assert.equal(lines.length, 1);
    assert.equal(finalFontSize, 100);
})();

// wrap should downscale to fit narrow width
(() => {
    const font = createStubFont();
    const { finalFontSize } = wrapAndScaleText(
        'THIS TEXT IS TOO WIDE',
        font as any,
        100,
        200,
        800,
    );
    assert.ok(finalFontSize < 50, 'expected font to downscale for narrow width');
})();

// layoutText positions letters with proper advances
(() => {
    const font = createStubFont();
    const lines = ['AB'];
    const glyphs = layoutText(lines, font as any, 100);
    assert.equal(glyphs.length, 2);
    assert.ok(glyphs[0].x < 0);
    assert.ok(glyphs[1].x > glyphs[0].x);
    assert.equal(glyphs[0].y, glyphs[1].y);
})();
