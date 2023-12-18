import * as zlib from 'zlib';
import * as fs from 'fs/promises';
import * as path from 'path';
// import Fontkit from 'fontkit';
import opentype from 'opentype.js'
// import Snap from 'snapsvg';
// import Raphael from 'raphael';
// import { JSDOM } from 'jsdom';
import { Sticker } from './src/interfaces/sticker';
import { Bezier, FillShape, GroupShapeElement, Layer, PathShape, ShapeElement, ShapeLayer, ShapeType, TransformShape } from './src/interfaces/lottie';

const h1Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 1,
    hd: false,
    nm: 'letter_h1',
    cix: 456,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, 0],
                [0, 0],
                [0, 0],
                [0.801, -0.967],
                [1.425, 0],
                [0.82, 0.967],
                [0, 1.465],
                [0, 0],
                [-0.811, 0.967],
                [-1.465, 0],
                [-0.801, -0.967],
                [0, -1.465],
                [0, 0],
                [0, 0],
                [0, 0],
                [-0.801, 0.967],
                [-1.446, 0],
                [-0.82, -0.967],
                [0, -1.465],
                [0, 0],
                [0.81, -0.967],
                [1.445, 0],
                [0.81, 0.967],
                [0, 1.465]
            ],
            "o": [
                [0, 0],
                [0, 0],
                [0, 1.465],
                [-0.801, 0.967],
                [-1.446, 0],
                [-0.82, -0.967],
                [0, 0],
                [0, -1.465],
                [0.81, -0.967],
                [1.425, 0],
                [0.801, 0.967],
                [0, 0],
                [0, 0],
                [0, 0],
                [0, -1.465],
                [0.801, -0.967],
                [1.425, 0],
                [0.82, 0.967],
                [0, 0],
                [0, 1.465],
                [-0.811, 0.967],
                [-1.426, 0],
                [-0.811, -0.967],
                [0, 0]
            ],
            "v": [
                [8.525, 3.633],
                [-8.525, 3.633],
                [-8.525, 15.498],
                [-9.727, 19.145],
                [-13.066, 20.596],
                [-16.465, 19.145],
                [-17.695, 15.498],
                [-17.695, -15.498],
                [-16.48, -19.146],
                [-13.066, -20.596],
                [-9.727, -19.146],
                [-8.525, -15.498],
                [-8.525, -4.6],
                [8.525, -4.6],
                [8.525, -15.498],
                [9.727, -19.146],
                [13.096, -20.596],
                [16.465, -19.146],
                [17.695, -15.498],
                [17.695, 15.498],
                [16.479, 19.145],
                [13.096, 20.596],
                [9.741, 19.145],
                [8.525, 15.498]
            ],
            "c": true
        }
    }
}
const e1Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 1,
    hd: false,
    nm: 'letter_e1',
    cix: 456,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, 0],
                [0.859, 0.898],
                [1.66, 0],
                [1.015, -1.113],
                [0.566, -1.68]
            ],
            "o": [
                [-0.43, -1.699],
                [-1.036, -1.074],
                [-1.543, 0],
                [-0.801, 0.879],
                [0, 0]
            ],
            "v": [
                [5.933, 2.754],
                [3.999, -1.143],
                [-0.044, -2.754],
                [-3.882, -1.084],
                [-5.933, 2.754]
            ],
            "c": true
        }
    }
}
const e2Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 1,
    hd: false,
    nm: 'letter_e2',
    cix: 456,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, 0],
                [-0.352, -0.527],
                [-0.664, -0.469],
                [-1.563, 0],
                [-1.602, 0.801],
                [0, 0],
                [-0.283, 0.069],
                [-0.332, 0.04],
                [-0.752, -0.713],
                [0, -0.977],
                [0.781, -0.859],
                [1.035, -0.605],
                [1.699, -0.4],
                [1.758, 0],
                [2.148, 0.938],
                [1.542, 1.875],
                [0.498, 1.68],
                [0, 2.07],
                [-2.911, 3.066],
                [-4.297, 0],
                [-2.794, -2.89],
                [0, -4.023],
                [0.576, -0.634],
                [1.367, 0]
            ],
            "o": [
                [0.312, 0.898],
                [0.429, 0.664],
                [1.211, 0.919],
                [1.718, 0],
                [0, 0],
                [0.215, -0.098],
                [0.283, -0.068],
                [1.015, 0],
                [0.751, 0.713],
                [0, 0.938],
                [-0.547, 0.605],
                [-1.446, 0.82],
                [-1.699, 0.4],
                [-2.48, 0],
                [-2.149, -0.938],
                [-1.191, -1.445],
                [-0.498, -1.68],
                [0, -4.316],
                [2.91, -3.066],
                [4.082, 0],
                [2.793, 2.891],
                [0, 1.406],
                [-0.576, 0.635],
                [0, 0]
            ],
            "v": [
                [-6.001, 7.915],
                [-5.005, 10.054],
                [-3.364, 11.753],
                [0.796, 13.13],
                [5.776, 11.929],
                [8.296, 10.669],
                [9.043, 10.42],
                [9.966, 10.259],
                [12.617, 11.328],
                [13.745, 13.862],
                [12.573, 16.558],
                [10.2, 18.374],
                [5.483, 20.205],
                [0.298, 20.806],
                [-6.645, 19.399],
                [-12.183, 15.181],
                [-14.717, 10.493],
                [-15.464, 4.868],
                [-11.099, -6.206],
                [-0.288, -10.806],
                [10.024, -6.47],
                [14.214, 3.901],
                [13.35, 6.963],
                [10.435, 7.915]
            ],
            "c": true
        }
    }
}
const l1Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 1,
    hd: false,
    nm: 'letter_i1',
    cix: 456,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, -1.385],
                [0, 0],
                [0.781, -0.927],
                [1.406, 0],
                [0.791, 0.947],
                [0, 1.386],
                [0, 0],
                [-0.772, 0.928],
                [-1.367, 0],
                [-0.801, -0.927]
            ],
            "o": [
                [0, 0],
                [0, 1.425],
                [-0.781, 0.927],
                [-1.329, 0],
                [-0.791, -0.947],
                [0, 0],
                [0, -1.385],
                [0.771, -0.927],
                [1.367, 0],
                [0.801, 0.928]
            ],
            "v": [
                [4.409, -17.318],
                [4.409, 17.259],
                [3.237, 20.787],
                [-0.044, 22.178],
                [-3.223, 20.758],
                [-4.409, 17.259],
                [-4.409, -17.318],
                [-3.252, -20.787],
                [-0.044, -22.178],
                [3.208, -20.787]
            ],
            "c": true
        }
    }
}
const o1Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 0,
    hd: false,
    nm: 'letter_o1',
    cix: 2534,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, -1.914],
                [-0.977, -1.445],
                [-1.836, 0],
                [-1.191, 1.622],
                [0, 1.953],
                [1.074, 1.484],
                [1.894, 0],
                [1.113, -1.68]
            ],
            "o": [
                [0, 1.934],
                [1.113, 1.66],
                [1.894, 0],
                [1.074, -1.465],
                [0, -1.953],
                [-1.191, -1.641],
                [-1.836, 0],
                [-0.977, 1.484]
            ],
            "v": [
                [-6.064, 0.033],
                [-4.6, 5.101],
                [-0.176, 7.591],
                [4.453, 5.16],
                [6.064, 0.033],
                [4.453, -5.124],
                [-0.176, -7.584],
                [-4.6, -5.065]
            ],
            "c": true
        }
    }
}
const o2Shape: PathShape = {
    ty: ShapeType.Path,
    ind: 1,
    hd: false,
    nm: 'letter_o2',
    cix: 2346534,
    bm: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            "i": [
                [0, 2.09],
                [-0.634, 1.865],
                [-1.358, 1.475],
                [-0.431, 0.37],
                [-1.377, 0.622],
                [-1.992, 0],
                [-1.894, -0.85],
                [-1.373, -1.517],
                [-0.645, -1.904],
                [0, -2.109],
                [0.644, -1.914],
                [1.338, -1.484],
                [1.885, -0.839],
                [2.031, 0],
                [1.904, 0.839],
                [1.358, 1.465],
                [0.645, 1.904]
            ],
            "o": [
                [0, -2.148],
                [0.634, -1.865],
                [0.386, -0.419],
                [1.087, -0.933],
                [1.923, -0.869],
                [2.031, 0],
                [1.894, 0.85],
                [1.309, 1.446],
                [0.645, 1.904],
                [0, 2.032],
                [-0.644, 1.915],
                [-1.338, 1.484],
                [-1.885, 0.839],
                [-2.051, 0],
                [-1.904, -0.839],
                [-1.358, -1.465],
                [-0.645, -1.904]
            ],
            "v": [
                [-14.722, 0.047],
                [-13.77, -5.973],
                [-10.781, -10.983],
                [-9.556, -12.166],
                [-5.859, -14.499],
                [0.015, -15.802],
                [5.903, -14.528],
                [10.825, -10.998],
                [13.755, -5.973],
                [14.722, 0.047],
                [13.755, 5.965],
                [10.781, 11.063],
                [5.947, 14.549],
                [0.073, 15.809],
                [-5.859, 14.549],
                [-10.752, 11.092],
                [-13.755, 6.039]
            ],
            "c": true
        }
    }
}
const shape: PathShape = {
    nm: "Path 1",
    hd: false,
    ty: ShapeType.Path,
    cix: 0,
    bm: 0,
    ind: 0,
    ks: {
        ix: 0,
        a: 0,
        k: {
            i: [
                [0, 0],
                [-25, 0],
                [0, 0]
            ],
            o: [
                [0, 0],
                [25, 0],
                [0, 0]
            ],
            v: [
                [0, 0],
                [25, 50],
                [50, 0]
            ],
            c: true
        }
    },
};
const fill: FillShape = {
    cix: 1,
    ty: ShapeType.Fill,
    c: {
        a: 0,
        k: [0, 1, 0],
        ix: 0,
    },
    o: {
        a: 0,
        k: 100
    },
    r: 1,
    bm: 0,
    nm: "Fill 1",
    hd: false
};
const animatedFill: FillShape = {
    cix: 2,
    ty: ShapeType.Fill,
    c: {
        a: 1,
        k: [
            {
                t: 0,
                s: [1, 0, 0, 1],
                i: {
                    x: [0.45],
                    y: [0]
                },
                o: {
                    x: [0.55],
                    y: [0]
                },
            },
            {
                t: 90,
                s: [0, 0, 1, 1],
                i: {
                    x: [0.45],
                    y: [0]
                },
                o: {
                    x: [0.55],
                    y: [0]
                },
            },
            {
                t: 179,
                s: [1, 0, 0, 1],
            }
        ],
        ix: 5,
    },
    o: {
        a: 0,
        k: 100
    },
    r: 1,
    bm: 0,
    nm: "Fill 1",
    hd: false
};
const transform: TransformShape = {
    cix: 3,
    ty: ShapeType.TransformShape,
    bm: 0,
    nm: "Transform",
    hd: false,
    p: {
        a: 0,
        k: [0, 0]
    },
    a: {
        a: 0,
        k: [0, 0]
    },
    s: {
        a: 0,
        k: [300, 300]
    },
    r: {
        a: 0,
        k: 0
    },
    o: {
        a: 0,
        k: 100
    },
    sk: {
        a: 0,
        k: 0
    },
    sa: {
        a: 0,
        k: 0
    },
};


const eShape: GroupShapeElement = {
    ty: ShapeType.Group,
    cix: 3,
    np: 1,
    it: [e1Shape, e2Shape],
    nm: "letter_h",
    bm: 0,
    hd: false
}
const hShape: GroupShapeElement = {
    ty: ShapeType.Group,
    cix: 3,
    np: 1,
    it: [h1Shape],
    nm: "letter_h",
    bm: 0,
    hd: false
}
const lShape: GroupShapeElement = {
    ty: ShapeType.Group,
    cix: 3,
    np: 1,
    it: [l1Shape],
    nm: "letter_i",
    bm: 0,
    hd: false
}
const oShape: GroupShapeElement = {
    ty: ShapeType.Group,
    cix: 3,
    np: 1,
    it: [o1Shape, o2Shape],
    nm: "letter_o",
    bm: 0,
    hd: false
}

const FONT = 'CyrillicRound.ttf';
const word = 'hello';
const baseObj: Sticker = {
    tgs: 1,
    v: "5.5.2",
    fr: 60,
    ip: 0,
    op: 180,
    w: 512,
    h: 512,
    nm: "Comp 1",
    ddd: 0,
    assets: [],
    layers: []
}

// async function init() {

//     // const font = await fs.readFile(path.resolve(`./fonts/${FONT}`), { encoding: 'binary' });
//     // const fontObject = Fontkit.create(Buffer.from(font, 'binary'));
//     // const glyphs = fontObject.glyphsForString('hello');
//     // const svg = glyphs[0].path.toSVG();
//     // console.log(svg);
//     const fontObject = await promisify<opentype.Font>(opentype.load, path.resolve(`./fonts/${FONT}`));
//     console.log(fontObject.getPath('Hello', 512, 512, 14));
    

//     console.log('done');
// }

async function init() {
    const obj = baseObj;
    obj.layers = [];
    const newLayer: ShapeLayer = {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'dgfdsgdsfg',
        sr: 1,
        ks: {
            p: {
                a: 0,
                k: [0, 0, 0],
            },
            a: {
                a: 0,
                k: [0, 0],
            },
            s: {
                a: 0,
                k: [],
            },
            r: {
                a: 0,
                k: 0,
            }
        },
        ao: 0,
        shapes: [],
        ip: 0,
        op: 180,
        st: 0,
        bm: 0,
    }
    const padding = 5;
    const scale = (obj.w - padding * 2) / word.length;
    const offset = (obj.w - padding * 2) / word.length;
    const lettersShape: GroupShapeElement = {
        ty: ShapeType.Group,
        cix: 3,
        np: 1,
        it: [],
        nm: "letters",
        bm: 0,
        hd: false
    }
    for(let i = 0; i < word.length; i++) {
        const letter = word[i];
        let shape: GroupShapeElement;
        switch (letter) {
            case 'h': shape = hShape; break;
            case 'e': shape = eShape; break;
            case 'l': shape = lShape; break;
            case 'o': shape = oShape; break;
            default: continue;
        }

        const el: PathShape = shape.it[0] as PathShape;
        const bezier: Bezier = el.ks.k as Bezier;
        const maxX = Math.max(...bezier.v.map(value => Math.abs(value[0])));

        const transform: TransformShape = {
            cix: i + 10,
            ty: ShapeType.TransformShape,
            bm: 0,
            nm: "Transform" + i,
            hd: false,
            p: {
                a: 0,
                k: [(padding + offset * i) + maxX, 256]
            },
            a: {
                a: 0,
                k: [0, 0]
            },
            s: {
                a: 0,
                k: [scale, scale]
            },
            r: {
                a: 0,
                k: 0
            },
            o: {
                a: 0,
                k: 100
            },
            sk: {
                a: 0,
                k: 0
            },
            sa: {
                a: 0,
                k: 0
            },
        }
        
        const group: GroupShapeElement = {
            ty: ShapeType.Group,
            cix: i + 20,
            np: 1,
            it: [shape, transform],
            nm: "letter_" + i,
            bm: 0,
            hd: false
        };
        lettersShape.it.push(group);
    }

    newLayer.shapes.push(lettersShape, animatedFill);
    obj.layers.push(newLayer);

    const unzippedNewBuffer = JSON.stringify(obj);
    const zippedNewBuffer = await promisify<Buffer>(zlib.gzip, unzippedNewBuffer);
    await fs.writeFile(path.resolve('./stickers/o'), unzippedNewBuffer);
    await fs.writeFile(path.resolve('./stickers/o.tgs'), zippedNewBuffer);

    console.log('done');
}

async function promisify<T = any>(func: (...args: any[]) => any, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
        func(...args, (err: Error | undefined, res: T) => {
            if (!!err) {
                return reject(err);
            }

            return resolve(res);
        });
    })
}

init();