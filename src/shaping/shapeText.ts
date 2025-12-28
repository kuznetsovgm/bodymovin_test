import fs from 'fs/promises';
import opentype from 'opentype.js';

import { convertOpentypePathToBezier, scaleBezier } from '../shapes/bezier';
import type { Bezier } from '../interfaces/lottie';
import type { CodepointItem } from '../layout/wrap';
import { detectScript, detectTextDirection, Script, TextDirection } from '../shared/scripts';
import { getFontPath } from '../layout/fontLoader';

type HbApi = any;

export type AnimUnit = { unitIndex: number; textRange: [number, number]; glyphIndexes: number[] };

export type ShapedGlyph = {
    char: string;
    glyphId: number;
    glyph: opentype.Glyph;
    font: opentype.Font;
    fontPath?: string;
    cluster: number;
    textRange?: [number, number];
    x: number;
    y: number;
    advance: number;
    contours: Bezier[];
    glyphIndex: number;
    animUnitIndex?: number;
    direction: TextDirection;
    script?: string;
    language?: string;
};

export type ShapedLine = {
    glyphs: ShapedGlyph[];
    animUnits: AnimUnit[];
    width: number;
    direction: TextDirection;
};

type HbFontResource = {
    hb: HbApi;
    font: any;
    upem: number;
};

const hbInstanceCache: { promise?: Promise<HbApi> } = {};
const hbFontCache = new Map<string, Promise<HbFontResource>>();
const baseContoursCache = new Map<string, Bezier[]>();

async function getHbInstance(): Promise<HbApi> {
    if (!hbInstanceCache.promise) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('harfbuzzjs');
        if (typeof mod === 'function') {
            hbInstanceCache.promise = mod();
        } else if (mod && typeof mod === 'object' && typeof mod.then === 'function') {
            hbInstanceCache.promise = mod;
        } else if (mod && typeof mod.default === 'function') {
            hbInstanceCache.promise = mod.default();
        } else if (mod && typeof mod.default === 'object' && typeof (mod.default as any).then === 'function') {
            hbInstanceCache.promise = mod.default as Promise<HbApi>;
        } else {
            throw new Error('Unsupported harfbuzzjs module shape');
        }
    }
    return hbInstanceCache.promise!;
}

async function getHbFont(fontPath: string): Promise<HbFontResource> {
    const cached = hbFontCache.get(fontPath);
    if (cached) return cached;
    const promise = (async () => {
        const hb = await getHbInstance();
        const data = await fs.readFile(fontPath);
        const blob = hb.createBlob(data);
        const face = hb.createFace(blob, 0);
        const font = hb.createFont(face);
        const upem = typeof face.upem === 'number' && face.upem > 0 ? face.upem : font.getUpem();
        font.setScale(upem, upem);
        return { hb, font, upem };
    })();
    hbFontCache.set(fontPath, promise);
    return promise;
}

function scriptToTag(script: Script | undefined): string | undefined {
    switch (script) {
        case 'arabic':
            return 'arab';
        case 'latin':
            return 'latn';
        case 'cyrillic':
            return 'cyrl';
        case 'hebrew':
            return 'hebr';
        case 'devanagari':
            return 'deva';
        case 'han':
            return 'hani';
        case 'georgian':
            return 'geor';
        default:
            return undefined;
    }
}

function dominantScript(text: string): Script | undefined {
    const counts = new Map<Script, number>();
    for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        const script = detectScript(cp);
        if (script !== 'other' && script !== 'emoji') {
            counts.set(script, (counts.get(script) || 0) + 1);
        }
        i += ch.length;
    }
    if (!counts.size) return undefined;
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
}

async function shapeSegment(
    segmentItems: CodepointItem[],
    font: opentype.Font,
    fontPath: string,
    fontSize: number,
    direction: TextDirection,
    scriptTag?: string,
    language?: string,
): Promise<{ glyphs: ShapedGlyph[]; width: number; clusterRanges: Map<number, [number, number]> }> {
    const segmentText = segmentItems.map((i) => i.ch).join('');
    if (!segmentText.length) {
        return { glyphs: [], width: 0, clusterRanges: new Map() };
    }
    const hbFont = await getHbFont(fontPath);
    const hb = hbFont.hb;
    const buf = hb.createBuffer();
    buf.addText(segmentText);
    buf.setDirection(direction === 'rtl' ? 'rtl' : 'ltr');
    const effectiveScript = scriptTag || (direction === 'rtl' ? 'arab' : undefined);
    const effectiveLang = language || (effectiveScript === 'arab' ? 'ar' : undefined);
    if (effectiveScript) buf.setScript(effectiveScript);
    if (effectiveLang) buf.setLanguage(effectiveLang);
    hb.shape(hbFont.font, buf);
    const shaped: Array<{ g: number; cl: number; ax: number; ay: number; dx: number; dy: number }> = buf.json();

    // Map HarfBuzz clusters (string indices / UTF-16 code units) to original text indices
    const codeUnitOffsets: number[] = [];
    let codeUnitCursor = 0;
    for (const item of segmentItems) {
        codeUnitOffsets.push(codeUnitCursor);
        codeUnitCursor += item.ch.length;
    }
    const clusterStarts = Array.from(new Set(shaped.map((g) => g.cl))).sort((a, b) => a - b);
    const clusterRanges = new Map<number, [number, number]>();
    const clusterText = new Map<number, string>();
    const findCharIndexForCluster = (clusterVal: number): number => {
        let idx = 0;
        for (let i = 0; i < codeUnitOffsets.length; i++) {
            if (codeUnitOffsets[i] <= clusterVal) idx = i;
            else break;
        }
        return idx;
    };
    for (let i = 0; i < clusterStarts.length; i++) {
        const c = clusterStarts[i];
        const next = i + 1 < clusterStarts.length ? clusterStarts[i + 1] : codeUnitCursor;
        const localText = segmentText.slice(c, next);
        clusterText.set(c, localText);
        const startIdx = findCharIndexForCluster(c);
        const endIdx = findCharIndexForCluster(Math.max(c, next - 1));
        const startTextIndex = segmentItems[startIdx]?.index ?? segmentItems[0]?.index ?? 0;
        const endItem = segmentItems[endIdx] ?? segmentItems[segmentItems.length - 1];
        const endTextIndex = (endItem?.index ?? startTextIndex) + (endItem?.ch.length ?? 1);
        clusterRanges.set(c, [startTextIndex, endTextIndex]);
    }

    const upem = hbFont.upem || font.unitsPerEm || 1000;
    const scale = fontSize / upem;

    const widthDesign = shaped.reduce((sum, g) => sum + (g.ax || 0), 0);
    const width = widthDesign * scale;

    let penXDesign = 0;
    const glyphs: ShapedGlyph[] = [];
    for (const s of shaped) {
        const advanceDesign = s.ax || 0;
        const advance = advanceDesign * scale;
        const glyphXDesign = penXDesign + (s.dx || 0);
        const glyphX = glyphXDesign * scale;
        penXDesign += advanceDesign;
        const glyphObj = font.glyphs.get(s.g) ?? font.charToGlyph(String.fromCharCode(s.g));
        const baseContours = getBaseContours(fontPath, font, s.g);
        const clText = clusterText.get(s.cl) ?? '';
        const textRange = clusterRanges.get(s.cl);
        // Use original text index as the cluster key to avoid collisions when shaping per-font segments.
        // HarfBuzz clusters are relative to the buffer text, so different segments can share the same `cl`.
        const clusterKey = textRange?.[0] ?? s.cl;
        // Keep advances (for spacing) but skip producing shapes/units for whitespace-only clusters.
        if (!baseContours.length || !clText.trim().length) {
            continue;
        }
        const contours = baseContours.map((c) => scaleBezier(c, scale));
        glyphs.push({
            char: clText,
            glyphId: s.g,
            glyph: glyphObj || font.glyphs.get(0)!,
            font,
            fontPath,
            cluster: clusterKey,
            textRange,
            x: glyphX,
            // HarfBuzz positions are in font coordinates (Y up), while opentype.js paths are in screen coordinates (Y down).
            // Flip the sign so mark positioning (e.g., Arabic dots) lands correctly.
            y: -(s.dy || 0) * scale,
            advance,
            contours,
            glyphIndex: -1,
            direction,
            script: scriptTag,
            language,
        });
    }

    return { glyphs, width, clusterRanges };
}

function getBaseContours(fontPath: string, font: opentype.Font, glyphId: number): Bezier[] {
    const key = `${fontPath || 'unknown'}:${glyphId}`;
    const cached = baseContoursCache.get(key);
    if (cached) return cached;
    const glyph = font.glyphs.get(glyphId);
    if (!glyph) return [];
    const path = glyph.getPath(0, 0, font.unitsPerEm || 1000);
    const bez = convertOpentypePathToBezier(path);
    baseContoursCache.set(key, bez);
    return bez;
}

export async function shapeLine(
    lineItems: CodepointItem[],
    fontSize: number,
    resolveFont: (indexInText: number, ch: string) => opentype.Font,
    langHint?: string,
): Promise<ShapedLine> {
    const bidiFactory = require('bidi-js') as () => any;
    const bidi = bidiFactory();

    const logicalItems = [...lineItems].sort((a, b) => a.index - b.index);
    const logicalText = logicalItems.map((i) => i.ch).join('');
    const embedding = bidi.getEmbeddingLevels(logicalText);
    const mirroredMap: Map<number, string> = bidi.getMirroredCharactersMap(logicalText, embedding);
    const levels: Uint8Array = embedding?.levels ?? new Uint8Array(logicalText.length);
    const baseDir: TextDirection = detectTextDirection(logicalText);

    // Map UTF-16 code unit indices (used by bidi-js) to CodepointItem indices.
    const itemCodeUnitOffsets: number[] = [];
    let codeUnitCursor = 0;
    for (const item of logicalItems) {
        itemCodeUnitOffsets.push(codeUnitCursor);
        codeUnitCursor += item.ch.length;
    }
    const itemIndexForCodeUnit = (pos: number): number => {
        // last i where offset[i] <= pos
        let lo = 0;
        let hi = itemCodeUnitOffsets.length - 1;
        let ans = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (itemCodeUnitOffsets[mid] <= pos) {
                ans = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return ans;
    };

    type Run = { start: number; end: number; level: number; direction: TextDirection };
    const runs: Run[] = [];
    if (logicalText.length) {
        let runStart = 0;
        let curLevel = levels[0] ?? 0;
        for (let i = 1; i < logicalText.length; i++) {
            const lv = levels[i] ?? 0;
            if (lv !== curLevel) {
                runs.push({
                    start: runStart,
                    end: i - 1,
                    level: curLevel,
                    direction: curLevel % 2 === 1 ? 'rtl' : 'ltr',
                });
                runStart = i;
                curLevel = lv;
            }
        }
        runs.push({
            start: runStart,
            end: logicalText.length - 1,
            level: curLevel,
            direction: curLevel % 2 === 1 ? 'rtl' : 'ltr',
        });
    }

    const reordered = bidi.getReorderedIndices(logicalText, embedding) || [];
    const visualRunOrder: number[] = [];
    for (const idx of reordered) {
        const runIdx = runs.findIndex((r) => idx >= r.start && idx <= r.end);
        if (runIdx >= 0 && !visualRunOrder.includes(runIdx)) {
            visualRunOrder.push(runIdx);
        }
    }
    const orderedRuns = visualRunOrder.length ? visualRunOrder.map((i) => runs[i]) : runs;
    if (process.env.DEBUG_TEXT_LAYOUT === '1') {
        // eslint-disable-next-line no-console
        console.log('[bidi] logical:', JSON.stringify(logicalText));
        // eslint-disable-next-line no-console
        console.log(
            '[bidi] runs:',
            runs.map((r) => ({ ...r, text: JSON.stringify(logicalText.slice(r.start, r.end + 1)) })),
        );
        // eslint-disable-next-line no-console
        console.log(
            '[bidi] orderedRuns:',
            orderedRuns.map((r) => ({ ...r, text: JSON.stringify(logicalText.slice(r.start, r.end + 1)) })),
        );
    }

    const lineGlyphs: ShapedGlyph[] = [];
    let currentX = 0;
    let glyphCounter = 0;
    const placedRuns: Array<{ run: Run; glyphIndexes: number[] }> = [];

    for (const run of orderedRuns) {
        const startItem = itemIndexForCodeUnit(run.start);
        const endItem = itemIndexForCodeUnit(run.end);
        const runItems = logicalItems.slice(startItem, endItem + 1);
        const runShapeItems: CodepointItem[] = runItems.map((item, idx) => {
            const globalItemIndex = startItem + idx;
            const cu = itemCodeUnitOffsets[globalItemIndex] ?? 0;
            const mirrored = mirroredMap.get(cu);
            if (mirrored && run.direction === 'rtl') {
                return { ...item, ch: mirrored };
            }
            return item;
        });
        const runText = runItems.map((i) => i.ch).join('');
        const script = dominantScript(runText);
        const scriptTag = scriptToTag(script);
        const language = script === 'arabic' ? langHint || 'ar' : langHint;

        // Split by font to keep HarfBuzz font consistent
        const segments: { items: CodepointItem[]; font: opentype.Font; fontPath: string }[] = [];
        let segment: { items: CodepointItem[]; font: opentype.Font; fontPath: string } | null = null;
        for (const item of runShapeItems) {
            const font = resolveFont(item.index, item.ch);
            const fontPath = getFontPath(font);
            if (!fontPath) {
                throw new Error('Font path is required for shaping');
            }
            if (segment && segment.font === font) {
                segment.items.push(item);
            } else {
                segment = { items: [item], font, fontPath };
                segments.push(segment);
            }
        }
        if (process.env.DEBUG_TEXT_LAYOUT === '1') {
            // eslint-disable-next-line no-console
            console.log(
                '[shape] run segments:',
                segments.map((s) => ({
                    text: JSON.stringify(s.items.map((i) => i.ch).join('')),
                    font: s.fontPath.split(/[\\/]/).pop(),
                })),
            );
        }

        const shapedSegments: Array<{ width: number; glyphs: ShapedGlyph[] }> = [];
        let runWidth = 0;
        for (const seg of segments) {
            const shaped = await shapeSegment(
                seg.items,
                seg.font,
                seg.fontPath,
                fontSize,
                run.direction,
                scriptTag,
                language,
            );
            const segGlyphs = shaped.glyphs.map((g) => ({ ...g, glyphIndex: glyphCounter++ }));
            shapedSegments.push({ width: shaped.width, glyphs: segGlyphs });
            runWidth += shaped.width;
        }
        if (process.env.DEBUG_TEXT_LAYOUT === '1') {
            // eslint-disable-next-line no-console
            console.log(
                '[shape] run widths:',
                JSON.stringify(
                    shapedSegments.map((s, idx) => ({
                        i: idx,
                        width: +s.width.toFixed(2),
                        glyphs: s.glyphs.length,
                    })),
                ),
                'total=',
                +runWidth.toFixed(2),
                'dir=',
                run.direction,
            );
        }

        const originX = currentX;
        const runGlyphsPlaced: ShapedGlyph[] = [];
        if (run.direction === 'rtl') {
            // Segments are collected in logical order (right-to-left reading order). For RTL layout,
            // place them from the right edge of the run to the left to keep word order correct,
            // especially when font fallback splits segments (e.g., spaces in a different font).
            let cursorX = runWidth;
            for (const seg of shapedSegments) {
                cursorX -= seg.width;
                const startX = originX + cursorX;
                if (process.env.DEBUG_TEXT_LAYOUT === '1') {
                    // eslint-disable-next-line no-console
                    console.log('[shape] place rtl segment', { startX: +startX.toFixed(2), width: +seg.width.toFixed(2) });
                }
                seg.glyphs.forEach((g) => runGlyphsPlaced.push({ ...g, x: g.x + startX }));
            }
        } else {
            let cursorX = 0;
            for (const seg of shapedSegments) {
                const startX = originX + cursorX;
                if (process.env.DEBUG_TEXT_LAYOUT === '1') {
                    // eslint-disable-next-line no-console
                    console.log('[shape] place ltr segment', { startX: +startX.toFixed(2), width: +seg.width.toFixed(2) });
                }
                seg.glyphs.forEach((g) => runGlyphsPlaced.push({ ...g, x: g.x + startX }));
                cursorX += seg.width;
            }
        }

        const runGlyphIndexes: number[] = [];
        for (const g of runGlyphsPlaced) {
            runGlyphIndexes.push(lineGlyphs.length);
            lineGlyphs.push(g);
        }
        placedRuns.push({ run, glyphIndexes: runGlyphIndexes });

        currentX += runWidth;
    }

    // Build anim units in reading order:
    // - runs: visual order is left→right, reading order depends on paragraph base direction
    // - within each run: order depends on run direction (LTR: left→right, RTL: right→left)
    const animUnits: AnimUnit[] = [];
    const unitKeyToIndex = new Map<number, number>();
    const readingRuns = baseDir === 'rtl' ? [...placedRuns].reverse() : placedRuns;

    for (const pr of readingRuns) {
        const byUnitKey = new Map<number, { glyphIndexes: number[]; textRange: [number, number] }>();
        for (const glyphIndex of pr.glyphIndexes) {
            const g = lineGlyphs[glyphIndex];
            const unitKey = g.cluster;
            const entry = byUnitKey.get(unitKey) ?? {
                glyphIndexes: [],
                textRange: g.textRange ?? [0, 0],
            };
            entry.glyphIndexes.push(glyphIndex);
            if (g.textRange) {
                entry.textRange = [
                    Math.min(entry.textRange[0], g.textRange[0]),
                    Math.max(entry.textRange[1], g.textRange[1]),
                ];
            }
            byUnitKey.set(unitKey, entry);
        }

        const runUnits = Array.from(byUnitKey.entries()).map(([unitKey, entry]) => {
            const xs = entry.glyphIndexes.map((idx) => lineGlyphs[idx].x);
            const repX = xs.length ? xs.reduce((sum, v) => sum + v, 0) / xs.length : 0;
            return { unitKey, repX, ...entry };
        });

        runUnits.sort((a, b) => {
            const dir = pr.run.direction;
            if (dir === 'rtl') return b.repX - a.repX;
            return a.repX - b.repX;
        });

        for (const unit of runUnits) {
            if (unitKeyToIndex.has(unit.unitKey)) continue;
            const unitIndex = animUnits.length;
            unitKeyToIndex.set(unit.unitKey, unitIndex);
            animUnits.push({
                unitIndex,
                textRange: unit.textRange,
                glyphIndexes: unit.glyphIndexes,
            });
        }
    }

    // Assign animUnitIndex to each glyph based on its cluster key.
    for (let i = 0; i < lineGlyphs.length; i++) {
        const g = lineGlyphs[i];
        const unitIndex = unitKeyToIndex.get(g.cluster);
        lineGlyphs[i] = { ...g, animUnitIndex: unitIndex };
    }

    // Merge Arabic word clusters into a single animation unit so connected letters animate together.
    const tokens = buildWordTokens(logicalItems);
    const mergedAnimUnits = mergeWordAnimUnits(tokens, animUnits);
    if (mergedAnimUnits.length !== animUnits.length) {
        const glyphToNewUnit = new Map<number, number>();
        for (const u of mergedAnimUnits) {
            for (const gi of u.glyphIndexes) glyphToNewUnit.set(gi, u.unitIndex);
        }
        for (let i = 0; i < lineGlyphs.length; i++) {
            const idx = glyphToNewUnit.get(i);
            if (idx !== undefined) {
                lineGlyphs[i] = { ...lineGlyphs[i], animUnitIndex: idx };
            }
        }
    }

    const lineWidth = currentX;
    return {
        glyphs: lineGlyphs,
        animUnits: mergedAnimUnits,
        width: lineWidth,
        direction: baseDir,
    };
}

type WordToken = { start: number; end: number; dominant: Script | undefined };

function buildWordTokens(items: CodepointItem[]): WordToken[] {
    const tokens: WordToken[] = [];
    let current: CodepointItem[] = [];
    const flush = () => {
        if (!current.length) return;
        const start = current[0]!.index;
        const last = current[current.length - 1]!;
        const end = last.index + last.ch.length;
        const text = current.map((i) => i.ch).join('');
        tokens.push({ start, end, dominant: dominantScript(text) });
        current = [];
    };
    for (const item of items) {
        if (!item || !item.ch) continue;
        if (item.ch.trim().length === 0) {
            flush();
            continue;
        }
        current.push(item);
    }
    flush();
    return tokens;
}

function mergeWordAnimUnits(tokens: WordToken[], animUnits: AnimUnit[]): AnimUnit[] {
    if (!animUnits.length || !tokens.length) return animUnits;

    const merged: AnimUnit[] = [];
    const groupKeyToIndex = new Map<string, number>();

    const findToken = (pos: number): WordToken | undefined =>
        tokens.find((t) => pos >= t.start && pos < t.end);

    for (const unit of animUnits) {
        const pos = unit.textRange?.[0] ?? 0;
        const token = findToken(pos);
        const shouldGroup = token?.dominant === 'arabic';
        const groupKey = shouldGroup && token ? `w:${token.start}` : `u:${unit.unitIndex}`;

        let outIndex = groupKeyToIndex.get(groupKey);
        if (outIndex === undefined) {
            outIndex = merged.length;
            groupKeyToIndex.set(groupKey, outIndex);
            merged.push({
                unitIndex: outIndex,
                textRange: unit.textRange,
                glyphIndexes: [],
            });
        }

        const dst = merged[outIndex];
        dst.glyphIndexes.push(...unit.glyphIndexes);
        dst.textRange = [
            Math.min(dst.textRange[0], unit.textRange[0]),
            Math.max(dst.textRange[1], unit.textRange[1]),
        ];
    }

    return merged;
}
