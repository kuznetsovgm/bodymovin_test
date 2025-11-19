import opentype from 'opentype.js';

export type LaidOutGlyph = {
    char: string;
    glyph: opentype.Glyph;
    x: number;
    y: number;
    advance: number;
    lineIndex: number;
    letterIndex: number;
};

export function layoutText(
    lines: string[],
    font: opentype.Font,
    fontSize: number,
): LaidOutGlyph[] {
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const result: LaidOutGlyph[] = [];
    let letterIndex = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx];
        const total = font.getAdvanceWidth(text, fontSize);
        let x = -total / 2;
        const y = -totalHeight / 2 + lineIdx * lineHeight + fontSize * 0.75;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === ' ') {
                const g = font.charToGlyph(ch);
                if (g) {
                    x += (g.advanceWidth * fontSize) / font.unitsPerEm;
                }
                continue;
            }
            const glyph = font.charToGlyph(ch);
            if (!glyph) continue;
            const advance = (glyph.advanceWidth * fontSize) / font.unitsPerEm;
            result.push({
                char: ch,
                glyph,
                x,
                y,
                advance,
                lineIndex: lineIdx,
                letterIndex,
            });
            x += advance;
            letterIndex++;
        }
    }

    return result;
}
