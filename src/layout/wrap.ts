import opentype from 'opentype.js';

type WrapResult = { lines: string[]; finalFontSize: number };
export type CodepointItem = { ch: string; index: number };
type WrapMultiResult = {
    lines: string[];
    lineItems: CodepointItem[][];
    finalFontSize: number;
    direction: 'ltr' | 'rtl';
};

function measureItemsWidth(
    items: CodepointItem[],
    fontSize: number,
    resolveFont: (indexInText: number, ch: string) => opentype.Font,
): number {
    let width = 0;
    for (const item of items) {
        const ch = item.ch;
        const font = resolveFont(item.index, ch);
        const glyph = font.charToGlyph(ch);
        if (glyph && glyph.advanceWidth !== undefined) {
            width += (glyph.advanceWidth * fontSize) / font.unitsPerEm;
        }
    }
    return width;
}

export function wrapAndScaleText(
    text: string,
    font: opentype.Font,
    initialFontSize: number,
    maxWidth: number,
    maxHeight: number,
): WrapResult {
    let size = initialFontSize;
    let lines: string[] = [];
    const wrap = (fsz: number) => {
        // Разбиваем по явным переносам, затем внутри каждой строки переносим по словам
        const explicitLines = text.split('\n');
        const out: string[] = [];
        for (const explicitLine of explicitLines) {
            const words = explicitLine.split(' ');
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                const wWidth = font.getAdvanceWidth(test, fsz);
                if (wWidth <= maxWidth) {
                    line = test;
                } else {
                    if (line) out.push(line);
                    line = w;
                }
            }
            if (line) out.push(line);
        }
        return out;
    };
    for (let a = 0; a < 20; a++) {
        lines = wrap(size);
        const lh = size * 1.2;
        const total = lines.length * lh;
        const allFit = lines.every((l) => font.getAdvanceWidth(l, size) <= maxWidth);
        if (allFit && total <= maxHeight) break;
        size *= 0.9;
    }
    return { lines, finalFontSize: size };
}

export function wrapAndScaleTextMulti(
    text: string,
    initialFontSize: number,
    maxWidth: number,
    maxHeight: number,
    resolveFont: (indexInText: number, ch: string) => opentype.Font,
): WrapMultiResult {
    const bidiFactory = require('bidi-js') as () => any;
    const bidi = bidiFactory();
    const embedding = bidi.getEmbeddingLevels(text);
    const mirroredMap: Map<number, string> = bidi.getMirroredCharactersMap(text, embedding);
    const baseDirection: 'ltr' | 'rtl' =
        embedding &&
        embedding.paragraphs &&
        Array.isArray(embedding.paragraphs) &&
        embedding.paragraphs.length &&
        embedding.paragraphs[0].level % 2 === 1
            ? 'rtl'
            : 'ltr';

    let size = initialFontSize;
    let lines: string[] = [];
    let lineItems: CodepointItem[][] = [];

    const cpItems: CodepointItem[] = [];
    const itemByIndex = new Map<number, CodepointItem>();
    for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        const item = { ch, index: i };
        cpItems.push(item);
        itemByIndex.set(i, item);
        i += ch.length;
    }

    // Глобальный визуальный порядок по bidi
    const reorderedIndicesFull: number[] = bidi.getReorderedIndices(text, embedding) || [];
    const visualItems: CodepointItem[] = [];
    if (reorderedIndicesFull.length) {
        for (const idx of reorderedIndicesFull) {
            const item = itemByIndex.get(idx);
            if (!item) continue;
            const mirrored = mirroredMap.get(idx);
            visualItems.push(mirrored ? { ...item, ch: mirrored } : item);
        }
    } else {
        visualItems.push(...cpItems);
    }

    // Токенизируем текст, чтобы сохранить исходные индексы символов
    type Token = { type: 'word' | 'space' | 'newline'; items: CodepointItem[]; text: string };

    const buildTokens = (): Token[] => {
        const tokens: Token[] = [];
        let currentWord: CodepointItem[] = [];
        const flushWord = () => {
            if (currentWord.length) {
                const wordText = currentWord.map((i) => i.ch).join('');
                tokens.push({ type: 'word', items: [...currentWord], text: wordText });
                currentWord = [];
            }
        };

        for (const item of visualItems) {
            const ch = item.ch;
            if (ch === '\n') {
                flushWord();
                tokens.push({ type: 'newline', items: [item], text: ch });
                continue;
            }
            if (ch === ' ') {
                flushWord();
                tokens.push({ type: 'space', items: [item], text: ch });
                continue;
            }
            currentWord.push(item);
        }
        flushWord();
        return tokens;
    };

    const wrap = (fsz: number): WrapMultiResult => {
        const tokens = buildTokens();
        const outLines: string[] = [];
        const outItems: CodepointItem[][] = [];

        let currentLine = '';
        let currentItems: CodepointItem[] = [];

        const pushLine = () => {
            if (currentLine.length) {
                outLines.push(currentLine);
                outItems.push([...currentItems]);
            }
            currentLine = '';
            currentItems = [];
        };

        for (const token of tokens) {
            if (token.type === 'newline') {
                pushLine();
                continue;
            }

            const candidateItems = [...currentItems, ...token.items];
            const width = measureItemsWidth(candidateItems, fsz, resolveFont);

            if (candidateItems.length === 0 || width <= maxWidth) {
                currentLine += token.text;
                currentItems = candidateItems;
            } else {
                pushLine();
                currentLine = token.text;
                currentItems = [...token.items];
            }
        }

        pushLine();

        return { lines: outLines, lineItems: outItems, finalFontSize: fsz, direction: 'ltr' };
    };

    for (let a = 0; a < 20; a++) {
        const { lines: candidateLines, lineItems: candidateItems, finalFontSize, direction } = wrap(size);
        const lh = size * 1.2;
        const total = candidateLines.length * lh;
        const allFit = candidateLines.every((_l, idx) => {
            const width = measureItemsWidth(candidateItems[idx] ?? [], finalFontSize, resolveFont);
            return width <= maxWidth;
        });
        if (allFit && total <= maxHeight) {
            lines = candidateLines;
            lineItems = candidateItems;
            return { lines, lineItems, finalFontSize, direction };
        }
        lines = candidateLines;
        lineItems = candidateItems;
        size *= 0.9;
    }

    return {
        lines,
        lineItems,
        finalFontSize: size,
        direction: baseDirection,
    };
}
