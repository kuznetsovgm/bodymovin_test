import { Animation } from "./lottie"

export type Sticker = Animation & {
    "tgs": 1
}


/**
 * v: version
 * fr: frame rate
 * ip: in point
 * op: out point
 * w: width
 * h: height
 * layers: layers
 * assets: assets
 * mn: match name
 * nm: name
 * ddd: three dimensional
 * mb: motion blur
 * meta: metadata
 * markers: markers
 * fonts: fonts
 * chars: metadata
 */
export interface ISticker {
    tgs: number,
    v: string,
    fr: number,
    ip: number,
    op: number,
    w: number,
    h: number,
    nm: string,
    ddd: number,
    assets: any[],
    layers: Layer[]
}

/**
 * nm: name
 */
export type Layer = {
    "ddd": number,
    "ind": number,
    "ty": layerType,
    "nm": string,
    "sr": number,
    "ks": Transform,
    "ao": number,
    "shapes": Shape[],
    "ip": number,
    "op": number,
    "st": number,
    "bm": number
}

export type Shape = {
    "ty": string,
    "it": {
        "ind": number,
        "ty": string,
        "ks": {
            "a": number,
            "k": {
                // inTangents
                "i": [
                    // x       
                    [number, number]
                ],
                // outTangents
                "o": [
                    [number, number]
                ],
                // vertices
                "v": [
                    // x        
                    [number, number]
                ],
                // closed
                "c": boolean
            }
        },
        "nm": string,
        "hd": boolean
    }[],
    "nm": string,
    "bm": number,
    "hd": boolean
}

/**
 * a: anchor point
 * p: position
 * s: scale
 * r: rotation
 * o: opacity
 * sk: skew
 * sa: skew axis
 * or: orientation
 */
export type Transform = {
    "p": PositionValue,
    "s": {
        "a": number,
        "k": [number, number, number]
    }
}

/**
 * a: animated
 * k: 
 */
export type PositionValue = {
    a: number,
    k: [number, number, number],
}

export enum layerType {
	precomp = 0,
    solid = 1,
    still = 2,
    nullLayer = 3,
    shape = 4,
    text = 5,
    audio = 6,
    pholderVideo = 7,
    imageSeq = 8,
    video = 9,
    pholderStill = 10,
    guide = 11,
    adjustment = 12,
    camera = 13,
    light = 14,
    data = 15,
}

export enum layerStyleTypes {
	stroke = 0,
    dropShadow = 1,
    innerShadow = 2,
    outerGlow = 3,
    innerGlow = 4,
    bevelEmboss = 5,
    satin = 6,
    colorOverlay = 7,
    gradientOverlay = 8,
}

export enum maskTypes {
    NONE = 'n',
    ADD = 'a',
    SUBTRACT = 's',
    INTERSECT = 'i',
    LIGHTEN = 'l',
    DARKEN = 'd',
	DIFFERENCE = 'f',
}

export enum shapeTypes {
	shape = 'sh',
    rect = 'rc',
    ellipse = 'el',
    star = 'sr',
    fill = 'fl',
    gfill = 'gf',
    gStroke = 'gs',
    stroke = 'st',
    merge = 'mm',
    trim = 'tm',
    twist = 'tw',
    group = 'gr',
    repeater = 'rp',
    roundedCorners = 'rd',
    offsetPath = 'op',
    puckerAndBloat = 'pb',
    zigZag = 'zz',
}