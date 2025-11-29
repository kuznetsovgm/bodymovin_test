import opentype from 'opentype.js';

type FontSupportEntry = {
    glyphSupported: Map<number, boolean>;
    hasCyrillic?: boolean;
};

const fontSupportCache = new WeakMap<opentype.Font, FontSupportEntry>();

function getSupportEntry(font: opentype.Font): FontSupportEntry {
    let entry = fontSupportCache.get(font);
    if (!entry) {
        entry = {
            glyphSupported: new Map<number, boolean>(),
        };
        fontSupportCache.set(font, entry);
    }
    return entry;
}

function isWhitespaceOrControl(codePoint: number): boolean {
    // Пробел, таб, переводы строк и т.п. считаем "игнорируемыми" для проверки глифов
    return (
        codePoint === 0x20 || // space
        codePoint === 0x09 || // tab
        codePoint === 0x0a || // lf
        codePoint === 0x0d || // cr
        codePoint === 0x0b || // vt
        codePoint === 0x0c // ff
    );
}

function isGlyphSupported(font: opentype.Font, entry: FontSupportEntry, codePoint: number): boolean {
    const cached = entry.glyphSupported.get(codePoint);
    if (cached !== undefined) return cached;

    const char = String.fromCodePoint(codePoint);
    const glyphIndex = font.charToGlyphIndex(char);
    const ok = glyphIndex > 0;
    entry.glyphSupported.set(codePoint, ok);
    return ok;
}

const CYRILLIC_REQUIRED_CHARS =
    'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' +
    'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

function containsCyrillic(text: string): boolean {
    return /[\u0400-\u04FF]/.test(text);
}

export function fontHasCyrillic(font: opentype.Font): boolean {
    const entry = getSupportEntry(font);
    if (entry.hasCyrillic !== undefined) return entry.hasCyrillic;

    const seen = new Set<number>();
    for (const ch of CYRILLIC_REQUIRED_CHARS) {
        const cp = ch.codePointAt(0);
        if (cp == null || seen.has(cp)) continue;
        seen.add(cp);
        if (!isGlyphSupported(font, entry, cp)) {
            entry.hasCyrillic = false;
            return false;
        }
    }
    entry.hasCyrillic = true;
    return true;
}

export function fontSupportsText(font: opentype.Font, text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return true;

    const entry = getSupportEntry(font);
    for (const ch of trimmed) {
        const cp = ch.codePointAt(0);
        if (cp == null) continue;
        if (isWhitespaceOrControl(cp)) continue;
        if (!isGlyphSupported(font, entry, cp)) {
            return false;
        }
    }
    return true;
}

export function ensureFontSupportsText(font: opentype.Font, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (containsCyrillic(trimmed) && !fontHasCyrillic(font)) {
        throw new Error('Selected font does not support Cyrillic alphabet');
    }

    if (!fontSupportsText(font, trimmed)) {
        throw new Error('Selected font does not contain all glyphs required for this text');
    }
}

