import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';

export async function ensureDir(p: string) {
    await fs.mkdir(path.resolve(p), { recursive: true });
}

export async function writeJsonGz(obj: any, outPath: string) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const gz = await promisify<Buffer>(zlib.gzip, json);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, gz as any);
}

export async function jsonToGzBuffer(obj: any): Promise<Buffer> {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return await promisify<Buffer>(zlib.gzip, json);
}

export async function promisify<T = any>(
    fn: Function,
    ...args: any[]
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        fn(...args, (err: any, data: T) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
