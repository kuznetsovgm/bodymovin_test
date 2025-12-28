import fs from 'fs/promises';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hb = require('harfbuzzjs');
import opentype from 'opentype.js';
import { detectScript } from './scripts';
import { ShapedGlyph } from './shapedTypes';

export type ShapingResult = {
    glyphs: ShapedGlyph[];
    direction: 'ltr' | 'rtl';
};

let hbInstance: any | null = null;

async function getHb() {
    if (!hbInstance) {
        hbInstance = await hb;
    }
    return hbInstance;
}

async function loadFontBuffer(fontPath: string): Promise<Uint8Array> {
    const buf = await fs.readFile(fontPath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function resolveScriptTag(text: string): string {
    const cp = text.codePointAt(0);
    if (cp == null) return 'latn';
    const script = detectScript(cp);
    switch (script) {
        case 'arabic':
            return 'arab';
        case 'hebrew':
            return 'hebr';
        case 'han':
            return 'hani';
        case 'cyrillic':
            return 'cyrl';
        case 'georgian':
            return 'geor';
        case 'devanagari':
            return 'deva';
        default:
            return 'latn';
    }
}

function safeGetGlyph(font: opentype.Font, gid: number): opentype.Glyph | null {
    try {
        const anyFont: any = font as any;
        if (anyFont.glyphs && typeof anyFont.glyphs.get === 'function') {
            const g = anyFont.glyphs.get(gid);
            if (g) return g;
        }
        const arr = anyFont.glyphs && anyFont.glyphs.glyphs;
        if (arr && arr[gid]) return arr[gid];
    } catch {
        /* ignore */
    }
    return null;
}

export async function shapeText(
    text: string,
    fontPath: string,
    direction?: 'ltr' | 'rtl',
    script?: string,
): Promise<ShapingResult> {
    const hbLib = await getHb();
    const fontBuffer = await loadFontBuffer(fontPath);
    const face = hbLib.createFace(fontBuffer);
    const hbFont = hbLib.createFont(face);
    const otFont = await opentype.load(fontPath);

    const hbDirection = direction || 'ltr';
    const hbScript = script || resolveScriptTag(text);

    const buffer = hbLib.createBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    buffer.setDirection(hbDirection);
    buffer.setScript(hbScript);
    hbLib.shape(hbFont, buffer, '');

    const result = buffer.json();
    const cpItems: { ch: string; index: number }[] = [];
    for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        cpItems.push({ ch, index: i });
        i += ch.length;
    }

    const glyphs: ShapedGlyph[] = [];
    for (const g of result) {
        const item = cpItems[g.cluster] || { ch: '', index: g.cluster };
        const glyphObj = safeGetGlyph(otFont, g.gid);
        glyphs.push({
            id: g.gid,
            xAdvance: g.x_advance,
            yAdvance: g.y_advance,
            xOffset: g.x_offset,
            yOffset: g.y_offset,
            originalIndex: item.index,
            char: item.ch,
            font: otFont,
            glyph: glyphObj,
        });
    }

    return {
        glyphs,
        direction: hbDirection,
    };
}
