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
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const index_1 = require("./index");
const config_manager_1 = require("./config-manager");
const cache_1 = require("./cache");
const generateSticker_1 = require("./pipeline/generateSticker");
const animation_config_1 = require("./config/animation-config");
const defaults_1 = require("./domain/defaults");
const fontLoader_1 = require("./layout/fontLoader");
const fontSupport_1 = require("./layout/fontSupport");
const PORT = parseInt(process.env.WEB_PORT || '8080', 10);
const SECRET_PATH = normalizeSecretPath(process.env.CONFIG_UI_SECRET_PATH);
function normalizeSecretPath(raw) {
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
function getRelativePath(pathname) {
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
const stickerConfigManager = new config_manager_1.StickerConfigManager(cache_1.stickerCache.getRedis());
function sendJson(res, status, data) {
    const json = JSON.stringify(data);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(json));
    res.end(json);
}
function notFound(res) {
    res.statusCode = 404;
    res.end('Not Found');
}
function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
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
            }
            catch (err) {
                reject(err);
            }
        });
        req.on('error', (err) => reject(err));
    });
}
function serveStatic(req, res, pathname) {
    // Serve local copy of lottie-web to avoid CDN dependency
    if (pathname === '/lottie.js') {
        const lottiePath = path.join(process.cwd(), 'node_modules', 'lottie-web', 'build', 'player', 'lottie.min.js');
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
        const playerPath = path.join(process.cwd(), 'node_modules', '@lottiefiles', 'lottie-player', 'dist', 'lottie-player.js');
        fs.stat(playerPath, (err, stats) => {
            if (err || !stats.isFile()) {
                notFound(res);
                return;
            }
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            const stream = fs.createReadStream(playerPath);
            stream.on('error', () => {
                if (!res.headersSent)
                    res.statusCode = 500;
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
        }
        else if (filePath.endsWith('.js')) {
            contentType = 'application/javascript; charset=utf-8';
        }
        else if (filePath.endsWith('.css')) {
            contentType = 'text/css; charset=utf-8';
        }
        else if (filePath.endsWith('.json')) {
            contentType = 'application/json; charset=utf-8';
        }
        else if (filePath.endsWith('.tgs') || filePath.endsWith('.gz')) {
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
async function handleGetConfigs(res) {
    const configs = await stickerConfigManager.getAllConfigs();
    sendJson(res, 200, { configs });
}
async function handleCreateConfig(req, res) {
    try {
        const body = await parseBody(req);
        const config = body.config;
        const enabled = body.enabled !== undefined ? !!body.enabled : true;
        if (!config || typeof config !== 'object') {
            sendJson(res, 400, { error: 'Invalid config payload' });
            return;
        }
        const id = await stickerConfigManager.saveConfig(config, enabled);
        const isEnabled = await stickerConfigManager.isEnabled(id);
        sendJson(res, 201, { id, enabled: isEnabled });
    }
    catch (err) {
        console.error('Error creating config:', err);
        sendJson(res, 500, { error: 'Failed to create config' });
    }
}
async function handleUpdateConfig(req, res, configId) {
    try {
        const body = await parseBody(req);
        const config = body.config;
        const enabled = body.enabled !== undefined ? !!body.enabled : await stickerConfigManager.isEnabled(configId);
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
    }
    catch (err) {
        console.error('Error updating config:', err);
        sendJson(res, 500, { error: 'Failed to update config' });
    }
}
async function handleEnableConfig(res, configId) {
    const ok = await stickerConfigManager.enableConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, enabled: true });
}
async function handleDisableConfig(res, configId) {
    const ok = await stickerConfigManager.disableConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, enabled: false });
}
async function handleDeleteConfig(res, configId) {
    const ok = await stickerConfigManager.deleteConfig(configId);
    if (!ok) {
        sendJson(res, 404, { error: 'Configuration not found' });
        return;
    }
    sendJson(res, 200, { id: configId, deleted: true });
}
async function handlePreview(req, res) {
    try {
        const body = await parseBody(req);
        const text = (body.text ?? '').toString();
        const config = body.config;
        if (!text || !text.trim()) {
            sendJson(res, 400, { error: 'Text is required for preview' });
            return;
        }
        if (!config || typeof config !== 'object') {
            sendJson(res, 400, { error: 'Invalid config payload' });
            return;
        }
        const opts = {
            text,
            ...config,
        };
        const sticker = await (0, generateSticker_1.generateSticker)(opts);
        const buffer = await (0, generateSticker_1.stickerToBuffer)(sticker);
        const sizeBytes = buffer.length;
        const sizeKB = Math.round((sizeBytes / 1024) * 100) / 100;
        sendJson(res, 200, {
            sticker,
            sizeBytes,
            sizeKB,
        });
    }
    catch (err) {
        console.error('Error generating preview:', err);
        sendJson(res, 500, { error: 'Failed to generate preview' });
    }
}
async function handleFontSupport(req, res) {
    try {
        const body = await parseBody(req);
        const text = (body.text ?? '').toString();
        const fontFile = (body.fontFile ?? defaults_1.DEFAULT_FONT_FILE).toString();
        if (!text || !text.trim()) {
            sendJson(res, 400, { error: 'Text is required' });
            return;
        }
        const fontPath = path.resolve(animation_config_1.fontAnimationConfig.fontDirectory, fontFile);
        const font = await (0, fontLoader_1.loadFont)(fontPath);
        const hasCyr = (0, fontSupport_1.fontHasCyrillic)(font);
        const supports = (0, fontSupport_1.fontSupportsText)(font, text);
        sendJson(res, 200, {
            ok: supports,
            hasCyrillic: hasCyr,
            fontFile,
        });
    }
    catch (err) {
        console.error('Error checking font support:', err);
        sendJson(res, 500, { error: 'Failed to check font support' });
    }
}
async function handleMeta(res) {
    let fonts = [];
    try {
        const fontsDir = path.resolve(animation_config_1.fontAnimationConfig.fontDirectory);
        const entries = await fs.promises.readdir(fontsDir, { withFileTypes: true });
        fonts = entries
            .filter((e) => e.isFile() && /\.(ttf|otf)$/i.test(e.name))
            .map((e) => e.name);
    }
    catch (err) {
        console.error('Error reading fonts directory:', err);
    }
    sendJson(res, 200, {
        enums: {
            TransformAnimationType: index_1.TransformAnimationType,
            ColorAnimationType: index_1.ColorAnimationType,
            LetterAnimationType: index_1.LetterAnimationType,
            PathMorphAnimationType: index_1.PathMorphAnimationType,
        },
        defaults: {
            frameRate: defaults_1.DEFAULT_FRAME_RATE,
            duration: defaults_1.DEFAULT_DURATION,
            fontFile: defaults_1.DEFAULT_FONT_FILE,
            transformAnimationConfig: animation_config_1.transformAnimationConfig,
            colorAnimationConfig: animation_config_1.colorAnimationConfig,
            letterAnimationConfig: animation_config_1.letterAnimationConfig,
            pathMorphAnimationConfig: animation_config_1.pathMorphAnimationConfig,
            fontAnimationConfig: animation_config_1.fontAnimationConfig,
        },
        fonts,
    });
}
const server = http.createServer(async (req, res) => {
    try {
        const method = req.method || 'GET';
        const url = new url_1.URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const relativePath = getRelativePath(url.pathname);
        if (relativePath === null) {
            notFound(res);
            return;
        }
        const needsSecretSlashRedirect = SECRET_PATH !== '/' && url.pathname === SECRET_PATH && !url.pathname.endsWith('/');
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
                }
                else if (method === 'POST') {
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
    }
    catch (err) {
        console.error('Unhandled server error:', err);
        if (!res.headersSent) {
            sendJson(res, 500, { error: 'Internal server error' });
        }
        else {
            res.end();
        }
    }
});
server.listen(PORT, () => {
    const suffix = SECRET_PATH === '/' ? '' : SECRET_PATH;
    console.log(`Sticker config web UI listening on http://localhost:${PORT}${suffix}`);
});
//# sourceMappingURL=web-server.js.map