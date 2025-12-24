import opentype from 'opentype.js';

export type LaidOutGlyph = {
    char: string;
    glyph: opentype.Glyph;
    font: opentype.Font;
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
    direction: 'ltr' | 'rtl' = 'ltr',
): LaidOutGlyph[] {
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const result: LaidOutGlyph[] = [];
    let letterIndex = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const text = lines[lineIdx];
        const total = font.getAdvanceWidth(text, fontSize);
        let x = direction === 'rtl' ? total / 2 : -total / 2;
        const y = -totalHeight / 2 + lineIdx * lineHeight + fontSize * 0.8;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === ' ') {
                const g = font.charToGlyph(ch);
                if (g && g.advanceWidth !== undefined) {
                    const adv = (g.advanceWidth * fontSize) / font.unitsPerEm;
                    x += direction === 'rtl' ? -adv : adv;
                }
                continue;
            }
            const glyph = font.charToGlyph(ch);
            if (!glyph || glyph.advanceWidth === undefined) continue;
            const advance = (glyph.advanceWidth * fontSize) / font.unitsPerEm;
            const placeX = direction === 'rtl' ? x - advance : x;
            result.push({
                char: ch,
                glyph,
                font,
                x: placeX,
                y,
                advance,
                lineIndex: lineIdx,
                letterIndex,
            });
            x += direction === 'rtl' ? -advance : advance;
            letterIndex++;
        }
    }

    return result;
}

import type { CodepointItem } from './wrap';

export function layoutTextMulti(
    lineItems: CodepointItem[][],
    fontSize: number,
    resolveFont: (indexInText: number, ch: string) => opentype.Font,
    direction: 'ltr' | 'rtl' = 'ltr',
): LaidOutGlyph[] {
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineItems.length * lineHeight;
    const result: LaidOutGlyph[] = [];
    let letterIndex = 0;

    for (let lineIdx = 0; lineIdx < lineItems.length; lineIdx++) {
        const items = lineItems[lineIdx] || [];
        let total = 0;
        for (const item of items) {
            const font = resolveFont(item.index, item.ch);
            const glyph = font.charToGlyph(item.ch);
            if (glyph && glyph.advanceWidth !== undefined) {
                total += (glyph.advanceWidth * fontSize) / font.unitsPerEm;
            }
        }
        let x = direction === 'rtl' ? total / 2 : -total / 2;
        const y = -totalHeight / 2 + lineIdx * lineHeight + fontSize * 0.8;
        for (const item of items) {
            const ch = item.ch;
            const textIdx = item.index;
            const font = resolveFont(textIdx, ch);
            const glyph = font.charToGlyph(ch);
            if (!glyph || glyph.advanceWidth === undefined) {
                continue;
            }
            const advance = (glyph.advanceWidth * fontSize) / font.unitsPerEm;
            const placeX = direction === 'rtl' ? x - advance : x;
            result.push({
                char: ch,
                glyph,
                font,
                x: placeX,
                y,
                advance,
                lineIndex: lineIdx,
                letterIndex,
            });
            x += direction === 'rtl' ? -advance : advance;
            letterIndex++;
        }
    }

    return result;
}
