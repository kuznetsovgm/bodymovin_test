import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

import {
    GenerateStickerOptions,
    TransformAnimationType,
    ColorAnimationType,
    LetterAnimationType,
    PathMorphAnimationType,
    BackgroundLayerType,
    KnockoutBackgroundMode,
} from './index';
import { StickerConfigManager } from './config-manager';
import { stickerCache } from './cache';
import { generateSticker, stickerToBuffer } from './pipeline/generateSticker';
import {
    transformAnimationConfig,
    colorAnimationConfig,
    letterAnimationConfig,
    pathMorphAnimationConfig,
    fontAnimationConfig,
} from './config/animation-config';
import { DEFAULT_FRAME_RATE, DEFAULT_DURATION, DEFAULT_FONT_FILE } from './domain/defaults';
import { loadFont } from './layout/fontLoader';
import { fontHasCyrillic, fontSupportsText } from './layout/fontSupport';
import opentype from 'opentype.js';

const PORT = parseInt(process.env.WEB_PORT || '8080', 10);
const SECRET_PATH = normalizeSecretPath(process.env.CONFIG_UI_SECRET_PATH);

function normalizeSecretPath(raw?: string) {
    let value = (raw || '/').trim();
    if (!value) {
        return '/';
    }
    if (!value.startsWith('/')) {
        value = `/${value}`;
    }
    value = value.replace(/\/+/g, '/');
    while (value.length > 1 && value.endsWith('/')) {
        value = value.slice(0, -1);
    }
    return value || '/';
}

function getRelativePath(pathname: string): string | null {
    if (!pathname) {
        pathname = '/';
    }
    if (SECRET_PATH === '/') {
        return pathname;
    }
    if (pathname === SECRET_PATH) {
        return '/';
    }
    if (pathname.startsWith(`${SECRET_PATH}/`)) {
        const trimmed = pathname.slice(SECRET_PATH.length);
        return trimmed || '/';
    }
    return null;
}

const stickerConfigManager = new StickerConfigManager(stickerCache.getRedis());

type JsonRequest = http.IncomingMessage & { body?: any };

function sendJson(res: http.ServerResponse, status: number, data: any) {
    const json = JSON.stringify(data);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.end(json);
}

function notFound(res: http.ServerResponse) {
    res.statusCode = 404;
    res.end('Not Found');
}

function parseBody(req: JsonRequest): Promise<any> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        req.on('data', (chunk) => {
            const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            chunks.push(buf);
        });
        req.on('end', () => {
            if (!chunks.length) {
                resolve({});
                return;
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            try {
                const data = JSON.parse(raw);
                resolve(data);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', (err) => reject(err));
    });
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
    // Serve fonts (ttf/otf) from configured font directory, including glyphs subdir
    if (pathname.startsWith('/fonts/')) {
        const rel = pathname.replace(/^\/+/, '').replace(/^\.+/, '');
        const filePath = path.resolve(fontAnimationConfig.fontDirectory, rel.replace(/^fonts\//, ''));
        if (!/\.(ttf|otf)$/i.test(filePath)) {
            notFound(res);
            return;
        }
        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                notFound(res);
                return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'font/ttf');
            const stream = fs.createReadStream(filePath);
            stream.on('error', () => {
                if (!res.headersSent) res.statusCode = 500;
                res.end();
            });
            stream.pipe(res);
        });
        return;
    }

    // Serve local copy of lottie-web to avoid CDN dependency
    if (pathname === '/lottie.js') {
        const lottiePath = path.join(
            process.cwd(),
            'node_modules',
            'lottie-web',
            'build',
            'player',
            'lottie.min.js',
        );

        fs.stat(lottiePath, (err, stats) => {
            if (err || !stats.isFile()) {
                notFound(res);
                return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            const stream = fs.createReadStream(lottiePath);
            stream.on('error', () => {
                if (!res.headersSent) {
                    res.statusCode = 500;
                }
                res.end();
            });
            stream.pipe(res);
        });
        return;
    }

    if (pathname === '/lottie-player.js') {
        const playerPath = path.join(
            process.cwd(),
            'node_modules',
            '@lottiefiles',
            'lottie-player',
            'dist',
            'lottie-player.js',
        );
        fs.stat(playerPath, (err, stats) => {
            if (err || !stats.isFile()) {
                notFound(res);
                return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            const stream = fs.createReadStream(playerPath);
            stream.on('error', () => {
                if (!res.headersSent) res.statusCode = 500;
                res.end();
            });
            stream.pipe(res);
        });
        return;
    }


    // Map root to config UI
    let safePathname = pathname === '/' ? '/config.html' : pathname;
    // Prevent directory traversal
    safePathname = safePathname.replace(/(\.\.(\/|\\|$))+/g, '');

    const filePath = path.join(process.cwd(), 'public', safePathname);
    if (!filePath.startsWith(path.join(process.cwd(), 'public'))) {
        notFound(res);
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            notFound(res);
            return;
        }

        let contentType = 'text/plain; charset=utf-8';
        if (filePath.endsWith('.html')) {
            contentType = 'text/html; charset=utf-8';
        } else if (filePath.endsWith('.js')) {
            contentType = 'application/javascript; charset=utf-8';
        } else if (filePath.endsWith('.css')) {
            contentType = 'text/css; charset=utf-8';
        } else if (filePath.endsWith('.json')) {
            contentType = 'application/json; charset=utf-8';
        } else if (filePath.endsWith('.tgs') || filePath.endsWith('.gz')) {
            contentType = 'application/gzip';
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent) {
                res.statusCode = 500;
            }
            res.end();
        });
        stream.pipe(res);
    });
}

async function handleGetConfigs(res: http.ServerResponse) {
    const configs = await stickerConfigManager.getAllConfigs();
    sendJson(res, 200, { configs });
}

async function handleCreateConfig(req: JsonRequest, res: http.ServerResponse) {
    try {
        const body = await parseBody(req);
        const config = body.config as Omit<GenerateStickerOptions, 'text'>;
        const enabled = body.enabled !== undefined ? !!body.enabled : true;
        if (!config || typeof config !== 'object') {
            sendJson(res, 400, { error: 'Invalid config payload' });
            return;
        }

        const id = await stickerConfigManager.saveConfig(config, enabled);
        const isEnabled = await stickerConfigManager.isEnabled(id);
        sendJson(res, 201, { id, enabled: isEnabled });
    } catch (err: any) {
        console.error('Error creating config:', err);
        sendJson(res, 500, { error: 'Failed to create config' });
    }
}

async function handleUpdateConfig(req: JsonRequest, res: http.ServerResponse, configId: string) {
    try {
        const body = await parseBody(req);
        const config = body.config as Omit<GenerateStickerOptions, 'text'>;
        const enabled =
            body.enabled !== undefined ? !!body.enabled : await stickerConfigManager.isEnabled(configId);

        if (!config || typeof config !== 'object') {
            sendJson(res, 400, { error: 'Invalid config payload' });
            return;
        }

        const existing = await stickerConfigManager.getConfig(configId);
        if (!existing) {
            sendJson(res, 404, { error: 'Configuration not found' });
            return;
        }

        const newId = await stickerConfigManager.saveConfig(config, enabled);

        if (newId !== configId) {
            await stickerConfigManager.deleteConfig(configId);
        }

        const isEnabled = await stickerConfigManager.isEnabled(newId);
        sendJson(res, 200, { id: newId, enabled: isEnabled });
    } catch (err: any) {
        console.error('Error updating config:', err);
        sendJson(res, 500, { error: 'Failed to update config' });
    }
}

async function handleEnableConfig(res: http.ServerResponse, configId: string) {
    const ok = await stickerConfigManager.enableConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, enabled: true });
}

async function handleDisableConfig(res: http.ServerResponse, configId: string) {
    const ok = await stickerConfigManager.disableConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, enabled: false });
}

async function handleDeleteConfig(res: http.ServerResponse, configId: string) {
    const ok = await stickerConfigManager.deleteConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, deleted: true });
}

async function handlePreview(req: JsonRequest, res: http.ServerResponse) {
    try {
        const body = await parseBody(req);
        const text = (body.text ?? '').toString();
        const config = body.config as Omit<GenerateStickerOptions, 'text'>;
        if (!text || !text.trim()) {
            sendJson(res, 400, { error: 'Text is required for preview' });
            return;
        }
        if (!config || typeof config !== 'object') {
            sendJson(res, 400, { error: 'Invalid config payload' });
            return;
        }

        const opts: GenerateStickerOptions = {
            text,
            ...config,
        };
        const sticker = await generateSticker(opts);
        const buffer = await stickerToBuffer(sticker);
        const sizeBytes = buffer.length;
        const sizeKB = Math.round((sizeBytes / 1024) * 100) / 100;

        sendJson(res, 200, {
            sticker,
            sizeBytes,
            sizeKB,
        });
    } catch (err: any) {
        console.error('Error generating preview:', err);
        sendJson(res, 500, { error: 'Failed to generate preview' });
    }
}

async function handleFontSupport(req: JsonRequest, res: http.ServerResponse) {
    try {
        const body = await parseBody(req);
        const text = (body.text ?? '').toString();
        const fontFile = (body.fontFile ?? DEFAULT_FONT_FILE).toString();

        if (!text || !text.trim()) {
            sendJson(res, 400, { error: 'Text is required' });
            return;
        }

        const fontPath = path.resolve(fontAnimationConfig.fontDirectory, fontFile);
        const font = await loadFont(fontPath);

        const hasCyr = fontHasCyrillic(font);
        const supports = fontSupportsText(font, text);

        sendJson(res, 200, {
            ok: supports,
            hasCyrillic: hasCyr,
            fontFile,
        });
    } catch (err) {
        console.error('Error checking font support:', err);
        sendJson(res, 500, { error: 'Failed to check font support' });
    }
}

async function handleGlyphs(req: JsonRequest, res: http.ServerResponse, url: URL) {
    try {
        const fontName = url.searchParams.get('font');
        if (!fontName) {
            sendJson(res, 400, { error: 'font query param is required' });
            return;
        }
        const glyphPath = path.resolve(fontAnimationConfig.fontDirectory, 'glyphs', fontName);
        const plainPath = path.resolve(fontAnimationConfig.fontDirectory, fontName);
        let font: opentype.Font | null = null;
        try {
            font = await loadFont(glyphPath);
        } catch {
            // fallback
        }
        if (!font) {
            try {
                font = await loadFont(plainPath);
            } catch {
                font = null;
            }
        }
        if (!font) {
            sendJson(res, 404, { error: 'Font not found' });
            return;
        }

        const items: { char: string; codePoint: number; name?: string; commands?: number; points?: number }[] = [];
        const seen = new Set<number>();
        const total = font.numGlyphs || ((font as any).glyphs && (font as any).glyphs.length) || 0;
        for (let i = 0; i < total; i++) {
            const g: any = font.glyphs.get ? font.glyphs.get(i) : (font as any).glyphs[i];
            if (!g) continue;
            const cps: number[] = Array.isArray(g.unicodes) && g.unicodes.length
                ? g.unicodes
                : g.unicode != null
                    ? [g.unicode]
                    : [];
            cps.forEach((cp) => {
                if (!cp || typeof cp !== 'number' || seen.has(cp)) return;
                seen.add(cp);
                const ch = String.fromCodePoint(cp);
                let cmdCount = 0;
                let pointCount = 0;
                try {
                    const p = g.getPath(0, 0, 72);
                    if (p && Array.isArray(p.commands)) {
                        cmdCount = p.commands.length;
                        pointCount = p.commands.reduce((acc: number, cmd: any) => {
                            const coords = ['x', 'y', 'x1', 'y1', 'x2', 'y2'].reduce(
                                (cnt, k) => cnt + (typeof cmd[k] === 'number' ? 1 : 0),
                                0,
                            );
                            return acc + coords / 2;
                        }, 0);
                    }
                } catch {
                    // ignore
                }
                items.push({ char: ch, codePoint: cp, name: g.name, commands: cmdCount, points: pointCount });
            });
        }

        items.sort((a, b) => {
            const wa = (a.points ?? 0) + (a.commands ?? 0);
            const wb = (b.points ?? 0) + (b.commands ?? 0);
            return wa - wb; // лёгкие/нулевые вверх, тяжёлые вниз
        });

        sendJson(res, 200, {
            font: fontName,
            count: items.length,
            glyphs: items,
        });
    } catch (err) {
        console.error('Error reading glyphs:', err);
        sendJson(res, 500, { error: 'Failed to read glyphs' });
    }
}

async function handleMeta(res: http.ServerResponse) {
    let fonts: string[] = [];
    let glyphFonts: string[] = [];
    try {
        const fontsDir = path.resolve(fontAnimationConfig.fontDirectory);
        const entries = await fs.promises.readdir(fontsDir, { withFileTypes: true });
        fonts = entries
            .filter((e) => e.isFile() && /\.(ttf|otf)$/i.test(e.name))
            .map((e) => e.name);
        const glyphDir = path.resolve(fontAnimationConfig.fontDirectory, 'glyphs');
        const glyphEntries = await fs.promises.readdir(glyphDir, { withFileTypes: true });
        glyphFonts = glyphEntries
            .filter((e) => e.isFile() && /\.(ttf|otf)$/i.test(e.name))
            .map((e) => e.name);
    } catch (err) {
        console.error('Error reading fonts directory:', err);
    }

    sendJson(res, 200, {
        enums: {
            TransformAnimationType,
            ColorAnimationType,
            LetterAnimationType,
            PathMorphAnimationType,
            BackgroundLayerType,
            KnockoutBackgroundMode: {
                Fill: 'fill',
                Stroke: 'stroke',
            },
        },
        defaults: {
            frameRate: DEFAULT_FRAME_RATE,
            duration: DEFAULT_DURATION,
            fontFile: DEFAULT_FONT_FILE,
            transformAnimationConfig,
            colorAnimationConfig,
            letterAnimationConfig,
            pathMorphAnimationConfig,
            fontAnimationConfig,
            backgroundLayerTypes: [
                { value: BackgroundLayerType.Solid, label: 'Solid (плашка)' },
                { value: BackgroundLayerType.Frame, label: 'Frame (рамка)' },
                { value: BackgroundLayerType.Stripes, label: 'Stripes (полосы)' },
                { value: BackgroundLayerType.GlyphPattern, label: 'GlyphPattern' },
                { value: BackgroundLayerType.TextLike, label: 'TextLike' },
            ],
            knockoutModes: [
                { value: 'fill' as KnockoutBackgroundMode, label: 'Fill (по заливке букв)' },
                { value: 'stroke' as KnockoutBackgroundMode, label: 'Stroke (по контуру)' },
            ],
            backgroundParamMeta: {
                [BackgroundLayerType.Solid]: {
                    paddingFactor: { min: 0, max: 0.5, step: 0.01, hint: 'Доля от размера кадра' },
                    cornerRadius: { min: 0, max: 80, step: 1 },
                    scale: { min: 0, max: 5, step: 0.01 },
                    rotationDeg: { min: -360, max: 360, step: 1 },
                    opacity: { min: 0, max: 1, step: 0.01 },
                    offsetX: { min: -1000, max: 1000, step: 1 },
                    offsetY: { min: -1000, max: 1000, step: 1 },
                },
                [BackgroundLayerType.Frame]: {
                    paddingFactor: { min: 0, max: 0.5, step: 0.01 },
                    cornerRadius: { min: 0, max: 80, step: 1 },
                    scale: { min: 0, max: 5, step: 0.01 },
                    rotationDeg: { min: -360, max: 360, step: 1 },
                    opacity: { min: 0, max: 1, step: 0.01 },
                    offsetX: { min: -1000, max: 1000, step: 1 },
                    offsetY: { min: -1000, max: 1000, step: 1 },
                },
                [BackgroundLayerType.Stripes]: {
                    count: { min: 1, max: 20, step: 1 },
                    stripeHeightFactor: { min: 0.01, max: 1, step: 0.01 },
                    gapFactor: { min: 0, max: 1, step: 0.01 },
                    cornerRadius: { min: 0, max: 40, step: 1 },
                    colorPhaseStep: { min: 0, max: 1, step: 0.01 },
                    scale: { min: 0, max: 5, step: 0.01 },
                    rotationDeg: { min: -360, max: 360, step: 1 },
                    opacity: { min: 0, max: 1, step: 0.01 },
                    offsetX: { min: -1000, max: 1000, step: 1 },
                    offsetY: { min: -1000, max: 1000, step: 1 },
                },
                [BackgroundLayerType.GlyphPattern]: {
                    paddingFactor: { min: 0, max: 0.5, step: 0.01 },
                    cornerRadius: { min: 0, max: 80, step: 1 },
                    gridColumns: { min: 1, max: 10, step: 1 },
                    gridRows: { min: 1, max: 10, step: 1 },
                    spacingXFactor: { min: 0, max: 2, step: 0.05 },
                    spacingYFactor: { min: 0, max: 2, step: 0.05 },
                    colorPhaseStep: { min: 0, max: 1, step: 0.01 },
                    scale: { min: 0, max: 5, step: 0.01 },
                    rotationDeg: { min: -360, max: 360, step: 1 },
                    opacity: { min: 0, max: 1, step: 0.01 },
                    offsetX: { min: -1000, max: 1000, step: 1 },
                    offsetY: { min: -1000, max: 1000, step: 1 },
                },
                [BackgroundLayerType.TextLike]: {
                    paddingFactor: { min: 0, max: 0.5, step: 0.01 },
                    cornerRadius: { min: 0, max: 80, step: 1 },
                    colorPhaseStep: { min: 0, max: 1, step: 0.01 },
                    scale: { min: 0, max: 5, step: 0.01 },
                    rotationDeg: { min: -360, max: 360, step: 1 },
                    opacity: { min: 0, max: 1, step: 0.01 },
                    offsetX: { min: -1000, max: 1000, step: 1 },
                    offsetY: { min: -1000, max: 1000, step: 1 },
                },
            },
            backgroundDefaults: {
                solid: {
                    type: BackgroundLayerType.Solid,
                    params: { paddingFactor: 0, cornerRadius: 0 },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[0.1, 0.1, 0.1, 1]],
                                times: [0],
                                loop: false,
                            },
                        },
                    ],
                },
                frame: {
                    type: BackgroundLayerType.Frame,
                    params: { paddingFactor: 0.05, cornerRadius: 8 },
                    strokeAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[1, 1, 1, 1]],
                                times: [0],
                                loop: false,
                                strokeWidth: 4,
                            },
                        },
                    ],
                },
                stripes: {
                    type: BackgroundLayerType.Stripes,
                    params: { count: 5, stripeHeightFactor: 0.1, gapFactor: 0.05, cornerRadius: 4 },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[0.2, 0.2, 0.2, 1]],
                                times: [0],
                                loop: false,
                            },
                        },
                    ],
                },
                glyphPattern: {
                    type: BackgroundLayerType.GlyphPattern,
                    text: '*',
                    params: {
                        paddingFactor: 0.1,
                        gridColumns: 2,
                        gridRows: 2,
                        spacingXFactor: 0.3,
                        spacingYFactor: 0.3,
                        colorPhaseStep: 0.1,
                    },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[0.8, 0.8, 0.8, 1]],
                                times: [0],
                                loop: false,
                            },
                        },
                    ],
                    pathMorphAnimations: [{ type: PathMorphAnimationType.None }],
                    transformAnimations: [{ type: TransformAnimationType.None }],
                },
                glyphPatternWave: {
                    type: BackgroundLayerType.GlyphPattern,
                    text: '✦✶✷✸',
                    params: {
                        paddingFactor: 0.05,
                        gridColumns: 3,
                        gridRows: 3,
                        spacingXFactor: 0.25,
                        spacingYFactor: 0.25,
                        colorPhaseStep: 0.08,
                    },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.Rainbow,
                            params: { loop: true },
                        },
                    ],
                    pathMorphAnimations: [
                        { type: PathMorphAnimationType.Warp, params: { intensityFactor: 0.05 } },
                    ],
                    transformAnimations: [{ type: TransformAnimationType.ScalePulse }],
                },
                glyphPatternSoft: {
                    type: BackgroundLayerType.GlyphPattern,
                    text: '●◆■',
                    params: {
                        paddingFactor: 0.08,
                        gridColumns: 4,
                        gridRows: 4,
                        spacingXFactor: 0.2,
                        spacingYFactor: 0.2,
                        colorPhaseStep: 0.05,
                    },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.CycleRGB,
                            params: {
                                colors: [
                                    [0.9, 0.7, 0.7, 1],
                                    [0.7, 0.9, 0.7, 1],
                                    [0.7, 0.7, 0.9, 1],
                                ],
                                times: [0, 0.5, 1],
                                loop: true,
                            },
                        },
                    ],
                    pathMorphAnimations: [
                        { type: PathMorphAnimationType.SkewPulse, params: { intensityFactor: 0.05 } },
                    ],
                    transformAnimations: [{ type: TransformAnimationType.SlideLoop, params: { amplitudeXFactor: 0.05 } }],
                },
                textLike: {
                    type: BackgroundLayerType.TextLike,
                    text: '',
                    params: {
                        paddingFactor: 0,
                        colorPhaseStep: 0.1,
                    },
                    colorAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[0.4, 0.4, 0.4, 0.3]],
                                times: [0],
                                loop: false,
                            },
                        },
                    ],
                },
                knockout: {
                    mode: 'fill' as KnockoutBackgroundMode,
                    paddingFactor: 0,
                    cornerRadiusFactor: 0,
                    colorAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[0, 0, 0, 0.8]],
                                times: [0],
                                loop: false,
                            },
                        },
                    ],
                    strokeAnimations: [
                        {
                            type: ColorAnimationType.None,
                            params: {
                                colors: [[1, 1, 1, 1]],
                                times: [0],
                                loop: false,
                                strokeWidth: 2,
                            },
                        },
                    ],
                },
            },
        },
        fonts,
        glyphFonts,
    });
}

const server = http.createServer(async (req: JsonRequest, res) => {
    try {
        const method = req.method || 'GET';
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const relativePath = getRelativePath(url.pathname);

        if (relativePath === null) {
            notFound(res);
            return;
        }

        const needsSecretSlashRedirect =
            SECRET_PATH !== '/' && url.pathname === SECRET_PATH && !url.pathname.endsWith('/');
        if (needsSecretSlashRedirect) {
            res.statusCode = 302;
            res.setHeader('Location', `${SECRET_PATH}/`);
            res.end();
            return;
        }

        if (relativePath.startsWith('/api/')) {
            if (relativePath === '/api/configs' && method === 'GET') {
                await handleGetConfigs(res);
                return;
            }
            if (relativePath === '/api/configs' && method === 'POST') {
                await handleCreateConfig(req, res);
                return;
            }
            if (relativePath === '/api/meta' && method === 'GET') {
                await handleMeta(res);
                return;
            }
            if (relativePath === '/api/preview' && method === 'POST') {
                await handlePreview(req, res);
                return;
            }
            if (relativePath === '/api/glyphs' && method === 'GET') {
                await handleGlyphs(req, res, url);
                return;
            }
            if (relativePath === '/api/font-support' && method === 'POST') {
                await handleFontSupport(req, res);
                return;
            }

            const configIdMatch = relativePath.match(/^\/api\/configs\/([^/]+)(?:\/(enable|disable))?$/);
            if (configIdMatch) {
                const configId = configIdMatch[1];
                const action = configIdMatch[2];

                if (!action) {
                    if (method === 'PUT') {
                        await handleUpdateConfig(req, res, configId);
                        return;
                    }
                    if (method === 'DELETE') {
                        await handleDeleteConfig(res, configId);
                        return;
                    }
                } else if (method === 'POST') {
                    if (action === 'enable') {
                        await handleEnableConfig(res, configId);
                        return;
                    }
                    if (action === 'disable') {
                        await handleDisableConfig(res, configId);
                        return;
                    }
                }
            }

            notFound(res);
            return;
        }

        serveStatic(req, res, relativePath);
    } catch (err) {
        console.error('Unhandled server error:', err);
        if (!res.headersSent) {
            sendJson(res, 500, { error: 'Internal server error' });
        } else {
            res.end();
        }
    }
});

server.listen(PORT, () => {
    const suffix = SECRET_PATH === '/' ? '' : SECRET_PATH;
    console.log(`Sticker config web UI listening on http://localhost:${PORT}${suffix}`);
});
