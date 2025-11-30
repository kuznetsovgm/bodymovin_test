"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveStickerToFile = exports.generateTextSticker = exports.ColorAnimationType = exports.TransformAnimationType = void 0;
const zlib = __importStar(require("zlib"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const opentype_js_1 = __importDefault(require("opentype.js"));
const lottie_1 = require("./interfaces/lottie");
var TransformAnimationType;
(function (TransformAnimationType) {
    TransformAnimationType["None"] = "none";
    TransformAnimationType["SlideLoop"] = "slideLoop";
    TransformAnimationType["ScalePulse"] = "scalePulse";
    TransformAnimationType["RotateContinuous"] = "rotateContinuous";
    TransformAnimationType["ShakeLoop"] = "shakeLoop";
    TransformAnimationType["Bounce"] = "bounce";
})(TransformAnimationType || (exports.TransformAnimationType = TransformAnimationType = {}));
var ColorAnimationType;
(function (ColorAnimationType) {
    ColorAnimationType["None"] = "none";
    ColorAnimationType["CycleRGB"] = "cycleRGB";
    ColorAnimationType["Pulse"] = "pulse";
})(ColorAnimationType || (exports.ColorAnimationType = ColorAnimationType = {}));
const FONT = 'CyrillicRound.ttf';
async function generateTextSticker(opts) {
    const { text, transformAnimation = TransformAnimationType.None, colorAnimation = ColorAnimationType.None, fontSize = 72, fontPath = path.resolve(`./fonts/${FONT}`), width = 512, height = 512, frameRate = 60, duration = 180 } = opts;
    const fontObj = await promisify(opentype_js_1.default.load, fontPath);
    const sticker = { tgs: 1, v: '5.5.2', fr: frameRate, ip: 0, op: duration, w: width, h: height, nm: `Text: ${text}`, ddd: 0, assets: [], layers: [] };
    const layer = { ddd: 0, ind: 1, ty: 4, nm: 'Text Layer', sr: 1, ks: { p: { a: 0, k: [width / 2, height / 2, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } }, ao: 0, shapes: [], ip: 0, op: duration, st: 0, bm: 0 };
    switch (transformAnimation) {
        case TransformAnimationType.SlideLoop: {
            const amp = width * 0.3;
            layer.ks.p = { a: 1, k: [{ t: 0, s: [width / 2 - amp, height / 2, 0] }, { t: duration / 2, s: [width / 2 + amp, height / 2, 0] }, { t: duration, s: [width / 2 - amp, height / 2, 0] }] };
            break;
        }
        case TransformAnimationType.ScalePulse: {
            layer.ks.s = { a: 1, k: [{ t: 0, s: [90, 90, 100] }, { t: duration / 2, s: [120, 120, 100] }, { t: duration, s: [90, 90, 100] }] };
            break;
        }
        case TransformAnimationType.RotateContinuous: {
            layer.ks.r = { a: 1, k: [{ t: 0, s: 0 }, { t: duration, s: 360 }] };
            break;
        }
        case TransformAnimationType.ShakeLoop: {
            const steps = 16, intensity = 20, keys = [];
            for (let f = 0; f <= steps; f++) {
                const t = (f / steps) * duration;
                const off = ((f % 2 === 0) ? intensity : -intensity) * (1 - f / steps);
                keys.push({ t, s: [width / 2 + off, height / 2, 0] });
            }
            keys[keys.length - 1].s = [width / 2, height / 2, 0];
            layer.ks.p = { a: 1, k: keys };
            break;
        }
        case TransformAnimationType.Bounce: {
            const hAmp = height * 0.08;
            layer.ks.p = { a: 1, k: [{ t: 0, s: [width / 2, height / 2, 0] }, { t: duration * 0.25, s: [width / 2, height / 2 - hAmp, 0] }, { t: duration * 0.5, s: [width / 2, height / 2, 0] }, { t: duration * 0.75, s: [width / 2, height / 2 - hAmp * 0.5, 0] }, { t: duration, s: [width / 2, height / 2, 0] }] };
            break;
        }
        case TransformAnimationType.None:
        default: break;
    }
    const lettersGroup = convertTextToShapes(text, fontObj, fontSize);
    const fill = createFill(colorAnimation, duration);
    layer.shapes.push(lettersGroup, fill);
    sticker.layers.push(layer);
    return sticker;
}
exports.generateTextSticker = generateTextSticker;
function convertTextToShapes(text, font, fontSize) { const group = { ty: lottie_1.ShapeType.Group, cix: 1, np: 1, it: [], nm: 'letters', bm: 0, hd: false }; const total = font.getAdvanceWidth(text, fontSize); let x = -total / 2; for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const glyph = font.charToGlyph(ch);
    if (!glyph)
        continue;
    const path = glyph.getPath(0, 0, fontSize);
    const bez = convertOpentypePathToBezier(path);
    if (!bez)
        continue;
    const adv = glyph.advanceWidth * fontSize / font.unitsPerEm;
    const pathShape = { ty: lottie_1.ShapeType.Path, ind: i, hd: false, nm: `letter_${ch}_${i}`, cix: 100 + i, bm: 0, ks: { ix: 0, a: 0, k: bez } };
    const transform = createStaticTransform(i, x + adv / 2);
    const letterGroup = { ty: lottie_1.ShapeType.Group, cix: 300 + i, np: 1, it: [pathShape, transform], nm: `letter_${i}`, bm: 0, hd: false };
    group.it.push(letterGroup);
    x += adv;
} return group; }
function createStaticTransform(index, x) { return { cix: 200 + index, ty: lottie_1.ShapeType.TransformShape, bm: 0, nm: `Transform_${index}`, hd: false, p: { a: 0, k: [x, 0], ix: 2 }, a: { a: 0, k: [0, 0], ix: 1 }, s: { a: 0, k: [100, 100], ix: 3 }, r: { a: 0, k: 0, ix: 6 }, o: { a: 0, k: 100, ix: 7 }, sk: { a: 0, k: 0, ix: 4 }, sa: { a: 0, k: 0, ix: 5 } }; }
function convertOpentypePathToBezier(pathObj) { const cmds = pathObj.commands; if (!cmds || !cmds.length)
    return null; const inT = []; const outT = []; const v = []; for (let i = 0; i < cmds.length; i++) {
    const c = cmds[i];
    switch (c.type) {
        case 'M':
            v.push([c.x, c.y]);
            inT.push([0, 0]);
            outT.push([0, 0]);
            break;
        case 'L':
            v.push([c.x, c.y]);
            inT.push([0, 0]);
            outT.push([0, 0]);
            break;
        case 'C': {
            const last = v[v.length - 1];
            outT[outT.length - 1] = [c.x1 - last[0], c.y1 - last[1]];
            v.push([c.x, c.y]);
            inT.push([c.x2 - c.x, c.y2 - c.y]);
            outT.push([0, 0]);
            break;
        }
        case 'Q': break;
        case 'Z': break;
    }
} return { c: true, i: inT, o: outT, v }; }
function createFill(colorAnimation, duration) { switch (colorAnimation) {
    case ColorAnimationType.CycleRGB: return { cix: 2, ty: lottie_1.ShapeType.Fill, c: { a: 1, k: [{ t: 0, s: [1, 0, 0, 1] }, { t: duration / 3, s: [0, 1, 0, 1] }, { t: (2 * duration) / 3, s: [0, 0, 1, 1] }, { t: duration, s: [1, 0, 0, 1] }], ix: 5 }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: 'Fill RGB Cycle', hd: false };
    case ColorAnimationType.Pulse: return { cix: 3, ty: lottie_1.ShapeType.Fill, c: { a: 1, k: [{ t: 0, s: [1, 1, 1, 1] }, { t: duration / 2, s: [1, 0.7, 0.2, 1] }, { t: duration, s: [1, 1, 1, 1] }], ix: 5 }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: 'Fill Pulse', hd: false };
    case ColorAnimationType.None:
    default: return { cix: 1, ty: lottie_1.ShapeType.Fill, c: { a: 0, k: [1, 1, 1], ix: 0 }, o: { a: 0, k: 100 }, r: 1, bm: 0, nm: 'Fill Static', hd: false };
} }
async function saveStickerToFile(sticker, outPath) { const json = JSON.stringify(sticker); const gz = await promisify(zlib.gzip, json); await ensureDir('./stickers'); await fs.writeFile(outPath, gz); }
exports.saveStickerToFile = saveStickerToFile;
async function ensureDir(p) { try {
    await fs.mkdir(path.resolve(p), { recursive: true });
}
catch { } }
async function init() { const examples = [{ name: 'slide_loop', opts: { text: 'SLIDE', transformAnimation: TransformAnimationType.SlideLoop } }, { name: 'scale_rgb', opts: { text: 'SCALE', transformAnimation: TransformAnimationType.ScalePulse, colorAnimation: ColorAnimationType.CycleRGB } }, { name: 'rotate_pulse', opts: { text: 'ROTATE', transformAnimation: TransformAnimationType.RotateContinuous, colorAnimation: ColorAnimationType.Pulse } }, { name: 'shake_rgb', opts: { text: 'SHAKE', transformAnimation: TransformAnimationType.ShakeLoop, colorAnimation: ColorAnimationType.CycleRGB } }, { name: 'bounce_pulse', opts: { text: 'BOUNCE', transformAnimation: TransformAnimationType.Bounce, colorAnimation: ColorAnimationType.Pulse } }, { name: 'static', opts: { text: 'STATIC', transformAnimation: TransformAnimationType.None, colorAnimation: ColorAnimationType.None } }]; for (const ex of examples) {
    const sticker = await generateTextSticker(ex.opts);
    await saveStickerToFile(sticker, path.resolve(`./stickers/${ex.name}.tgs`));
    await fs.writeFile(path.resolve(`./stickers/${ex.name}.json`), JSON.stringify(sticker, null, 2));
} }
async function promisify(fn, ...args) { return new Promise((resolve, reject) => { fn(...args, (err, res) => { if (err)
    return reject(err); resolve(res); }); }); }
init();
//# sourceMappingURL=index_clean.js.map