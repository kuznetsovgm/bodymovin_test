import opentype from 'opentype.js';

export type ShapedGlyph = {
    id: number;
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
    originalIndex: number;
    char: string;
    font: opentype.Font;
    glyph?: opentype.Glyph | null;
};
