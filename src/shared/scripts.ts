export type Script =
    | 'latin'
    | 'cyrillic'
    | 'arabic'
    | 'han'
    | 'georgian'
    | 'hebrew'
    | 'devanagari'
    | 'emoji'
    | 'other';
export type TextDirection = 'ltr' | 'rtl';

function inRange(cp: number, start: number, end: number): boolean {
    return cp >= start && cp <= end;
}

export function isEmojiCodePoint(cp: number): boolean {
    // Покрываем основные диапазоны emoji без точной спецификации, чтобы не тащить regex
    return (
        inRange(cp, 0x1f300, 0x1f5ff) || // Misc Symbols and Pictographs
        inRange(cp, 0x1f600, 0x1f64f) || // Emoticons
        inRange(cp, 0x1f680, 0x1f6ff) || // Transport and Map
        inRange(cp, 0x1f900, 0x1f9ff) || // Supplemental Symbols and Pictographs
        inRange(cp, 0x1fa70, 0x1faff) || // Symbols and Pictographs Extended-A
        inRange(cp, 0x2600, 0x27bf) || // Misc symbols, dingbats
        inRange(cp, 0xfe00, 0xfe0f) // Variation selectors (часто с эмодзи)
    );
}

export function detectScript(cp: number): Script {
    if (isEmojiCodePoint(cp)) return 'emoji';
    if (inRange(cp, 0x0400, 0x04ff)) return 'cyrillic';
    if (inRange(cp, 0x0600, 0x06ff) || inRange(cp, 0x0750, 0x077f)) return 'arabic';
    if (inRange(cp, 0x4e00, 0x9fff) || inRange(cp, 0x3400, 0x4dbf)) return 'han';
    if (inRange(cp, 0x10a0, 0x10ff)) return 'georgian';
    if (inRange(cp, 0x0590, 0x05ff)) return 'hebrew';
    if (inRange(cp, 0x0900, 0x097f)) return 'devanagari';
    if (
        inRange(cp, 0x0041, 0x024f) || // Latin
        inRange(cp, 0x1e00, 0x1eff)
    ) {
        return 'latin';
    }
    return 'other';
}

const RTL_SCRIPTS: Script[] = ['arabic', 'hebrew'];

export function isRtlScript(script: Script): boolean {
    return RTL_SCRIPTS.includes(script);
}

export function detectTextDirection(text: string): TextDirection {
    for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        i += ch.length;
        const script = detectScript(cp);
        if (script === 'other' || script === 'emoji') continue;
        if (isRtlScript(script)) return 'rtl';
        return 'ltr';
    }
    return 'ltr';
}
