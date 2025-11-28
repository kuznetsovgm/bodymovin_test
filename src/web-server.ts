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
} from './index';
import { StickerConfigManager } from './config-manager';
import { stickerCache } from './cache';
import { generateTextSticker, stickerToBuffer } from './pipeline/generateSticker';
import {
    transformAnimationConfig,
    colorAnimationConfig,
    letterAnimationConfig,
    pathMorphAnimationConfig,
    fontAnimationConfig,
} from './config/animation-config';
import {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    DEFAULT_FRAME_RATE,
    DEFAULT_DURATION,
    DEFAULT_FONT_SIZE,
    DEFAULT_FONT_FILE,
} from './domain/defaults';

const PORT = parseInt(process.env.WEB_PORT || '8080', 10);

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

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    // Serve local copy of lottie-web to avoid CDN dependency
    if (url.pathname === '/lottie.js') {
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

    if (url.pathname === '/lottie-player.js') {
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
    let pathname = url.pathname === '/' ? '/config.html' : url.pathname;
    // Prevent directory traversal
    pathname = pathname.replace(/(\.\.(\/|\\|$))+/g, '');

    const filePath = path.join(process.cwd(), 'public', pathname);
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
        const sticker = await generateTextSticker(opts);
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

async function handleMeta(res: http.ServerResponse) {
    let fonts: string[] = [];
    try {
        const fontsDir = path.resolve(fontAnimationConfig.fontDirectory);
        const entries = await fs.promises.readdir(fontsDir, { withFileTypes: true });
        fonts = entries
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
        },
        defaults: {
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            frameRate: DEFAULT_FRAME_RATE,
            duration: DEFAULT_DURATION,
            fontSize: DEFAULT_FONT_SIZE,
            fontFile: DEFAULT_FONT_FILE,
            transformAnimationConfig,
            colorAnimationConfig,
            letterAnimationConfig,
            pathMorphAnimationConfig,
            fontAnimationConfig,
        },
        fonts,
    });
}

const server = http.createServer(async (req: JsonRequest, res) => {
    try {
        const method = req.method || 'GET';
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (url.pathname.startsWith('/api/')) {
            if (url.pathname === '/api/configs' && method === 'GET') {
                await handleGetConfigs(res);
                return;
            }
            if (url.pathname === '/api/configs' && method === 'POST') {
                await handleCreateConfig(req, res);
                return;
            }
            if (url.pathname === '/api/meta' && method === 'GET') {
                await handleMeta(res);
                return;
            }
            if (url.pathname === '/api/preview' && method === 'POST') {
                await handlePreview(req, res);
                return;
            }

            const configIdMatch = url.pathname.match(/^\/api\/configs\/([^/]+)(?:\/(enable|disable))?$/);
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

        serveStatic(req, res, url);
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
    console.log(`Sticker config web UI listening on http://localhost:${PORT}`);
});
