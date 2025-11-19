export function seededNoise(base: number, salt: number = 0) {
    const v = Math.sin(base * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
}

export function buildLetterSeed(letterIndex: number, charCode: number, globalSeed: number = 0) {
    return (letterIndex + 1) * 97.13 + charCode * 0.61 + globalSeed * 0.37;
}
