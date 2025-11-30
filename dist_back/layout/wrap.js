"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapAndScaleText = void 0;
function wrapAndScaleText(text, font, initialFontSize, maxWidth, maxHeight) {
    let size = initialFontSize;
    let lines = [];
    const wrap = (fsz) => {
        // Разбиваем по явным переносам, затем внутри каждой строки переносим по словам
        const explicitLines = text.split('\n');
        const out = [];
        for (const explicitLine of explicitLines) {
            const words = explicitLine.split(' ');
            let line = '';
            for (const w of words) {
                const test = line ? line + ' ' + w : w;
                const wWidth = font.getAdvanceWidth(test, fsz);
                if (wWidth <= maxWidth) {
                    line = test;
                }
                else {
                    if (line)
                        out.push(line);
                    line = w;
                }
            }
            if (line)
                out.push(line);
        }
        return out;
    };
    for (let a = 0; a < 20; a++) {
        lines = wrap(size);
        const lh = size * 1.2;
        const total = lines.length * lh;
        const allFit = lines.every((l) => font.getAdvanceWidth(l, size) <= maxWidth);
        if (allFit && total <= maxHeight)
            break;
        size *= 0.9;
    }
    return { lines, finalFontSize: size };
}
exports.wrapAndScaleText = wrapAndScaleText;
//# sourceMappingURL=wrap.js.map