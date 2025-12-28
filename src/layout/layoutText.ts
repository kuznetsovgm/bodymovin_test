import opentype from 'opentype.js';
import type { Bezier } from '../interfaces/lottie';
import { shapeLine } from '../shaping/shapeText';

export type LaidOutGlyph = {
    char: string;
    glyph: opentype.Glyph;
    font: opentype.Font;
    x: number;
    y: number;
    advance: number;
    lineIndex: number;
    letterIndex: number;
    glyphId?: number;
    cluster?: number;
    contours?: Bezier[];
    textRange?: [number, number];
    glyphInstanceIndex?: number;
    animUnitIndex?: number;
    direction?: 'ltr' | 'rtl';
    script?: string;
    language?: string;
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

export async function layoutTextMulti(
    lineItems: CodepointItem[][],
    fontSize: number,
    resolveFont: (indexInText: number, ch: string) => opentype.Font,
    direction: 'ltr' | 'rtl' = 'ltr',
): Promise<LaidOutGlyph[]> {
    const lineHeight = fontSize * 1.2;
    const totalHeight = lineItems.length * lineHeight;
    const result: LaidOutGlyph[] = [];
    let animUnitOffset = 0;
    let globalGlyphIndex = 0;

    const shapedLines: Array<{ lineIdx: number; shaped: Awaited<ReturnType<typeof shapeLine>> }> = [];
    for (let lineIdx = 0; lineIdx < lineItems.length; lineIdx++) {
        const items = lineItems[lineIdx] || [];
        const shaped = await shapeLine(items, fontSize, resolveFont);
        shapedLines.push({ lineIdx, shaped });
    }

    // Center each line independently using its actual bounds.
    // This avoids pathological shifts for short RTL lines and matches the previous layout behavior.
    // `direction` is intentionally not used here: shaping (HarfBuzz+BiDi) already determines visual order.
    for (const { lineIdx, shaped } of shapedLines) {
        let xMin = Number.POSITIVE_INFINITY;
        let xMax = Number.NEGATIVE_INFINITY;
        for (const g of shaped.glyphs) {
            const { minX, maxX } = getGlyphBoundsX(g);
            xMin = Math.min(xMin, g.x + minX);
            xMax = Math.max(xMax, g.x + maxX);
        }
        if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) {
            xMin = 0;
            xMax = shaped.width || 0;
        }
        const lineCenterX = (xMin + xMax) / 2;
        const baseY = -totalHeight / 2 + lineIdx * lineHeight + fontSize * 0.8;
        for (const glyph of shaped.glyphs) {
            const glyphIndex = globalGlyphIndex++;
            const animIndex =
                glyph.animUnitIndex != null ? glyph.animUnitIndex + animUnitOffset : undefined;
            result.push({
                char: glyph.char,
                glyph: glyph.glyph,
                font: glyph.font,
                x: glyph.x - lineCenterX,
                y: baseY + (glyph.y || 0),
                advance: glyph.advance,
                lineIndex: lineIdx,
                letterIndex: animIndex ?? glyphIndex,
                glyphId: glyph.glyphId,
                cluster: glyph.cluster,
                contours: glyph.contours,
                textRange: glyph.textRange,
                glyphInstanceIndex: glyphIndex,
                animUnitIndex: animIndex,
                direction: glyph.direction,
                script: glyph.script,
                language: glyph.language,
            });
        }
        animUnitOffset += shaped.animUnits.length;
    }

    return result;
}

function getGlyphBoundsX(glyph: { contours?: Bezier[]; advance: number }): { minX: number; maxX: number } {
    const contours = glyph.contours;
    if (!contours || contours.length === 0) {
        return { minX: 0, maxX: Math.max(0, glyph.advance || 0) };
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const c of contours) {
        const v = c.v || [];
        const i = c.i || [];
        const o = c.o || [];
        for (let idx = 0; idx < v.length; idx++) {
            const vx = v[idx]?.[0] ?? 0;
            const ix = i[idx]?.[0] ?? 0;
            const ox = o[idx]?.[0] ?? 0;
            minX = Math.min(minX, vx, vx + ix, vx + ox);
            maxX = Math.max(maxX, vx, vx + ix, vx + ox);
        }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
        return { minX: 0, maxX: Math.max(0, glyph.advance || 0) };
    }
    return { minX, maxX };
}
