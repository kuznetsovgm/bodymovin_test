import opentype from 'opentype.js';

import { promisify } from '../shared/fs';

const fontCache = new Map<string, Promise<opentype.Font>>();

export function loadFont(fontPath: string): Promise<opentype.Font> {
    if (!fontCache.has(fontPath)) {
        fontCache.set(fontPath, promisify<opentype.Font>(opentype.load, fontPath));
    }
    return fontCache.get(fontPath)!;
}
