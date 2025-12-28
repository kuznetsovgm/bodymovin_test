import opentype from 'opentype.js';

import { promisify } from '../shared/fs';

const fontCache = new Map<string, Promise<opentype.Font>>();
const fontPathByFont = new WeakMap<opentype.Font, string>();

function rememberFontPath(fontPath: string, font: opentype.Font) {
    if (font && typeof font === 'object') {
        fontPathByFont.set(font, fontPath);
    }
}

export function loadFont(fontPath: string): Promise<opentype.Font> {
    if (!fontCache.has(fontPath)) {
        fontCache.set(
            fontPath,
            promisify<opentype.Font>(opentype.load, fontPath).then((font) => {
                rememberFontPath(fontPath, font);
                return font;
            }),
        );
    }
    return fontCache.get(fontPath)!;
}

export function getFontPath(font: opentype.Font): string | undefined {
    return fontPathByFont.get(font);
}
