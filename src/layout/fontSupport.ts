import path from 'path';
import opentype from 'opentype.js';
import { loadFont } from './fontLoader';
import { fontAnimationConfig } from '../config/animation-config';
import { detectScript, isEmojiCodePoint, Script } from '../shared/scripts';

type FontSupportEntry = {
    glyphSupported: Map<number, boolean>;
    hasCyrillic?: boolean;
    codePoints?: Set<number>;
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

function isIgnorableEmojiModifier(cp: number): boolean {
    // ZWJ, variation selectors, skin tone modifiers и базовые модификаторы считаем служебными
    return (
        cp === 0x200d || // zero width joiner
        cp === 0xfe0e ||
        cp === 0xfe0f || // variation selectors
        (cp >= 0x1f3fb && cp <= 0x1f3ff) || // skin tone
        (cp >= 0x1f9b0 && cp <= 0x1f9b3) // hair modifiers
    );
}

function ensureCodePointSet(font: opentype.Font, entry: FontSupportEntry): Set<number> {
    if (entry.codePoints) return entry.codePoints;

    const codePoints = new Set<number>();
    const anyFont: any = font as any;
    const total =
        font.numGlyphs ||
        (anyFont.glyphs && typeof anyFont.glyphs.length === 'number' && anyFont.glyphs.length) ||
        0;

    for (let i = 0; i < total; i++) {
        const g: any = font.glyphs && typeof (font.glyphs as any).get === 'function'
            ? (font.glyphs as any).get(i)
            : anyFont.glyphs
                ? anyFont.glyphs[i]
                : null;
        if (!g) continue;

        const cps: number[] = Array.isArray(g.unicodes) && g.unicodes.length
            ? g.unicodes
            : g.unicode != null
                ? [g.unicode]
                : [];

        for (const cp of cps) {
            if (!cp || typeof cp !== 'number') continue;
            codePoints.add(cp);
        }
    }

    entry.codePoints = codePoints;
    return codePoints;
}

function isGlyphSupported(font: opentype.Font, entry: FontSupportEntry, codePoint: number): boolean {
    const cached = entry.glyphSupported.get(codePoint);
    if (cached !== undefined) return cached;

    const codePoints = ensureCodePointSet(font, entry);
    const ok = codePoints.has(codePoint);
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

    if (!fontSupportsText(font, trimmed)) {
        throw new Error('Selected font does not contain all glyphs required for this text');
    }
}

export type TextFontPlan = {
    text: string;
    perChar: {
        char: string;
        codePoint: number;
        script: Script;
        font: opentype.Font;
        index: number;
    }[];
    byIndex: Map<number, { char: string; codePoint: number; script: Script; font: opentype.Font; index: number }>;
    fonts: opentype.Font[];
    primaryFont: opentype.Font;
};

const fallbackFontCache = new Map<string, Promise<opentype.Font>>();

async function loadFallbackFont(fontFile: string, fallback: opentype.Font): Promise<opentype.Font> {
    if (!fontFile) return fallback;
    const cached = fallbackFontCache.get(fontFile);
    if (cached) return cached;

    const safe = fontFile.replace(/(\.\.(\/|\\))/g, '').replace(/^(\.\/|\/)+/, '');
    const fullPath = path.resolve(fontAnimationConfig.fontDirectory, safe);
    const promise = loadFont(fullPath).catch(() => fallback);
    fallbackFontCache.set(fontFile, promise);
    return promise;
}

export async function buildTextFontPlan(
    primaryFontPath: string,
    text: string,
    fallbacks: Partial<Record<Script, string>>,
): Promise<TextFontPlan> {
    const primaryFont = await loadFont(primaryFontPath);
    const primaryEntry = getSupportEntry(primaryFont);
    const perChar: TextFontPlan['perChar'] = [];
    const byIndex = new Map<number, TextFontPlan['perChar'][number]>();
    const fonts = new Set<opentype.Font>([primaryFont]);
    const missingScripts = new Set<Script>();

    for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const char = String.fromCodePoint(cp);
        const charLength = char.length;
        const index = i;
        i += charLength;
        if (cp == null || isWhitespaceOrControl(cp) || isIgnorableEmojiModifier(cp)) {
            const entry = { char, codePoint: cp ?? 0, script: 'other' as Script, font: primaryFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
            continue;
        }

        const script = detectScript(cp);

        // Эмодзи часто представлены суррогатами, поэтому не заставляем основной шрифт их поддерживать
        if (script === 'emoji' || isEmojiCodePoint(cp)) {
            const fbFile = fallbacks.emoji;
            if (!fbFile) {
                // Нет явного фоллбека — используем основной шрифт и не блокируем генерацию
                const entry = { char, codePoint: cp, script, font: primaryFont, index };
                perChar.push(entry);
                byIndex.set(index, entry);
                continue;
            }
            const fbFont = await loadFallbackFont(fbFile, primaryFont);
            const fbEntry = getSupportEntry(fbFont);
            // Даже если глифа нет, не считаем это фатальной ошибкой — используем fallback как есть
            if (!isGlyphSupported(fbFont, fbEntry, cp)) {
                const entry = { char, codePoint: cp, script, font: fbFont, index };
                perChar.push(entry);
                byIndex.set(index, entry);
                continue;
            }
            fonts.add(fbFont);
            const entry = { char, codePoint: cp, script, font: fbFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
            continue;
        }

        if (isGlyphSupported(primaryFont, primaryEntry, cp)) {
            const entry = { char, codePoint: cp, script, font: primaryFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
            continue;
        }

        const fbFile = fallbacks[script];
        if (!fbFile) {
            missingScripts.add(script);
            const entry = { char, codePoint: cp, script, font: primaryFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
            continue;
        }

        const fbFont = await loadFallbackFont(fbFile, primaryFont);
        const fbEntry = getSupportEntry(fbFont);
        if (isGlyphSupported(fbFont, fbEntry, cp)) {
            fonts.add(fbFont);
            const entry = { char, codePoint: cp, script, font: fbFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
        } else {
            missingScripts.add(script);
            const entry = { char, codePoint: cp, script, font: primaryFont, index };
            perChar.push(entry);
            byIndex.set(index, entry);
        }
    }

    if (missingScripts.size > 0) {
        throw new Error(`Missing glyphs for scripts: ${Array.from(missingScripts).join(', ')}`);
    }

    return {
        text,
        perChar,
        byIndex,
        fonts: Array.from(fonts),
        primaryFont,
    };
}
