(() => {
    const uiBaseUrl = new URL(window.location.href);
    const state = {
        meta: null,
        variants: [],
        activeId: null,
        lottieInstance: null,
        dotLottieInstance: null,
        dotLottieUrl: null,
        initialized: false,
        backgroundLayers: [],
        activeBackgroundIndex: null,
        knockout: null,
        backgroundMode: 'layers',
    };
    const MIN_DURATION_FRAMES = 2;

    const transformSchema = {
        none: {},
        slideLoop: { amplitudeXFactor: 'number' },
        scalePulse: { minScale: 'number', maxScale: 'number' },
        shakeLoop: { steps: 'number', intensity: 'number' },
        bounce: {
            heightAmplitudeFactor: 'number',
            secondaryBounceFactor: 'number',
        },
        vibrate: { steps: 'number', intensity: 'number' },
    };

    const colorSchema = {
        none: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
        cycleRGB: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
        rainbow: {
            colors: 'vec4Array',
            times: 'numberArray',
            loop: 'boolean',
        },
    };

    const letterSchema = {
        none: {},
        vibrate: { intensity: 'number', steps: 'number' },
        typingFall: {
            delayPerLetterFactor: 'number',
            fallDurationFactor: 'number',
            startYOffsetFactor: 'number',
        },
        wave: {
            amplitude: 'number',
            steps: 'number',
            phasePerLetter: 'number',
        },
        zigzag: {
            spread: 'number',
            steps: 'number',
            phasePerLetter: 'number',
            baseScale: 'number',
        },
        rotate: {
            fromAngle: 'number',
            toAngle: 'number',
            loop: 'boolean',
        },
    };

    const pathMorphSchema = {
        none: {},
        warp: {
            intensityFactor: 'number',
            phases: 'numberArray',
        },
        warpAiry: {
            intensityFactor: 'number',
            phases: 'numberArray',
            lowFrequency: 'number',
            highFrequency: 'number',
            scaleFactor: 'number',
            rotationFactor: 'number',
        },
        skewPulse: {
            intensityFactor: 'number',
            skewNormDivisor: 'number',
            skewMin: 'number',
            skewMax: 'number',
            skewBase: 'number',
        },
        skewSwing: {
            intensityFactor: 'number',
            skewNormDivisor: 'number',
            skewMin: 'number',
            skewMax: 'number',
            skewBase: 'number',
            swingAmplitudeScale: 'number',
        },
    };

    const backgroundParamSchema = {
        solid: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        frame: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        stripes: {
            count: 'number',
            stripeHeightFactor: 'number',
            gapFactor: 'number',
            cornerRadius: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        glyphPattern: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            gridColumns: 'number',
            gridRows: 'number',
            spacingXFactor: 'number',
            spacingYFactor: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
        textLike: {
            paddingFactor: 'number',
            cornerRadius: 'number',
            colorPhaseStep: 'number',
            scale: 'number',
            rotationDeg: 'number',
            opacity: 'number',
            offsetX: 'number',
            offsetY: 'number',
        },
    };

    const colorParamMeta = {
        none: {
            loop: {
                label: 'Зациклить статичный цвет',
                hint: 'Если выключено — цвет не анимируется',
            },
        },
    };

    const transformParamMeta = {
        slideLoop: {
            amplitudeXFactor: {
                label: 'Амплитуда по X (доля ширины)',
                hint: '0..1 от ширины кадра',
                min: 0,
                max: 1,
                step: 0.01,
            },
        },
        scalePulse: {
            minScale: {
                label: 'Мин. масштаб (%)',
                hint: 'Проценты, напр. 90',
                step: 1,
            },
            maxScale: {
                label: 'Макс. масштаб (%)',
                hint: 'Проценты, напр. 120',
                step: 1,
            },
        },
        shakeLoop: {
            steps: {
                label: 'Шаги',
                step: 1,
            },
            intensity: {
                label: 'Интенсивность (px)',
                step: 1,
            },
        },
        bounce: {
            heightAmplitudeFactor: {
                label: 'Высота отскока (доля высоты)',
                min: 0,
                max: 1,
                step: 0.01,
            },
            secondaryBounceFactor: {
                label: 'Второй отскок (множитель)',
                step: 0.1,
            },
        },
        vibrate: {
            steps: {
                label: 'Шаги',
                step: 1,
            },
            intensity: {
                label: 'Интенсивность (px)',
                step: 1,
            },
        },
    };

    const letterParamMeta = {
        vibrate: {
            intensity: { label: 'Интенсивность', step: 0.1, min: 0, max: 20 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 120 },
        },
        typingFall: {
            delayPerLetterFactor: {
                label: 'Задержка на букву',
                hint: 'Доля длительности',
                step: 0.01,
                min: 0,
                max: 0.2,
            },
            fallDurationFactor: {
                label: 'Длительность падения',
                step: 0.01,
                min: 0,
                max: 1,
            },
            startYOffsetFactor: {
                label: 'Высота старта (доля высоты)',
                step: 0.1,
                min: -1,
                max: 1,
            },
        },
        wave: {
            amplitude: { label: 'Амплитуда (px)', step: 1, min: 0, max: 80 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 160 },
            phasePerLetter: {
                label: 'Фаза на букву',
                step: 0.1,
                min: 0,
                max: 3,
            },
        },
        zigzag: {
            spread: { label: 'Размах (px)', step: 1, min: 0, max: 120 },
            steps: { label: 'Шаги', step: 1, min: 1, max: 160 },
            phasePerLetter: {
                label: 'Фаза на букву',
                step: 0.1,
                min: 0,
                max: 6.3,
            },
            baseScale: {
                label: 'Базовый масштаб (%)',
                step: 1,
                min: 50,
                max: 200,
            },
        },
        rotate: {
            fromAngle: {
                label: 'Угол от (градусы)',
                step: 1,
                min: -360,
                max: 360,
            },
            toAngle: {
                label: 'Угол до (градусы)',
                step: 1,
                min: -360,
                max: 360,
            },
            loop: {
                label: 'Зациклить вращение',
            },
        },
    };

    const pathMorphParamMeta = {
        warp: {
            intensityFactor: {
                label: 'Интенсивность (коэфф.)',
                step: 0.01,
                min: 0,
                max: 0.5,
            },
            phases: {
                label: 'Фазы (массив)',
                hint: 'JSON: [0, 2π/3, 4π/3]',
            },
        },
        warpAiry: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            phases: {
                label: 'Фазы (массив)',
                hint: 'JSON: [0, 2π/3, 4π/3]',
            },
            lowFrequency: { label: 'Низкая частота', step: 0.01, min: 0, max: 1 },
            highFrequency: { label: 'Высокая частота', step: 0.01, min: 0, max: 1 },
            scaleFactor: { label: 'Масштаб', step: 0.01, min: 0, max: 0.5 },
            rotationFactor: { label: 'Вращение', step: 0.01, min: 0, max: 1 },
        },
        skewPulse: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            skewNormDivisor: { label: 'Делитель норм.', step: 0.1, min: 1, max: 20 },
            skewMin: { label: 'Минимальный скос', step: 0.01, min: 0, max: 1 },
            skewMax: { label: 'Максимальный скос', step: 0.01, min: 0, max: 1 },
            skewBase: { label: 'Базовый скос', step: 0.01, min: 0, max: 1 },
        },
        skewSwing: {
            intensityFactor: { label: 'Интенсивность', step: 0.01, min: 0, max: 0.5 },
            skewNormDivisor: { label: 'Делитель норм.', step: 0.1, min: 1, max: 20 },
            skewMin: { label: 'Минимальный скос', step: 0.01, min: 0, max: 1 },
            skewMax: { label: 'Максимальный скос', step: 0.01, min: 0, max: 1 },
            skewBase: { label: 'Базовый скос', step: 0.01, min: 0, max: 1 },
            swingAmplitudeScale: { label: 'Амплитуда раскачки', step: 0.01, min: 0, max: 1 },
        },
    };

    const letterWarnings = {
        vibrate: '⚠️ Vibrate потребляет много памяти. Используйте осторожно.',
    };

    const pathWarnings = {
        warp: '⚠️ Warp потребляет много памяти. Используйте внимательно.',
        warpAiry: '⚠️ WarpAiry потребляет много памяти. Используйте внимательно.',
    };

    function getTransformDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.transformAnimationConfig &&
                state.meta.defaults.transformAnimationConfig[type]) ||
            null
        );
    }

    function getLetterDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.letterAnimationConfig &&
                state.meta.defaults.letterAnimationConfig[type]) ||
            null
        );
    }

    function getPathMorphDefaults(type) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.pathMorphAnimationConfig &&
                state.meta.defaults.pathMorphAnimationConfig[type]) ||
            null
        );
    }

    function getBackgroundParamMeta(type) {
        const meta =
            state.meta &&
            state.meta.defaults &&
            state.meta.defaults.backgroundParamMeta &&
            state.meta.defaults.backgroundParamMeta[type];
        return meta || {};
    }

    function getBackgroundDefaults(key) {
        return (
            (state.meta &&
                state.meta.defaults &&
                state.meta.defaults.backgroundDefaults &&
                state.meta.defaults.backgroundDefaults[key]) ||
            null
        );
    }

    function deepCopy(obj) {
        return obj == null ? obj : JSON.parse(JSON.stringify(obj));
    }

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(msg, isError) {
        const el = $('status');
        if (!el) return;
        el.textContent = msg || '';
        el.style.color = isError ? '#fecaca' : '#9ca3af';
    }

    function renderWarningMessage(targetId, message) {
        const el = $(targetId);
        if (!el) return;
        el.textContent = message || '';
    }

    function updateLetterWarning() {
        renderWarningMessage('letterWarning', letterWarnings[$('letterType').value] || '');
    }

    function updatePathWarning() {
        renderWarningMessage('pathWarning', pathWarnings[$('pathMorphType').value] || '');
    }

    async function api(path, options) {
        const normalizedPath = uiBaseUrl.pathname + path.replace(/^\.\//, '').replace(/^\/+/, '');
        const url = new URL(normalizedPath, uiBaseUrl);
        const res = await fetch(url.toString(), {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || res.statusText);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            return res.json();
        }
        return res.text();
    }

    function getBaseColorFromDescriptor(desc) {
        if (!desc || typeof desc !== 'object') return undefined;
        const params = desc.params;
        if (!params) return undefined;
        if (Array.isArray(params.colors) && params.colors.length) {
            const [r, g, b] = params.colors[0];
            if ([r, g, b].every((v) => typeof v === 'number' && !Number.isNaN(v))) {
                return [r, g, b];
            }
        }
        const base = params.baseColor;
        if (!Array.isArray(base)) return undefined;
        const [r, g, b] = base;
        if ([r, g, b].some((v) => typeof v !== 'number' || Number.isNaN(v))) return undefined;
        return [r, g, b];
    }

    function getStrokeWidthFromDescriptor(desc) {
        if (!desc || typeof desc !== 'object') return undefined;
        const params = desc.params;
        if (!params) return undefined;
        const width = params.strokeWidth;
        return typeof width === 'number' && Number.isFinite(width) ? width : undefined;
    }

    function getFrameRateValue() {
        const select = $('frameRate');
        const val = parseInt((select && select.value) || '60', 10);
        return val === 30 ? 30 : 60;
    }

    function getDurationElements() {
        return { slider: $('durationSlider'), input: $('duration') };
    }

    function setDurationValue(value) {
        const { slider, input } = getDurationElements();
        if (!slider || !input) return;
        const fps = getFrameRateValue();
        const max = Math.max(fps * 3, MIN_DURATION_FRAMES);
        const numeric = Number.isFinite(value) ? value : parseInt(String(value || ''), 10) || MIN_DURATION_FRAMES;
        const clamped = Math.min(Math.max(MIN_DURATION_FRAMES, numeric), max);
        slider.min = String(MIN_DURATION_FRAMES);
        slider.max = String(max);
        slider.value = String(clamped);
        input.value = String(clamped);
        input.min = String(MIN_DURATION_FRAMES);
    }

    function updateDurationRange() {
        const { slider, input } = getDurationElements();
        if (!slider || !input) return;
        const fps = getFrameRateValue();
        const max = Math.max(fps * 3, MIN_DURATION_FRAMES);
        slider.min = String(MIN_DURATION_FRAMES);
        slider.max = String(max);
        input.min = String(MIN_DURATION_FRAMES);
        const current = parseInt(input.value || String(MIN_DURATION_FRAMES), 10) || MIN_DURATION_FRAMES;
        const clamped = Math.min(Math.max(MIN_DURATION_FRAMES, current), max);
        slider.value = String(clamped);
        input.value = String(clamped);
    }

    function normalizeColorParamsForUi(desc, fallbackColor, options = {}) {
        const params = desc && desc.params ? JSON.parse(JSON.stringify(desc.params)) : {};
        const baseColor =
            (Array.isArray(params.baseColor) ? params.baseColor : null) ||
            (Array.isArray(fallbackColor) ? fallbackColor : null);
        const isStatic = options.isStatic || (desc && desc.type === 'none');

        if (!Array.isArray(params.colors) || !params.colors.length) {
            const base = baseColor || [1, 1, 1];
            const rgba = [
                Math.max(0, Math.min(1, base[0] ?? 1)),
                Math.max(0, Math.min(1, base[1] ?? 1)),
                Math.max(0, Math.min(1, base[2] ?? 1)),
                Math.max(0, Math.min(1, base[3] ?? 1)),
            ];
            params.colors = isStatic ? [rgba] : [rgba, rgba];
        } else {
            params.colors = params.colors.map((color) => {
                if (!Array.isArray(color)) return [1, 1, 1, 1];
                const [r = 1, g = 1, b = 1, a = 1] = color;
                return [
                    Math.max(0, Math.min(1, r)),
                    Math.max(0, Math.min(1, g)),
                    Math.max(0, Math.min(1, b)),
                    Math.max(0, Math.min(1, a)),
                ];
            });
        }

        if (!Array.isArray(params.times) || params.times.length !== params.colors.length) {
            const count = params.colors.length;
            params.times = Array.from({ length: count }, (_, idx) =>
                isStatic || count <= 1 ? 0 : idx / (count - 1),
            );
        }

        if (typeof params.loop !== 'boolean') {
            params.loop = !isStatic;
        }

        if (options.isStroke) {
            if (typeof params.strokeWidth !== 'number' || Number.isNaN(params.strokeWidth)) {
                if (typeof options.fallbackStrokeWidth === 'number') {
                    params.strokeWidth = options.fallbackStrokeWidth;
                }
            }
        } else {
            delete params.strokeWidth;
        }

        delete params.baseColor;
        return params;
    }

    function defaultFillColorParams() {
        return {
            colors: [[1, 1, 1, 1]],
            times: [0],
            loop: false,
        };
    }

    function defaultStrokeColorParams() {
        return {
            ...defaultFillColorParams(),
            strokeWidth: 2,
        };
    }

    const colorPresets = {
        none: [
            { id: 'static-white', label: 'Статичный • Белый', config: defaultFillColorParams() },
            {
                id: 'static-black',
                label: 'Статичный • Чёрный',
                config: {
                    colors: [[0, 0, 0, 1]],
                    times: [0],
                    loop: false,
                },
            },
            {
                id: 'static-soft',
                label: 'Статичный • Пастель',
                config: {
                    colors: [[1, 0.92, 0.84, 1]],
                    times: [0],
                    loop: false,
                },
            },
        ],
        cycleRGB: [
            {
                id: 'cycle-rgb',
                label: 'RGB',
                config: {
                    colors: [
                        [1, 0, 0, 1],
                        [0, 1, 0, 1],
                        [0, 0, 1, 1],
                        [1, 0, 0, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-sunset',
                label: 'Sunset',
                config: {
                    colors: [
                        [1, 0.71, 0.4, 1],
                        [1, 0.3, 0.5, 1],
                        [0.7, 0.3, 0.9, 1],
                        [1, 0.71, 0.4, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-aqua',
                label: 'Aqua',
                config: {
                    colors: [
                        [0, 0.8, 0.8, 1],
                        [0, 0.5, 0.9, 1],
                        [0.1, 0.9, 0.7, 1],
                        [0, 0.8, 0.8, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
            {
                id: 'cycle-neon',
                label: 'Neon',
                config: {
                    colors: [
                        [0.9, 1, 0, 1],
                        [0, 1, 0.8, 1],
                        [0.7, 0.3, 1, 1],
                        [0.9, 1, 0, 1],
                    ],
                    times: [0, 1 / 3, 2 / 3, 1],
                    loop: true,
                },
            },
        ],
        rainbow: [
            {
                id: 'rainbow-classic',
                label: 'Rainbow',
                config: {
                    colors: [
                        [1, 0, 0, 1],
                        [1, 0.5, 0, 1],
                        [1, 1, 0, 1],
                        [0, 1, 0, 1],
                        [0, 0.5, 1, 1],
                        [0, 0, 1, 1],
                        [0.5, 0, 1, 1],
                        [1, 0, 0.5, 1],
                        [1, 0, 0, 1],
                    ],
                    times: [0, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8, 1],
                    loop: true,
                },
            },
            {
                id: 'rainbow-soft',
                label: 'Soft Pastel',
                config: {
                    colors: [
                        [1, 0.8, 0.8, 1],
                        [1, 0.9, 0.7, 1],
                        [0.9, 1, 0.8, 1],
                        [0.7, 0.9, 1, 1],
                        [0.8, 0.7, 1, 1],
                        [1, 0.8, 0.8, 1],
                    ],
                    times: [0, 0.25, 0.5, 0.75, 0.95, 1],
                    loop: true,
                },
            },
        ],
    };

    function getColorPresets(type) {
        return colorPresets[type] || [];
    }

    function clonePresetConfig(preset, isStroke) {
        const cfg = JSON.parse(JSON.stringify(preset.config));
        if (isStroke) {
            cfg.strokeWidth = preset.strokeWidth ?? 2;
        }
        return cfg;
    }

    function findMatchingPreset(presets, values, isStroke) {
        if (!values || !Array.isArray(values.colors) || !Array.isArray(values.times)) {
            return null;
        }
        return presets.find((preset) => {
            const cfg = preset.config;
            return (
                JSON.stringify(cfg.colors) === JSON.stringify(values.colors) &&
                JSON.stringify(cfg.times) === JSON.stringify(values.times) &&
                Boolean(cfg.loop) === Boolean(values.loop) &&
                (!isStroke || (preset.strokeWidth ?? values.strokeWidth) === values.strokeWidth)
            );
        });
    }

    function getColorDefaults(type) {
        if (!type || !state.meta || !state.meta.defaults || !state.meta.defaults.colorAnimationConfig) {
            return null;
        }
        const cfg = state.meta.defaults.colorAnimationConfig[type];
        if (!cfg) return null;
        return JSON.parse(JSON.stringify(cfg));
    }

    function parseArrayInput(value) {
        if (!value) return undefined;
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            const parts = value.split(',').map(p => parseFloat(p.trim()));
            if (parts.some(n => Number.isNaN(n))) return undefined;
            return parts;
        }
        return undefined;
    }

    function clampNumber(val, min, max) {
        if (typeof val !== 'number' || Number.isNaN(val)) return min ?? 0;
        const lo = typeof min === 'number' ? min : -Infinity;
        const hi = typeof max === 'number' ? max : Infinity;
        return Math.min(hi, Math.max(lo, val));
    }

    function normalizeBackgroundParams(type, params) {
        const meta = getBackgroundParamMeta(type) || {};
        const normalized = { ...(params || {}) };
        Object.keys(meta).forEach((key) => {
            const cfg = meta[key];
            if (typeof normalized[key] === 'number') {
                normalized[key] = clampNumber(
                    normalized[key],
                    cfg.min ?? normalized[key],
                    cfg.max ?? normalized[key],
                );
            }
        });
        return normalized;
    }

    function makeDefaultBackgroundLayer(type) {
        const preset =
            (type === 'solid' && getBackgroundDefaults('solid')) ||
            (type === 'frame' && getBackgroundDefaults('frame')) ||
            (type === 'stripes' && getBackgroundDefaults('stripes')) ||
            (type === 'glyphPattern' && getBackgroundDefaults('glyphPattern')) ||
            (type === 'textLike' && getBackgroundDefaults('textLike'));
        if (preset) return deepCopy(preset);
        if (type === 'frame') {
            return {
                type,
                params: { paddingFactor: 0.05, cornerRadius: 8 },
                strokeAnimations: [
                    { type: 'none', params: { colors: [[1, 1, 1, 1]], times: [0], loop: false, strokeWidth: 2 } },
                ],
            };
        }
        if (type === 'stripes') {
            return {
                type,
                params: { count: 5, stripeHeightFactor: 0.1, gapFactor: 0.05, cornerRadius: 0 },
                colorAnimations: [
                    { type: 'none', params: { colors: [[0.2, 0.2, 0.2, 1]], times: [0], loop: false } },
                ],
            };
        }
        if (type === 'glyphPattern') {
            return {
                type,
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
                    { type: 'none', params: { colors: [[0.8, 0.8, 0.8, 1]], times: [0], loop: false } },
                ],
            };
        }
        if (type === 'textLike') {
            return {
                type,
                text: '',
                params: { paddingFactor: 0, colorPhaseStep: 0.1 },
                colorAnimations: [
                    { type: 'none', params: { colors: [[0.4, 0.4, 0.4, 0.3]], times: [0], loop: false } },
                ],
            };
        }
        return {
            type,
            params: { paddingFactor: 0, cornerRadius: 0 },
            colorAnimations: [
                { type: 'none', params: { colors: [[0.1, 0.1, 0.1, 1]], times: [0], loop: false } },
            ],
        };
    }

    function makeDefaultKnockout() {
        const preset = getBackgroundDefaults('knockout');
        if (preset) return deepCopy(preset);
        return {
            mode: 'fill',
            paddingFactor: 0.05,
            cornerRadiusFactor: 0,
            colorAnimations: [{ type: 'none', params: { colors: [[0, 0, 0, 0.8]], times: [0], loop: false } }],
            strokeAnimations: [
                { type: 'none', params: { colors: [[1, 1, 1, 1]], times: [0], loop: false, strokeWidth: 2 } },
            ],
        };
    }

    function ensureGlyphFontLoaded(fontFile) {
        if (!fontFile) return;
        const existing = document.getElementById('glyphPreviewFontStyle');
        if (existing && existing.dataset.fontFile === fontFile) return;
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = 'glyphPreviewFontStyle';
        style.dataset.fontFile = fontFile;
        // Пытаемся сначала из fonts/glyphs, затем из fonts
        style.textContent = `
@font-face {
    font-family: 'glyphPreviewFont';
    src: url('./fonts/glyphs/${fontFile}') format('truetype'),
         url('./fonts/${fontFile}') format('truetype');
    font-display: swap;
}
`;
        document.head.appendChild(style);
    }


    function ensureFontPreviewFace(fontFile) {
        if (!fontFile) return;
        const existing = document.getElementById('fontPreviewStyle');
        if (existing && existing.dataset.fontFile === fontFile) return;
        if (existing) existing.remove();
        const style = document.createElement('style');
        style.id = 'fontPreviewStyle';
        style.dataset.fontFile = fontFile;
        style.textContent = `
@font-face {
    font-family: 'fontPreviewFace';
    src: url('./fonts/glyphs/${fontFile}') format('truetype'),
         url('./fonts/${fontFile}') format('truetype');
    font-display: swap;
}
`;
        document.head.appendChild(style);
    }

    function renderParams(container, schema, values, meta, defaults) {
        container.innerHTML = '';
        Object.entries(schema).forEach(([key, type]) => {
            const label = document.createElement('label');
            const metaCfg = meta && meta[key];
            label.textContent = metaCfg && metaCfg.label ? metaCfg.label : key;
            if (metaCfg && metaCfg.hint) {
                label.title = metaCfg.hint;
            }

            if (type === 'boolean') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.dataset.paramKey = key;
                input.checked = Boolean(values && values[key]);
                label.appendChild(input);
                container.appendChild(label);
                return;
            }

            if (type === 'number') {
                const wrapper = document.createElement('div');
                wrapper.className = 'slider-with-input';
                const slider = document.createElement('input');
                slider.type = 'range';
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                numberInput.dataset.paramKey = key;
                const step = metaCfg && metaCfg.step != null ? metaCfg.step : 0.01;
                slider.step = String(step);
                numberInput.step = String(step);
                const defaultValue =
                    defaults && typeof defaults[key] === 'number'
                        ? defaults[key]
                        : metaCfg?.default ?? 0;
                const currentValue =
                    values && typeof values[key] === 'number' ? values[key] : defaultValue;
                const min =
                    metaCfg && metaCfg.min != null
                        ? metaCfg.min
                        : Math.min(0, Number(defaultValue) || 0);
                const max =
                    metaCfg && metaCfg.max != null
                        ? metaCfg.max
                        : Math.max(Math.abs(Number(defaultValue) || 0) * 2, 100);
                const sliderMax = max > min ? max : min + 1;
                slider.min = String(min);
                slider.max = String(sliderMax);
                const clampedValue = Math.min(Math.max(currentValue, min), sliderMax);
                slider.value = String(clampedValue);
                numberInput.value = String(
                    values && typeof values[key] === 'number' ? currentValue : clampedValue,
                );
                slider.addEventListener('input', () => {
                    numberInput.value = slider.value;
                });
                numberInput.addEventListener('input', () => {
                    const val = parseFloat(numberInput.value);
                    if (Number.isNaN(val)) return;
                    if (val < parseFloat(slider.min)) slider.min = String(val);
                    if (val > parseFloat(slider.max)) slider.max = String(val);
                    slider.value = String(val);
                });
                wrapper.appendChild(slider);
                wrapper.appendChild(numberInput);
                label.appendChild(wrapper);
                container.appendChild(label);
                return;
            }

            const input = document.createElement('input');
            input.dataset.paramKey = key;
            input.type = 'text';
            const val = values ? values[key] : undefined;
            if ((type === 'numberArray' || type === 'vec4Array') && Array.isArray(val)) {
                input.value = JSON.stringify(val);
            } else if (val !== undefined) {
                input.value = String(val);
            }
            label.appendChild(input);
            container.appendChild(label);
        });
    }

    function readParams(container, schema) {
        const params = {};
        const inputs = container.querySelectorAll('input[data-param-key]');
        inputs.forEach((input) => {
            const key = input.dataset.paramKey;
            const type = schema[key];
            if (type === 'boolean') {
                params[key] = input.checked;
            } else if (type === 'number') {
                const v = parseFloat(input.value);
                if (!Number.isNaN(v)) params[key] = v;
            } else if (type === 'numberArray' || type === 'vec4Array') {
                const arr = parseArrayInput(input.value);
                if (arr !== undefined) params[key] = arr;
            } else {
                if (input.value !== '') params[key] = input.value;
            }
        });
        return params;
    }

    function buildAnimationDescriptor(typeKey, schema, paramsContainer) {
        const type = typeKey;
        if (type === 'none') return undefined;
        const params = readParams(paramsContainer, schema[type] || {});
        return Object.keys(params).length ? { type, params } : { type };
    }

    function buildColorDescriptor(type, paramsContainer, options = {}) {
        if (!type) return undefined;
        const params = readColorParams(paramsContainer, type, { isStroke: options.isStroke });
        const merged = { ...params };

        if (!Array.isArray(merged.colors) || !merged.colors.length) {
            const fallback =
                options.baseColor ||
                options.fallbackBaseColor ||
                [1, 1, 1];
            const rgba = [...fallback.slice(0, 3), 1];
            merged.colors = type === 'none' ? [rgba] : [rgba, rgba];
        }

        if (!Array.isArray(merged.times) || merged.times.length !== merged.colors.length) {
            const count = merged.colors.length;
            merged.times = Array.from({ length: count }, (_, idx) =>
                count <= 1 ? 0 : idx / (count - 1),
            );
        }

        if (options.isStroke) {
            if (typeof merged.strokeWidth !== 'number' || Number.isNaN(merged.strokeWidth)) {
                const fallbackWidth =
                    options.strokeWidth ??
                    options.fallbackStrokeWidth ??
                    2;
                merged.strokeWidth = fallbackWidth;
            }
        } else {
            delete merged.strokeWidth;
        }

        return { type, params: merged };
    }

    function renderColorParams(container, type, values, options = {}) {
        container.innerHTML = '';
        if (!type) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Анимация отключена';
            container.appendChild(placeholder);
            return;
        }

        const schema = colorSchema[type] || {};
        if (!schema.colors || !schema.times) {
            renderParams(container, schema, values, colorParamMeta[type] || null);
            return;
        }

        const presets = getColorPresets(type);
        if (presets.length) {
            const presetRow = document.createElement('div');
            presetRow.className = 'preset-row';
            const presetSelect = document.createElement('select');
            presets.forEach((preset) => {
                const option = document.createElement('option');
                option.value = preset.id;
                option.textContent = preset.label;
                presetSelect.appendChild(option);
            });
            const matchingPreset = findMatchingPreset(presets, values, options.isStroke);
            if (matchingPreset) {
                presetSelect.value = matchingPreset.id;
            }
            presetSelect.addEventListener('change', () => {
                const preset = presets.find((p) => p.id === presetSelect.value);
                if (!preset) {
                    setStatus('Пресет не выбран', true);
                    return;
                }
                const presetCfg = clonePresetConfig(preset, options.isStroke);
                renderColorParams(container, type, presetCfg, options);
                setStatus('Пресет применён');
            });
            presetRow.appendChild(presetSelect);
            container.appendChild(presetRow);
        }

        let sourceColors =
            (values && Array.isArray(values.colors) && values.colors.length
                ? values.colors
                : options.fallbackColors) || [];
        let sourceTimes =
            (values && Array.isArray(values.times) && values.times.length
                ? values.times
                : options.fallbackTimes) || [];
        const isStatic = type === 'none';
        if (isStatic) {
            if (!sourceColors.length) sourceColors = [[1, 1, 1, 1]];
            sourceTimes = [0];
        }
        const loop =
            values && typeof values.loop === 'boolean'
                ? values.loop
                : options.fallbackLoop ?? !isStatic;
        const strokeWidthValue =
            options.isStroke &&
                values &&
                typeof values.strokeWidth === 'number' &&
                Number.isFinite(values.strokeWidth)
                ? values.strokeWidth
                : options.isStroke
                    ? options.fallbackStrokeWidth
                    : undefined;

        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'color-rows';
        rowsWrap.dataset.type = type;

        const count = Math.max(sourceColors.length, sourceTimes.length, 1);

        const makeRow = (idx, colorVal, timeVal) => {
            const row = document.createElement('div');
            row.className = 'color-row';
            row.dataset.index = String(idx);

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.dataset.role = 'color';
            const rgba = Array.isArray(colorVal) ? colorVal : [1, 1, 1, 1];
            const [r, g, b, a] = rgba;
            const toHexComp = (v) => {
                const c = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
                return Math.round(c * 255)
                    .toString(16)
                    .padStart(2, '0');
            };
            const hex = `#${toHexComp(r)}${toHexComp(g)}${toHexComp(b)}`;
            colorInput.value = hex;
            colorInput.dataset.alpha = String(Number.isFinite(a) ? a : 1);

            let timeInput;
            if (!isStatic) {
                const timeWrap = document.createElement('div');
                timeWrap.className = 'time-slider';
                const normalizedTime = Number.isFinite(timeVal) ? timeVal : idx / Math.max(count - 1, 1);
                const defaultTime = Math.max(0, Math.min(1, normalizedTime));
                timeInput = document.createElement('input');
                timeInput.type = 'range';
                timeInput.step = '0.01';
                timeInput.min = '0';
                timeInput.max = '1';
                timeInput.dataset.role = 'time';
                timeInput.value = String(defaultTime);
                const timeValueLabel = document.createElement('span');
                timeValueLabel.className = 'time-value';
                timeValueLabel.textContent = defaultTime.toFixed(2);
                timeInput.addEventListener('input', () => {
                    timeValueLabel.textContent = parseFloat(timeInput.value).toFixed(2);
                });
                const timeLabel = document.createElement('span');
                timeLabel.className = 'slider-label';
                timeLabel.textContent = 'Время';
                timeWrap.appendChild(timeLabel);
                timeWrap.appendChild(timeInput);
                timeWrap.appendChild(timeValueLabel);
                row.appendChild(timeWrap);
            }

            const alphaValue = Math.max(0, Math.min(1, Number.isFinite(a) ? a : 1));
            const alphaWrap = document.createElement('div');
            alphaWrap.className = 'alpha-slider';
            const alphaInput = document.createElement('input');
            alphaInput.type = 'range';
            alphaInput.step = '0.01';
            alphaInput.min = '0';
            alphaInput.max = '1';
            alphaInput.dataset.role = 'alpha';
            alphaInput.value = String(alphaValue);
            alphaInput.title = 'Прозрачность (0..1)';
            const alphaValueLabel = document.createElement('span');
            alphaValueLabel.className = 'alpha-value';
            alphaValueLabel.textContent = alphaValue.toFixed(2);
            alphaInput.addEventListener('input', () => {
                alphaValueLabel.textContent = parseFloat(alphaInput.value).toFixed(2);
                colorInput.dataset.alpha = alphaInput.value;
            });
            const alphaLabel = document.createElement('span');
            alphaLabel.className = 'slider-label';
            alphaLabel.textContent = 'Прозрачность';
            alphaWrap.appendChild(alphaLabel);
            alphaWrap.appendChild(alphaInput);
            alphaWrap.appendChild(alphaValueLabel);
            colorInput.dataset.alpha = String(alphaValue);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '−';
            removeBtn.className = 'small-button';
            removeBtn.addEventListener('click', () => {
                row.remove();
            });

            row.appendChild(colorInput);
            row.appendChild(alphaWrap);
            if (!isStatic && count > 1) {
                row.appendChild(removeBtn);
            }
            rowsWrap.appendChild(row);
        };

        for (let i = 0; i < count; i += 1) {
            makeRow(i, sourceColors[i], sourceTimes[i]);
        }

        container.appendChild(rowsWrap);

        const buttonsWrap = document.createElement('div');
        buttonsWrap.style.display = 'flex';
        buttonsWrap.style.alignItems = 'center';
        buttonsWrap.style.gap = '6px';
        buttonsWrap.style.marginTop = '4px';

        if (!isStatic) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.textContent = 'Добавить ключ';
            addBtn.className = 'small-button';
            addBtn.addEventListener('click', () => {
                const currentRows = rowsWrap.querySelectorAll('.color-row');
                const idx = currentRows.length;
                makeRow(idx, [1, 1, 1, 1], idx === 0 ? 0 : 1);
            });
            buttonsWrap.appendChild(addBtn);
        }

        const loopLabel = document.createElement('label');
        loopLabel.style.display = 'flex';
        loopLabel.style.alignItems = 'center';
        loopLabel.style.gap = '4px';
        loopLabel.style.fontSize = '11px';
        const loopCheckbox = document.createElement('input');
        loopCheckbox.type = 'checkbox';
        loopCheckbox.checked = loop;
        loopCheckbox.dataset.role = 'loop';
        loopLabel.appendChild(loopCheckbox);
        const loopText = document.createElement('span');
        loopText.textContent = 'Зациклить';
        loopLabel.appendChild(loopText);

        buttonsWrap.appendChild(loopLabel);

        container.appendChild(buttonsWrap);

        if (options.isStroke) {
            const strokeLabel = document.createElement('label');
            strokeLabel.textContent = 'Толщина обводки (px)';
            const strokeInput = document.createElement('input');
            strokeInput.type = 'number';
            strokeInput.step = '0.5';
            strokeInput.min = '0';
            strokeInput.dataset.role = 'stroke-width';
            if (typeof strokeWidthValue === 'number') {
                strokeInput.value = String(strokeWidthValue);
            }
            strokeLabel.appendChild(strokeInput);
            container.appendChild(strokeLabel);
        }
    }

    function readColorParams(container, type, options = {}) {
        if (!type) {
            return {};
        }
        const schema = colorSchema[type] || {};
        if (!schema.colors || !schema.times) {
            return readParams(container, schema);
        }

        const rowsWrap = container.querySelector('.color-rows');
        if (!rowsWrap) {
            return {};
        }
        const rows = rowsWrap.querySelectorAll('.color-row');
        const colors = [];
        const times = [];
        rows.forEach((row) => {
            const colorInput = row.querySelector('input[data-role="color"]');
            const timeInput = row.querySelector('input[data-role="time"]');
            const alphaInput = row.querySelector('input[data-role="alpha"]');
            if (!colorInput || (!timeInput && type !== 'none')) return;
            const hex = colorInput.value || '#ffffff';
            const parseAlphaValue = (val) => {
                const num = parseFloat(val);
                if (Number.isNaN(num)) return undefined;
                return Math.max(0, Math.min(1, num));
            };
            const alpha =
                alphaInput && alphaInput.value !== ''
                    ? parseAlphaValue(alphaInput.value)
                    : parseAlphaValue(colorInput.dataset.alpha || '');
            const normalizedAlpha = alpha !== undefined ? alpha : 1;
            const parseHex = (h) => {
                const clean = h.replace('#', '');
                if (clean.length === 3) {
                    const r = parseInt(clean[0] + clean[0], 16);
                    const g = parseInt(clean[1] + clean[1], 16);
                    const b = parseInt(clean[2] + clean[2], 16);
                    return [r, g, b];
                }
                const r = parseInt(clean.slice(0, 2), 16);
                const g = parseInt(clean.slice(2, 4), 16);
                const b = parseInt(clean.slice(4, 6), 16);
                return [r, g, b];
            };
            const [r255, g255, b255] = parseHex(hex);
            const toNorm = (v) => Math.max(0, Math.min(1, v / 255));
            const time = timeInput ? parseFloat(timeInput.value) : 0;
            colors.push([toNorm(r255), toNorm(g255), toNorm(b255), normalizedAlpha]);
            if (!Number.isNaN(time)) {
                times.push(time);
            } else {
                times.push(0);
            }
        });

        const loopCheckbox = container.querySelector('input[data-role="loop"]');
        const loop = loopCheckbox ? loopCheckbox.checked : true;

        const result = {
            colors,
            times,
            loop,
        };

        if (options.isStroke) {
            const strokeInput = container.querySelector('input[data-role="stroke-width"]');
            if (strokeInput) {
                const width = parseFloat(strokeInput.value);
                if (!Number.isNaN(width)) {
                    result.strokeWidth = width;
                }
            }
        }

        return result;
    }

    function getBackgroundTypeOptions() {
        if (
            state.meta &&
            state.meta.defaults &&
            Array.isArray(state.meta.defaults.backgroundLayerTypes)
        ) {
            return state.meta.defaults.backgroundLayerTypes;
        }
        return [
            { value: 'solid', label: 'Solid' },
            { value: 'frame', label: 'Frame' },
            { value: 'stripes', label: 'Stripes' },
            { value: 'glyphPattern', label: 'GlyphPattern' },
            { value: 'textLike', label: 'TextLike' },
        ];
    }

    function renderBackgroundLayers() {
        const list = $('backgroundLayersList');
        const addBtn = $('addBackgroundLayerBtn');
        if (!list) return;

        if (state.backgroundMode !== 'layers') {
            if (addBtn) addBtn.disabled = true;
            list.innerHTML = '';
            const info = document.createElement('div');
            info.className = 'params-message';
            info.textContent = 'Режим knockout активен — фоновые слои недоступны';
            list.appendChild(info);
            state.activeBackgroundIndex = null;
            renderBackgroundEditor(true);
            return;
        }

        if (addBtn) addBtn.disabled = false;
        list.innerHTML = '';
        if (!Array.isArray(state.backgroundLayers) || state.backgroundLayers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'params-message';
            empty.textContent = 'Слои не добавлены';
            list.appendChild(empty);
            state.activeBackgroundIndex = null;
            renderBackgroundEditor();
            return;
        }

        let dragStartIndex = null;

        // Разрешаем drop на контейнере (для некоторых браузеров)
        list.ondragover = (e) => {
            e.preventDefault();
        };
        list.ondrop = (e) => {
            e.preventDefault();
        };

        state.backgroundLayers.forEach((layer, idx) => {
            const item = document.createElement('div');
            item.className = 'variant-item' + (state.activeBackgroundIndex === idx ? ' active' : '');
            item.draggable = true;
            item.dataset.index = String(idx);

            const title = document.createElement('div');
            title.className = 'variant-title';
            const label = document.createElement('span');
            label.textContent = layer.type || 'layer';
            title.appendChild(label);
            item.appendChild(title);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '✕';
            removeBtn.className = 'small-button';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.backgroundLayers.splice(idx, 1);
                if (state.activeBackgroundIndex === idx) {
                    state.activeBackgroundIndex = null;
                } else if ((state.activeBackgroundIndex || 0) > idx) {
                    state.activeBackgroundIndex -= 1;
                    if (state.activeBackgroundIndex < 0) state.activeBackgroundIndex = null;
                }
                renderBackgroundLayers();
            });
            item.appendChild(removeBtn);

            item.addEventListener('click', () => {
                state.activeBackgroundIndex = idx;
                renderBackgroundLayers();
                renderBackgroundEditor();
            });

            item.addEventListener('dragstart', (e) => {
                dragStartIndex = idx;
                item.classList.add('dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                }
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                dragStartIndex = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (dragStartIndex == null || dragStartIndex === idx) return;
                item.classList.add('drag-over');
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                const from = dragStartIndex;
                if (from == null || from === idx) return;
                const to = idx;
                const layers = state.backgroundLayers;
                if (!Array.isArray(layers) || from < 0 || from >= layers.length || to < 0 || to >= layers.length) {
                    return;
                }
                const [moved] = layers.splice(from, 1);
                layers.splice(to, 0, moved);

                if (state.activeBackgroundIndex === from) {
                    state.activeBackgroundIndex = to;
                } else if (state.activeBackgroundIndex != null) {
                    let current = state.activeBackgroundIndex;
                    if (from < to) {
                        if (current > from && current <= to) current -= 1;
                    } else if (from > to) {
                        if (current >= to && current < from) current += 1;
                    }
                    state.activeBackgroundIndex = current;
                }

                renderBackgroundLayers();
            });

            list.appendChild(item);
        });
        if (state.activeBackgroundIndex == null || state.activeBackgroundIndex >= state.backgroundLayers.length) {
            state.activeBackgroundIndex = 0;
        }
        renderBackgroundEditor();
    }

    function renderBackgroundEditor(disabledMode = false) {
        const container = $('backgroundLayerEditor');
        if (!container) return;
        container.innerHTML = '';
        if (disabledMode) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Редактор слоёв выключен (knockout режим)';
            container.appendChild(placeholder);
            return;
        }
        const idx = state.activeBackgroundIndex;
        if (idx == null || !state.backgroundLayers[idx]) {
            const placeholder = document.createElement('div');
            placeholder.className = 'params-message';
            placeholder.textContent = 'Выберите слой для редактирования';
            container.appendChild(placeholder);
            return;
        }

        const layer = state.backgroundLayers[idx];
        const typeRow = document.createElement('div');
        typeRow.className = 'grid grid-3';
        const typeLabel = document.createElement('label');
        typeLabel.textContent = 'Тип слоя';
        const typeSelect = document.createElement('select');
        getBackgroundTypeOptions().forEach((opt) => {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            typeSelect.appendChild(o);
        });
        typeSelect.value = layer.type || '';
        typeLabel.appendChild(typeSelect);
        typeRow.appendChild(typeLabel);
        container.appendChild(typeRow);

        const paramsContainer = document.createElement('div');
        paramsContainer.className = 'params';
        container.appendChild(paramsContainer);

        const fontRow = document.createElement('div');
        fontRow.className = 'grid grid-3';
        const fontLabel = document.createElement('label');
        fontLabel.textContent = 'fontFile (для паттернов)';
        const fontInput = document.createElement('select');
        const fontOptions = (state.meta && (state.meta.glyphFonts || state.meta.fonts)) || [];
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '—';
        fontInput.appendChild(emptyOpt);
        fontOptions.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            fontInput.appendChild(opt);
        });
        fontInput.value = layer.fontFile || '';
        fontInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
        fontLabel.appendChild(fontInput);

        const textLabel = document.createElement('label');
        textLabel.textContent = 'text (паттерн)';
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.value = layer.text || '';
        textInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
        textLabel.appendChild(textInput);
        fontRow.appendChild(fontLabel);
        fontRow.appendChild(textLabel);
        container.appendChild(fontRow);

        const glyphPreviewWrapper = document.createElement('div');
        glyphPreviewWrapper.className = 'glyph-preview-container';
        const glyphPreview = document.createElement('div');
        glyphPreview.className = 'glyph-preview';
        glyphPreviewWrapper.appendChild(glyphPreview);
        container.appendChild(glyphPreviewWrapper);

        const params = normalizeBackgroundParams(layer.type, layer.params || {});
        const meta = state.meta && state.meta.defaults && state.meta.defaults.backgroundParamMeta
            ? state.meta.defaults.backgroundParamMeta[layer.type] || {}
            : {};
        renderParams(paramsContainer, backgroundParamSchema[layer.type] || {}, params, meta, null);

        // Привязки инпутов font/text/params
        typeSelect.addEventListener('change', () => {
            layer.type = typeSelect.value;
            layer.params = normalizeBackgroundParams(layer.type, {});
            if (layer.type !== 'glyphPattern' && layer.type !== 'textLike') {
                layer.fontFile = undefined;
                layer.text = undefined;
            }
            renderBackgroundEditor();
            renderBackgroundLayers();
        });

        const renderGlyphPreview = (fontFile) => {
            glyphPreview.innerHTML = '';
            if (!fontFile) {
                glyphPreview.textContent = '—';
                return;
            }
            ensureGlyphFontLoaded(fontFile);
            glyphPreview.textContent = 'Загрузка...';
            fetch(`./api/glyphs?font=${encodeURIComponent(fontFile)}`)
                .then((res) => res.json())
                .then((data) => {
                    glyphPreview.innerHTML = '';
                    if (!data || !Array.isArray(data.glyphs) || !data.glyphs.length) {
                        glyphPreview.textContent = 'Глифы не найдены';
                        return;
                    }
                    const table = document.createElement('table');
                    table.className = 'glyph-preview-table';
                    const thead = document.createElement('thead');
                    const headerRow = document.createElement('tr');
                    ['Glyph', 'Literal', 'Name', 'Cmds', 'Pts'].forEach((h) => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        headerRow.appendChild(th);
                    });
                    thead.appendChild(headerRow);
                    table.appendChild(thead);

                    const tbody = document.createElement('tbody');
                    const toLiteral = (ch) => {
                        if (ch === ' ') return '` `';
                        return '`' + ch + '`';
                    };
                    data.glyphs.slice(0, 2000).forEach((g) => {
                        const tr = document.createElement('tr');

                        const tdChar = document.createElement('td');
                        tdChar.textContent = g.char;
                        tdChar.style.fontFamily = 'glyphPreviewFont';
                        tdChar.className = 'glyph-char-cell';

                        const tdLiteral = document.createElement('td');
                        tdLiteral.textContent = toLiteral(g.char);
                        tdLiteral.className = 'glyph-literal-cell';
                        tdLiteral.title = 'Клик для копирования символа';

                        const tdName = document.createElement('td');
                        tdName.textContent = g.name || '';

                        const tdCmds = document.createElement('td');
                        tdCmds.textContent = g.commands && g.commands > 0 ? String(g.commands) : '';
                        const tdPts = document.createElement('td');
                        tdPts.textContent = g.points && g.points > 0 ? String(Math.round(g.points)) : '';

                        const copyValue = g.char;
                        tr.style.cursor = 'pointer';
                        tr.addEventListener('click', () => {
                            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(copyValue).catch(() => { });
                            }
                        });

                        tr.appendChild(tdChar);
                        tr.appendChild(tdLiteral);
                        tr.appendChild(tdName);
                        tr.appendChild(tdCmds);
                        tr.appendChild(tdPts);
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    glyphPreview.appendChild(table);
                })
                .catch(() => {
                    glyphPreview.textContent = 'Ошибка загрузки глифов';
                });
        };

        fontInput.addEventListener('change', () => {
            layer.fontFile = fontInput.value || undefined;
            if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
                renderGlyphPreview(layer.fontFile);
            } else {
                glyphPreview.textContent = '—';
            }
        });

        textInput.addEventListener('input', () => {
            layer.text = textInput.value || undefined;
        });

        paramsContainer.oninput = () => {
            const normalized = normalizeBackgroundParams(
                layer.type,
                readParams(paramsContainer, backgroundParamSchema[layer.type] || {}),
            );
            layer.params = normalized;
        };

        const colorRow = document.createElement('div');
        colorRow.className = 'grid grid-3';
        const colorSelect = document.createElement('select');
        const colorParams = document.createElement('div');
        colorParams.className = 'params';
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Fill';
        colorLabel.appendChild(colorSelect);
        colorRow.appendChild(colorLabel);
        colorRow.appendChild(colorParams);
        container.appendChild(colorRow);

        const strokeRow = document.createElement('div');
        strokeRow.className = 'grid grid-3';
        const strokeSelect = document.createElement('select');
        const strokeParams = document.createElement('div');
        strokeParams.className = 'params';
        const strokeLabel = document.createElement('label');
        strokeLabel.textContent = 'Stroke';
        strokeLabel.appendChild(strokeSelect);
        strokeRow.appendChild(strokeLabel);
        strokeRow.appendChild(strokeParams);
        container.appendChild(strokeRow);

        const pathRow = document.createElement('div');
        pathRow.className = 'grid grid-3';
        const pathSelect = document.createElement('select');
        const pathParams = document.createElement('div');
        pathParams.className = 'params';
        const pathLabel = document.createElement('label');
        pathLabel.textContent = 'PathMorph';
        pathLabel.appendChild(pathSelect);
        pathRow.appendChild(pathLabel);
        pathRow.appendChild(pathParams);
        container.appendChild(pathRow);

        const transformRow = document.createElement('div');
        transformRow.className = 'grid grid-3';
        const transformSelect = document.createElement('select');
        const transformParams = document.createElement('div');
        transformParams.className = 'params';
        const transformLabel = document.createElement('label');
        transformLabel.textContent = 'Transform';
        transformLabel.appendChild(transformSelect);
        transformRow.appendChild(transformLabel);
        transformRow.appendChild(transformParams);
        container.appendChild(transformRow);

        const letterRow = document.createElement('div');
        letterRow.className = 'grid grid-3';
        const letterSelect = document.createElement('select');
        const letterParams = document.createElement('div');
        letterParams.className = 'params';
        const letterLabel = document.createElement('label');
        letterLabel.textContent = 'Letter';
        letterLabel.appendChild(letterSelect);
        letterRow.appendChild(letterLabel);
        letterRow.appendChild(letterParams);
        container.appendChild(letterRow);

        function syncLayer() {
            const type = typeSelect.value || 'solid';
            layer.type = type;
            layer.params = normalizeBackgroundParams(type, readParams(paramsContainer, backgroundParamSchema[type] || {}));
            if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
                layer.fontFile = fontInput.value || undefined;
                layer.text = textInput.value || undefined;
            } else {
                delete layer.fontFile;
                delete layer.text;
            }
            const transform = buildAnimationDescriptor(transformSelect.value, transformSchema, transformParams);
            layer.transformAnimations = transform ? [transform] : [];

            const letterDesc = buildAnimationDescriptor(letterSelect.value, letterSchema, letterParams);
            layer.letterAnimations = letterDesc ? [letterDesc] : [];

            const fillDesc = buildColorDescriptor(colorSelect.value, colorParams, {
                fallbackBaseColor: getBaseColorFromDescriptor(layer.colorAnimations && layer.colorAnimations[0]) || [0.1, 0.1, 0.1],
                isStatic: colorSelect.value === 'none',
            });
            layer.colorAnimations = fillDesc ? [fillDesc] : [];

            const strokeDesc = buildColorDescriptor(strokeSelect.value, strokeParams, {
                isStroke: true,
                fallbackBaseColor: getBaseColorFromDescriptor(layer.strokeAnimations && layer.strokeAnimations[0]) || [1, 1, 1],
                fallbackStrokeWidth: getStrokeWidthFromDescriptor(layer.strokeAnimations && layer.strokeAnimations[0]) || 2,
                isStatic: strokeSelect.value === 'none',
            });
            layer.strokeAnimations = strokeDesc ? [strokeDesc] : [];

            const pathDesc = buildAnimationDescriptor(pathSelect.value, pathMorphSchema, pathParams);
            layer.pathMorphAnimations = pathDesc ? [pathDesc] : [];
        }

        function renderAll() {
            renderParams(
                paramsContainer,
                backgroundParamSchema[typeSelect.value] || {},
                layer.params,
                getBackgroundParamMeta(typeSelect.value),
            );
            fillSelect(transformSelect, [
                { value: 'none', label: 'None' },
                { value: 'slideLoop', label: 'SlideLoop' },
                { value: 'scalePulse', label: 'ScalePulse' },
                { value: 'shakeLoop', label: 'ShakeLoop' },
                { value: 'bounce', label: 'Bounce' },
                { value: 'vibrate', label: 'Vibrate' },
            ]);
            const transform = (layer.transformAnimations && layer.transformAnimations[0]) || null;
            transformSelect.value = (transform && transform.type) || 'none';
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                transform && transform.params,
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );

            fillSelect(letterSelect, [
                { value: 'none', label: 'None' },
                { value: 'vibrate', label: 'Vibrate' },
                { value: 'typingFall', label: 'TypingFall' },
                { value: 'wave', label: 'Wave' },
                { value: 'zigzag', label: 'ZigZag' },
                { value: 'rotate', label: 'Rotate' },
            ]);
            const letter = (layer.letterAnimations && layer.letterAnimations[0]) || null;
            letterSelect.value = (letter && letter.type) || 'none';
            renderParams(
                letterParams,
                letterSchema[letterSelect.value] || {},
                letter && letter.params,
                letterParamMeta[letterSelect.value] || null,
                getLetterDefaults(letterSelect.value),
            );

            fillSelect(colorSelect, [
                { value: '', label: '—' },
                { value: 'none', label: 'None' },
                { value: 'cycleRGB', label: 'CycleRGB' },
                { value: 'rainbow', label: 'Rainbow' },
            ]);
            const color = (layer.colorAnimations && layer.colorAnimations[0]) || null;
            colorSelect.value = (color && color.type) || '';
            renderColorParams(
                colorParams,
                colorSelect.value,
                normalizeColorParamsForUi(color, getBaseColorFromDescriptor(color) || [0.1, 0.1, 0.1], {
                    isStatic: colorSelect.value === 'none',
                }),
            );

            fillSelect(strokeSelect, [
                { value: '', label: '—' },
                { value: 'none', label: 'None' },
                { value: 'cycleRGB', label: 'CycleRGB' },
                { value: 'rainbow', label: 'Rainbow' },
            ]);
            const stroke = (layer.strokeAnimations && layer.strokeAnimations[0]) || null;
            strokeSelect.value = (stroke && stroke.type) || '';
            renderColorParams(
                strokeParams,
                strokeSelect.value,
                normalizeColorParamsForUi(stroke, getBaseColorFromDescriptor(stroke) || [1, 1, 1], {
                    isStroke: true,
                    fallbackStrokeWidth: getStrokeWidthFromDescriptor(stroke) || 2,
                    isStatic: strokeSelect.value === 'none',
                }),
                { isStroke: true },
            );

            fillSelect(pathSelect, [
                { value: 'none', label: 'None' },
                { value: 'warp', label: 'Warp' },
                { value: 'warpAiry', label: 'WarpAiry' },
                { value: 'skewPulse', label: 'SkewPulse' },
                { value: 'skewSwing', label: 'SkewSwing' },
            ]);
            const pathMorph = (layer.pathMorphAnimations && layer.pathMorphAnimations[0]) || null;
            pathSelect.value = (pathMorph && pathMorph.type) || 'none';
            renderParams(
                pathParams,
                pathMorphSchema[pathSelect.value] || {},
                pathMorph && pathMorph.params,
                pathMorphParamMeta[pathSelect.value] || null,
                getPathMorphDefaults(pathSelect.value),
            );
            fontInput.disabled = layer.type !== 'glyphPattern' && layer.type !== 'textLike';
            textInput.disabled = fontInput.disabled;
        }

        typeSelect.addEventListener('change', () => {
            const newType = typeSelect.value || 'solid';
            const preset = makeDefaultBackgroundLayer(newType);
            state.backgroundLayers[idx] = { ...preset };
            state.activeBackgroundIndex = idx;
            renderBackgroundLayers();
            renderBackgroundEditor();
        });

        [fontInput, textInput].forEach((inp) => {
            inp.addEventListener('input', () => {
                syncLayer();
            });
        });
        const attachParamSync = (el, fn) => {
            if (el) {
                el.oninput = fn;
                el.onchange = fn;
            }
        };

        transformSelect.onchange = () => {
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                {},
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );
            syncLayer();
        };
        colorSelect.onchange = () => {
            renderColorParams(
                colorParams,
                colorSelect.value,
                getColorDefaults(colorSelect.value) || defaultFillColorParams(),
                {},
            );
            syncLayer();
        };
        strokeSelect.onchange = () => {
            const defaults = getColorDefaults(strokeSelect.value) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') defaults.strokeWidth = 2;
            renderColorParams(strokeParams, strokeSelect.value, defaults, { isStroke: true });
            syncLayer();
        };
        pathSelect.onchange = () => {
            renderParams(
                pathParams,
                pathMorphSchema[pathSelect.value] || {},
                {},
                pathMorphParamMeta[pathSelect.value] || null,
                getPathMorphDefaults(pathSelect.value),
            );
            syncLayer();
        };
        letterSelect.onchange = () => {
            renderParams(
                letterParams,
                letterSchema[letterSelect.value] || {},
                {},
                letterParamMeta[letterSelect.value] || null,
                getLetterDefaults(letterSelect.value),
            );
            syncLayer();
        };

        [transformParams, colorParams, strokeParams, pathParams, letterParams].forEach((el) =>
            attachParamSync(el, syncLayer),
        );

        transformParams.addEventListener('change', syncLayer);
        colorParams.addEventListener('change', syncLayer);
        strokeParams.addEventListener('change', syncLayer);
        pathParams.addEventListener('change', syncLayer);
        paramsContainer.addEventListener('change', syncLayer);

        renderAll();
        syncLayer();
        if (layer.type === 'glyphPattern' || layer.type === 'textLike') {
            renderGlyphPreview(layer.fontFile);
        } else {
            glyphPreview.textContent = '—';
        }
    }

    function updateFontFilePreview() {
        const fontSelect = $('fontFile');
        const sample = $('fontFilePreviewSample');
        const textInput = $('previewText');
        if (!fontSelect || !sample) return;
        const fontFile = fontSelect.value || (state.meta && state.meta.defaults && state.meta.defaults.fontFile) || '';
        ensureFontPreviewFace(fontFile);
        const text = (textInput && textInput.value) || 'Abc АБВ 123 ✦☆';
        sample.textContent = text;
        sample.style.fontFamily = 'fontPreviewFace';
    }

    function renderKnockoutControls() {
        const modeSelect = $('knockoutMode');
        const paddingInput = $('knockoutPadding');
        const cornerInput = $('knockoutCornerRadius');
        const scaleInput = $('knockoutScale');
        const rotationInput = $('knockoutRotation');
        const opacityInput = $('knockoutOpacity');
        const offsetXInput = $('knockoutOffsetX');
        const offsetYInput = $('knockoutOffsetY');
        const transformSelect = $('knockoutTransformType');
        const transformParams = $('knockoutTransformParams');
        const fillSelectEl = $('knockoutFillType');
        const fillParams = $('knockoutFillParams');
        const strokeSelectEl = $('knockoutStrokeType');
        const strokeParams = $('knockoutStrokeParams');
        const pathSelectEl = $('knockoutPathMorphType');
        const pathParams = $('knockoutPathMorphParams');
        const letterSelectEl = $('knockoutLetterType');
        const letterParams = $('knockoutLetterParams');

        if (!state.knockout) state.knockout = makeDefaultKnockout();

        const isKnockoutMode = state.backgroundMode === 'knockout';
        if (modeSelect) modeSelect.disabled = !isKnockoutMode;
        [paddingInput, cornerInput, scaleInput, rotationInput, opacityInput, offsetXInput, offsetYInput].forEach((el) => {
            if (el) el.disabled = !isKnockoutMode;
        });
        [transformSelect, fillSelectEl, strokeSelectEl, pathSelectEl, letterSelectEl].forEach((el) => {
            if (el) el.disabled = !isKnockoutMode;
        });

        const knockoutModes =
            (state.meta &&
                state.meta.defaults &&
                Array.isArray(state.meta.defaults.knockoutModes) &&
                state.meta.defaults.knockoutModes) ||
            [
                { value: 'fill', label: 'fill' },
                { value: 'stroke', label: 'stroke' },
            ];
        fillSelect(modeSelect, knockoutModes);
        modeSelect.value = state.knockout.mode || 'fill';

        paddingInput.value =
            typeof state.knockout.paddingFactor === 'number' ? state.knockout.paddingFactor : 0.05;
        cornerInput.value =
            typeof state.knockout.cornerRadiusFactor === 'number'
                ? state.knockout.cornerRadiusFactor
                : 0;
        scaleInput.value =
            typeof state.knockout.scale === 'number' ? state.knockout.scale : 1;
        rotationInput.value =
            typeof state.knockout.rotationDeg === 'number' ? state.knockout.rotationDeg : 0;
        opacityInput.value =
            typeof state.knockout.opacity === 'number' ? state.knockout.opacity : 1;
        offsetXInput.value =
            typeof state.knockout.offsetX === 'number' ? state.knockout.offsetX : 0;
        offsetYInput.value =
            typeof state.knockout.offsetY === 'number' ? state.knockout.offsetY : 0;

        fillSelect(transformSelect, [
            { value: 'none', label: 'None' },
            { value: 'slideLoop', label: 'SlideLoop' },
            { value: 'scalePulse', label: 'ScalePulse' },
            { value: 'shakeLoop', label: 'ShakeLoop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'vibrate', label: 'Vibrate' },
        ]);
        const koTransform = (state.knockout.transformAnimations && state.knockout.transformAnimations[0]) || null;
        transformSelect.value = (koTransform && koTransform.type) || 'none';
        renderParams(
            transformParams,
            transformSchema[transformSelect.value] || {},
            koTransform && koTransform.params,
            transformParamMeta[transformSelect.value] || null,
            getTransformDefaults(transformSelect.value),
        );

        fillSelect(fillSelectEl, [
            { value: '', label: '—' },
            { value: 'none', label: 'None' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        const fillDesc = (state.knockout.colorAnimations && state.knockout.colorAnimations[0]) || null;
        fillSelectEl.value = (fillDesc && fillDesc.type) || '';
        renderColorParams(
            fillParams,
            fillSelectEl.value,
            normalizeColorParamsForUi(fillDesc, getBaseColorFromDescriptor(fillDesc) || [0, 0, 0], {
                isStatic: fillSelectEl.value === 'none',
            }),
        );

        fillSelect(strokeSelectEl, [
            { value: '', label: '—' },
            { value: 'none', label: 'None' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        const strokeDesc = (state.knockout.strokeAnimations && state.knockout.strokeAnimations[0]) || null;
        strokeSelectEl.value = (strokeDesc && strokeDesc.type) || '';
        renderColorParams(
            strokeParams,
            strokeSelectEl.value,
            normalizeColorParamsForUi(
                strokeDesc,
                getBaseColorFromDescriptor(strokeDesc) || [1, 1, 1],
                {
                    isStroke: true,
                    fallbackStrokeWidth: getStrokeWidthFromDescriptor(strokeDesc) || 2,
                    isStatic: strokeSelectEl.value === 'none',
                },
            ),
            { isStroke: true },
        );

        fillSelect(pathSelectEl, [
            { value: 'none', label: 'None' },
            { value: 'warp', label: 'Warp' },
            { value: 'warpAiry', label: 'WarpAiry' },
            { value: 'skewPulse', label: 'SkewPulse' },
            { value: 'skewSwing', label: 'SkewSwing' },
        ]);
        const pathDesc = (state.knockout.pathMorphAnimations && state.knockout.pathMorphAnimations[0]) || null;
        pathSelectEl.value = (pathDesc && pathDesc.type) || 'none';
        renderParams(
            pathParams,
            pathMorphSchema[pathSelectEl.value] || {},
            pathDesc && pathDesc.params,
            pathMorphParamMeta[pathSelectEl.value] || null,
            getPathMorphDefaults(pathSelectEl.value),
        );

        const sync = () => {
            if (!isKnockoutMode) {
                return;
            }
            const ko = state.knockout || makeDefaultKnockout();
            ko.mode = modeSelect.value || 'fill';
            ko.paddingFactor = clampNumber(parseFloat(paddingInput.value), 0, 0.5);
            ko.cornerRadiusFactor = clampNumber(parseFloat(cornerInput.value), 0, 1);
            const scaleVal = parseFloat(scaleInput.value);
            ko.scale = Number.isFinite(scaleVal) ? clampNumber(scaleVal, 0, 5) : 1;
            ko.rotationDeg = clampNumber(parseFloat(rotationInput.value), -360, 360);
            const opacityVal = parseFloat(opacityInput.value);
            ko.opacity = Number.isFinite(opacityVal) ? clampNumber(opacityVal, 0, 1) : 1;
            ko.offsetX = clampNumber(parseFloat(offsetXInput.value), -1000, 1000);
            ko.offsetY = clampNumber(parseFloat(offsetYInput.value), -1000, 1000);
            const tr = buildAnimationDescriptor(transformSelect.value, transformSchema, transformParams);
            ko.transformAnimations = tr ? [tr] : [];
            const fill = buildColorDescriptor(fillSelectEl.value, fillParams, {
                isStatic: fillSelectEl.value === 'none',
            });
            ko.colorAnimations = fill ? [fill] : [];
            const stroke = buildColorDescriptor(strokeSelectEl.value, strokeParams, {
                isStroke: true,
                fallbackStrokeWidth: getStrokeWidthFromDescriptor(strokeDesc) || 2,
                isStatic: strokeSelectEl.value === 'none',
            });
            ko.strokeAnimations = stroke ? [stroke] : [];
            const path = buildAnimationDescriptor(pathSelectEl.value, pathMorphSchema, pathParams);
            ko.pathMorphAnimations = path ? [path] : [];
            const letterDesc = buildAnimationDescriptor(letterSelectEl.value, letterSchema, letterParams);
            ko.letterAnimations = letterDesc ? [letterDesc] : [];
            state.knockout = ko;
        };

        modeSelect.onchange = sync;
        paddingInput.oninput = sync;
        cornerInput.oninput = sync;
        scaleInput.oninput = sync;
        rotationInput.oninput = sync;
        opacityInput.oninput = sync;
        offsetXInput.oninput = sync;
        offsetYInput.oninput = sync;
        transformSelect.onchange = () => {
            renderParams(
                transformParams,
                transformSchema[transformSelect.value] || {},
                {},
                transformParamMeta[transformSelect.value] || null,
                getTransformDefaults(transformSelect.value),
            );
            sync();
        };
        fillSelectEl.onchange = () => {
            renderColorParams(
                fillParams,
                fillSelectEl.value,
                getColorDefaults(fillSelectEl.value) || defaultFillColorParams(),
            );
            sync();
        };
        strokeSelectEl.onchange = () => {
            const defaults = getColorDefaults(strokeSelectEl.value) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') defaults.strokeWidth = 2;
            renderColorParams(strokeParams, strokeSelectEl.value, defaults, { isStroke: true });
            sync();
        };
        pathSelectEl.onchange = () => {
            renderParams(
                pathParams,
                pathMorphSchema[pathSelectEl.value] || {},
                {},
                pathMorphParamMeta[pathSelectEl.value] || null,
                getPathMorphDefaults(pathSelectEl.value),
            );
            sync();
        };
        fillSelect(letterSelectEl, [
            { value: 'none', label: 'None' },
            { value: 'vibrate', label: 'Vibrate' },
            { value: 'typingFall', label: 'TypingFall' },
            { value: 'wave', label: 'Wave' },
            { value: 'zigzag', label: 'ZigZag' },
            { value: 'rotate', label: 'Rotate' },
        ]);
        const koLetter = (state.knockout.letterAnimations && state.knockout.letterAnimations[0]) || null;
        letterSelectEl.value = (koLetter && koLetter.type) || 'none';
        renderParams(
            letterParams,
            letterSchema[letterSelectEl.value] || {},
            koLetter && koLetter.params,
            letterParamMeta[letterSelectEl.value] || null,
            getLetterDefaults(letterSelectEl.value),
        );
        letterSelectEl.onchange = () => {
            renderParams(
                letterParams,
                letterSchema[letterSelectEl.value] || {},
                {},
                letterParamMeta[letterSelectEl.value] || null,
                getLetterDefaults(letterSelectEl.value),
            );
            sync();
        };
        transformParams.onchange = sync;
        fillParams.onchange = sync;
        strokeParams.onchange = sync;
        pathParams.onchange = sync;
        letterParams.onchange = sync;

        sync();
    }

    function setBackgroundMode(mode) {
        state.backgroundMode = mode === 'knockout' ? 'knockout' : 'layers';
        if (state.backgroundMode === 'knockout') {
            state.backgroundLayers = [];
            state.activeBackgroundIndex = null;
            resetTextAnimationsForKnockout();
        } else {
            // keep knockout object but ignore it in serialization
        }
        renderBackgroundLayers();
        renderKnockoutControls();
        updateBackgroundVisibility();
    }

    function resetTextAnimationsForKnockout() {
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        setValue('transformType', 'none');
        setValue('colorType', '');
        setValue('strokeType', '');
        setValue('letterType', 'none');
        setValue('pathMorphType', 'none');
        renderParams(
            $('transformParams'),
            transformSchema['none'] || {},
            {},
            transformParamMeta['none'] || null,
            getTransformDefaults('none'),
        );
        renderColorParams($('colorParams'), '', {});
        renderColorParams($('strokeParams'), '', {}, { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema['none'] || {},
            {},
            letterParamMeta['none'] || null,
            getLetterDefaults('none'),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema['none'] || {},
            {},
            pathMorphParamMeta['none'] || null,
            getPathMorphDefaults('none'),
        );
        updateLetterWarning();
        updatePathWarning();
    }

    function updateBackgroundVisibility() {
        const layersSection = document.getElementById('backgroundLayersSection');
        const knockoutSection = document.getElementById('knockoutSection');
        const textAnimationsSection = document.getElementById('textAnimationsSection');
        const bgModeSection = document.getElementById('backgroundModeSection');
        if (layersSection) {
            layersSection.style.display = state.backgroundMode === 'layers' ? '' : 'none';
        }
        if (knockoutSection) {
            knockoutSection.style.display = state.backgroundMode === 'knockout' ? '' : 'none';
        }
        if (textAnimationsSection) {
            textAnimationsSection.style.display = state.backgroundMode === 'knockout' ? 'none' : '';
        }
        if (bgModeSection) {
            bgModeSection.style.display = '';
        }
        updateTextAnimationsAvailability();
    }

    function updateTextAnimationsAvailability() {
        const disabled = state.backgroundMode === 'knockout';
        const idsToToggle = [
            'transformType',
            'colorType',
            'strokeType',
            'letterType',
            'pathMorphType',
        ];
        idsToToggle.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
        const paramContainers = [
            'transformParams',
            'colorParams',
            'strokeParams',
            'letterParams',
            'pathMorphParams',
        ];
        paramContainers.forEach((id) => {
            const container = document.getElementById(id);
            if (!container) return;
            const inputs = container.querySelectorAll('input, select, textarea, button');
            inputs.forEach((el) => {
                el.disabled = disabled;
            });
            container.style.opacity = disabled ? '0.5' : '';
        });
    }
    function fillSelect(select, options) {
        select.innerHTML = '';
        options.forEach((opt) => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            select.appendChild(option);
        });
    }

    function ensureOption(select, value, label) {
        if (!select || !value) return;
        const exists = Array.from(select.options).some((opt) => opt.value === value);
        if (exists) return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label || value;
        opt.disabled = true;
        select.appendChild(opt);
    }

    function getCurrentConfig() {
        const frameRate = parseInt($('frameRate').value || '60', 10) || 60;
        const duration = Math.max(MIN_DURATION_FRAMES, parseInt($('duration').value || '0', 10) || MIN_DURATION_FRAMES);
        const fontFile = $('fontFile').value || undefined;

        const transformType = $('transformType').value;
        const colorType = $('colorType').value;
        const strokeType = $('strokeType').value;
        const letterType = $('letterType').value;
        const pathMorphType = $('pathMorphType').value;

        const active = state.activeId
            ? state.variants.find((v) => v.id === state.activeId)
            : null;
        const baseCfg = active && active.config ? active.config : {};

        const transform = buildAnimationDescriptor(transformType, transformSchema, $('transformParams'));

        const existingColors = Array.isArray(baseCfg.colorAnimations) ? baseCfg.colorAnimations.slice() : [];
        const currentColorDesc = existingColors[0];
        const color = buildColorDescriptor(colorType, $('colorParams'), {
            fallbackBaseColor: getBaseColorFromDescriptor(currentColorDesc) || baseCfg.fillColor || [1, 1, 1],
            isStatic: colorType === 'none',
        });

        const existingStrokes = Array.isArray(baseCfg.strokeAnimations) ? baseCfg.strokeAnimations.slice() : [];
        const currentStrokeDesc = existingStrokes[0];
        const fallbackStrokeWidth = getStrokeWidthFromDescriptor(currentStrokeDesc) ?? baseCfg.strokeWidth ?? 2;
        const stroke = buildColorDescriptor(strokeType, $('strokeParams'), {
            isStroke: true,
            fallbackBaseColor: getBaseColorFromDescriptor(currentStrokeDesc) || baseCfg.strokeColor || [1, 1, 1],
            fallbackStrokeWidth,
            isStatic: strokeType === 'none',
        });

        const letter = buildAnimationDescriptor(letterType, letterSchema, $('letterParams'));
        const pathMorph = buildAnimationDescriptor(pathMorphType, pathMorphSchema, $('pathMorphParams'));

        const cfg = { ...baseCfg };
        delete cfg.width;
        delete cfg.height;
        delete cfg.fontSize;
        if (frameRate !== undefined) cfg.frameRate = frameRate;
        if (duration !== undefined) cfg.duration = duration;
        if (fontFile) cfg.fontFile = fontFile;
        delete cfg.fillColor;
        delete cfg.strokeColor;
        delete cfg.strokeWidth;

        const existingTransforms = Array.isArray(baseCfg.transformAnimations)
            ? baseCfg.transformAnimations.slice()
            : [];
        const restTransforms = existingTransforms.slice(1);
        const transforms = transform ? [transform, ...restTransforms] : restTransforms;
        if (transforms.length) cfg.transformAnimations = transforms;
        else delete cfg.transformAnimations;

        const restColors = existingColors.slice(1);
        const colors = color ? [color, ...restColors] : restColors;
        if (colors.length) cfg.colorAnimations = colors;
        else delete cfg.colorAnimations;

        const restStrokes = existingStrokes.slice(1);
        const strokes = stroke ? [stroke, ...restStrokes] : restStrokes;
        if (strokes.length) cfg.strokeAnimations = strokes;
        else delete cfg.strokeAnimations;

        const existingLetters = Array.isArray(baseCfg.letterAnimations)
            ? baseCfg.letterAnimations.slice()
            : [];
        const restLetters = existingLetters.slice(1);
        const letters = letter ? [letter, ...restLetters] : restLetters;
        if (letters.length) cfg.letterAnimations = letters;
        else delete cfg.letterAnimations;

        const existingPathMorphs = Array.isArray(baseCfg.pathMorphAnimations)
            ? baseCfg.pathMorphAnimations.slice()
            : [];
        const restPathMorphs = existingPathMorphs.slice(1);
        const pathMorphs = pathMorph ? [pathMorph, ...restPathMorphs] : restPathMorphs;
        if (pathMorphs.length) cfg.pathMorphAnimations = pathMorphs;
        else delete cfg.pathMorphAnimations;

        if (state.backgroundMode === 'layers' && Array.isArray(state.backgroundLayers) && state.backgroundLayers.length) {
            const serialized = state.backgroundLayers
                .map((layer) => {
                    if (!layer || !layer.type) return null;
                    const desc = deepCopy(layer);
                    desc.params = normalizeBackgroundParams(desc.type, desc.params || {});
                    if (!desc.colorAnimations || !desc.colorAnimations.length) delete desc.colorAnimations;
                    if (!desc.strokeAnimations || !desc.strokeAnimations.length) delete desc.strokeAnimations;
                    if (!desc.transformAnimations || !desc.transformAnimations.length)
                        delete desc.transformAnimations;
                    if (!desc.pathMorphAnimations || !desc.pathMorphAnimations.length)
                        delete desc.pathMorphAnimations;
                    if (!desc.letterAnimations || !desc.letterAnimations.length)
                        delete desc.letterAnimations;
                    if (!desc.fontFile) delete desc.fontFile;
                    if (!desc.text) delete desc.text;
                    return desc;
                })
                .filter(Boolean);
            if (serialized.length) cfg.backgroundLayers = serialized;
            else delete cfg.backgroundLayers;
        } else {
            delete cfg.backgroundLayers;
        }

        if (state.backgroundMode === 'knockout' && state.knockout) {
            const ko = deepCopy(state.knockout);
            if (!ko.colorAnimations || !ko.colorAnimations.length) delete ko.colorAnimations;
            if (!ko.strokeAnimations || !ko.strokeAnimations.length) delete ko.strokeAnimations;
            if (!ko.transformAnimations || !ko.transformAnimations.length) delete ko.transformAnimations;
            if (!ko.pathMorphAnimations || !ko.pathMorphAnimations.length) delete ko.pathMorphAnimations;
            cfg.knockoutBackground = ko;
        } else {
            delete cfg.knockoutBackground;
        }

        if (state.backgroundMode === 'knockout') {
            delete cfg.transformAnimations;
            delete cfg.colorAnimations;
            delete cfg.strokeAnimations;
            delete cfg.letterAnimations;
            delete cfg.pathMorphAnimations;
        }

        return cfg;
    }

    function loadConfigToForm(wrapper) {
        const cfg = wrapper.config || {};
        $('frameRate').value = cfg.frameRate === 30 ? '30' : '60';
        updateDurationRange();
        if (cfg.duration != null) {
            setDurationValue(cfg.duration);
        } else {
            setDurationValue(parseInt($('duration').value || '0', 10) || 0);
        }
        if (cfg.fontFile) {
            $('fontFile').value = cfg.fontFile;
        }
        $('enabled').checked = !!wrapper.enabled;

        state.backgroundMode = cfg.knockoutBackground ? 'knockout' : 'layers';
        const bgModeLayersRadio = document.getElementById('bgModeLayers');
        const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
        if (bgModeLayersRadio) bgModeLayersRadio.checked = state.backgroundMode === 'layers';
        if (bgModeKnockoutRadio) bgModeKnockoutRadio.checked = state.backgroundMode === 'knockout';

        state.backgroundLayers = state.backgroundMode === 'knockout' ? [] : deepCopy(cfg.backgroundLayers || []);
        state.activeBackgroundIndex = state.backgroundLayers.length ? 0 : null;
        state.knockout = cfg.knockoutBackground ? deepCopy(cfg.knockoutBackground) : makeDefaultKnockout();
        updateBackgroundVisibility();

        const transform = (cfg.transformAnimations && cfg.transformAnimations[0]) || null;
        const color = (cfg.colorAnimations && cfg.colorAnimations[0]) || null;
        const stroke = (cfg.strokeAnimations && cfg.strokeAnimations[0]) || null;
        const letter = (cfg.letterAnimations && cfg.letterAnimations[0]) || null;
        const pathMorph = (cfg.pathMorphAnimations && cfg.pathMorphAnimations[0]) || null;

        if (transform) {
            $('transformType').value = transform.type || 'none';
            ensureOption($('transformType'), transform.type, `${transform.type} (устарело)`);
        } else {
            $('transformType').value = 'none';
        }
        if (color) $('colorType').value = color.type || 'none';
        else $('colorType').value = '';
        if (stroke) $('strokeType').value = stroke.type || 'none';
        else $('strokeType').value = '';
        if (letter) $('letterType').value = letter.type || 'none';
        else $('letterType').value = 'none';
        if (pathMorph) $('pathMorphType').value = pathMorph.type || 'none';
        else $('pathMorphType').value = 'none';

        renderParams(
            $('transformParams'),
            transformSchema[$('transformType').value] || {},
            transform && transform.params,
            transformParamMeta[$('transformType').value] || null,
            getTransformDefaults($('transformType').value),
        );
        const colorValues = normalizeColorParamsForUi(color, cfg.fillColor, {
            isStatic: (color && color.type === 'none') || $('colorType').value === 'none',
        });
        renderColorParams($('colorParams'), $('colorType').value, colorValues);
        const strokeValues = normalizeColorParamsForUi(stroke, cfg.strokeColor, {
            isStroke: true,
            fallbackStrokeWidth:
                getStrokeWidthFromDescriptor(stroke) ??
                cfg.strokeWidth ??
                2,
            isStatic: (stroke && stroke.type === 'none') || $('strokeType').value === 'none',
        });
        renderColorParams($('strokeParams'), $('strokeType').value, strokeValues, { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema[$('letterType').value] || {},
            letter && letter.params,
            letterParamMeta[$('letterType').value] || null,
            getLetterDefaults($('letterType').value),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema[$('pathMorphType').value] || {},
            pathMorph && pathMorph.params,
            pathMorphParamMeta[$('pathMorphType').value] || null,
            getPathMorphDefaults($('pathMorphType').value),
        );
        updateLetterWarning();
        updatePathWarning();
        renderBackgroundLayers();
        renderKnockoutControls();
    }

    async function refreshVariants() {
        try {
            setStatus('Загрузка конфигураций…');
            const data = await api('./api/configs');
            state.variants = data.configs || [];
            renderVariants();
            setStatus('Готово');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка загрузки конфигураций', true);
        }
    }

    function renderVariants() {
        const container = $('variantsList');
        const scrollContainer = container.querySelector('.variants-scroll') || container;
        scrollContainer.innerHTML = '';
        state.variants.forEach((v, idx) => {
            const item = document.createElement('div');
            item.className = 'variant-item' + (v.id === state.activeId ? ' active' : '');

            const title = document.createElement('div');
            title.className = 'variant-title';
            const label = document.createElement('span');
            label.textContent = `Вариант ${idx + 1}`;
            const id = document.createElement('span');
            id.className = 'variant-id';
            id.textContent = v.id;
            title.appendChild(label);
            title.appendChild(id);

            const status = document.createElement('span');
            status.className = 'variant-status ' + (v.enabled ? 'enabled' : 'disabled');
            status.textContent = v.enabled ? 'Включен' : 'Выключен';

            item.appendChild(title);
            item.appendChild(status);

            item.addEventListener('click', () => {
                state.activeId = v.id;
                loadConfigToForm(v);
                renderVariants();
            });

            scrollContainer.appendChild(item);
        });
    }

    async function saveCurrentVariant() {
        try {
            const cfg = getCurrentConfig();
            const enabled = $('enabled').checked;
            const isNew = !state.activeId;
            setStatus('Сохранение…');

            if (isNew) {
                const res = await api('./api/configs', {
                    method: 'POST',
                    body: JSON.stringify({ config: cfg, enabled }),
                });
                state.activeId = res.id;
            } else {
                const res = await api(`./api/configs/${encodeURIComponent(state.activeId)}`, {
                    method: 'PUT',
                    body: JSON.stringify({ config: cfg, enabled }),
                });
                state.activeId = res.id;
            }

            await refreshVariants();
            setStatus('Сохранено');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка сохранения', true);
        }
    }

    async function previewCurrent() {
        try {
            const text = $('previewText').value || '';
            if (!text.trim()) {
                setStatus('Введите текст для предпросмотра', true);
                return;
            }
            const cfg = getCurrentConfig();
            setStatus('Генерация предпросмотра…');
            const res = await api('./api/preview', {
                method: 'POST',
                body: JSON.stringify({ text, config: cfg }),
            });

            const canvas = document.getElementById('previewCanvas');
            if (!canvas) {
                setStatus('Canvas для предпросмотра не найден', true);
                return;
            }
            const DotLottie = window.DotLottie;
            if (!DotLottie) {
                setStatus('DotLottie не загружен', true);
                return;
            }

            // Очистка старой анимации и canvas
            if (state.dotLottieInstance && typeof state.dotLottieInstance.destroy === 'function') {
                state.dotLottieInstance.destroy();
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // Подгоняем размер canvas под контейнер (а не под w/h анимации),
            // чтобы масштаб был стабильным между предпросмотрами.
            const container = canvas.parentElement;
            if (container) {
                const rect = container.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                const targetW = rect.width || 360;
                const targetH = rect.height || 360;
                canvas.width = targetW * dpr;
                canvas.height = targetH * dpr;
            }

            const blobUrl = URL.createObjectURL(
                new Blob([JSON.stringify(res.sticker)], { type: 'application/json' }),
            );
            state.dotLottieUrl && URL.revokeObjectURL(state.dotLottieUrl);
            state.dotLottieUrl = blobUrl;

            state.dotLottieInstance = new DotLottie({
                canvas,
                autoplay: true,
                loop: true,
                src: blobUrl,
                renderConfig: {
                    autoResize: false,
                    devicePixelRatio: window.devicePixelRatio || 1,
                },
                layout: {
                    fit: 'contain',
                    align: [0.5, 0.5],
                },
            });

            $('sizeLabel').textContent = `${res.sizeKB} КБ (${res.sizeBytes} байт)`;
            setStatus('Предпросмотр обновлён');
        } catch (err) {
            console.error(err);
            setStatus('Ошибка генерации предпросмотра', true);
        }
    }

    async function init() {
        const frameRateSelect = $('frameRate');
        const durationSlider = $('durationSlider');
        const durationInput = $('duration');

        $('newVariantBtn').addEventListener('click', () => {
            state.activeId = null;
            $('width').value = '';
            $('height').value = '';
            $('fontSize').value = '';
            const defaultFps =
                state.meta && state.meta.defaults && state.meta.defaults.frameRate === 30 ? '30' : '60';
            frameRateSelect.value = defaultFps;
            updateDurationRange();
            const defaultDuration =
                (state.meta && state.meta.defaults && state.meta.defaults.duration) || 0;
            setDurationValue(defaultDuration);
            if (state.meta && state.meta.defaults && state.meta.defaults.fontFile) {
                $('fontFile').value = state.meta.defaults.fontFile;
            } else {
                $('fontFile').value = '';
            }
            $('enabled').checked = true;
            $('transformType').value = 'none';
            $('colorType').value = 'none';
            $('strokeType').value = 'none';
            $('letterType').value = 'none';
            $('pathMorphType').value = 'none';
            renderParams(
                $('transformParams'),
                transformSchema[$('transformType').value] || {},
                {},
                transformParamMeta[$('transformType').value] || null,
                getTransformDefaults($('transformType').value),
            );
            renderColorParams($('colorParams'), 'none', defaultFillColorParams());
            renderColorParams($('strokeParams'), 'none', defaultStrokeColorParams(), { isStroke: true });
            renderParams(
                $('letterParams'),
                letterSchema[$('letterType').value] || {},
                {},
                letterParamMeta[$('letterType').value] || null,
                getLetterDefaults($('letterType').value),
            );
            renderParams(
                $('pathMorphParams'),
                pathMorphSchema[$('pathMorphType').value] || {},
                {},
                pathMorphParamMeta[$('pathMorphType').value] || null,
                getPathMorphDefaults($('pathMorphType').value),
            );
            updateLetterWarning();
            updatePathWarning();
            state.backgroundLayers = [];
            state.activeBackgroundIndex = null;
            state.knockout = makeDefaultKnockout();
            state.knockoutEnabled = false;
            state.backgroundMode = 'layers';
            const bgModeLayersRadio = document.getElementById('bgModeLayers');
            const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
            if (bgModeLayersRadio) bgModeLayersRadio.checked = true;
            if (bgModeKnockoutRadio) bgModeKnockoutRadio.checked = false;
            renderBackgroundLayers();
            renderKnockoutControls();
            updateBackgroundVisibility();
            renderVariants();
            setStatus('Новый вариант');
        });

        frameRateSelect.addEventListener('change', () => {
            updateDurationRange();
        });
        durationSlider.addEventListener('input', () => {
            setDurationValue(parseInt(durationSlider.value || '0', 10) || 0);
        });
        durationInput.addEventListener('input', () => {
            setDurationValue(parseInt(durationInput.value || '0', 10) || 0);
        });
        const fontSelectEl = $('fontFile');
        if (fontSelectEl) {
            fontSelectEl.addEventListener('change', updateFontFilePreview);
        }
        const previewTextInput = $('previewText');
        if (previewTextInput) {
            previewTextInput.addEventListener('input', updateFontFilePreview);
        }

        $('refreshBtn').addEventListener('click', refreshVariants);
        $('saveBtn').addEventListener('click', saveCurrentVariant);
        $('previewBtn').addEventListener('click', previewCurrent);

        $('transformType').addEventListener('change', () => {
            const type = $('transformType').value;
            renderParams(
                $('transformParams'),
                transformSchema[type] || {},
                {},
                transformParamMeta[type] || null,
                getTransformDefaults(type),
            );
        });
        $('colorType').addEventListener('change', () => {
            const type = $('colorType').value;
            if (!type) {
                renderColorParams($('colorParams'), type, {});
                return;
            }
            const defaults = getColorDefaults(type) || defaultFillColorParams();
            renderColorParams($('colorParams'), type, defaults);
        });
        $('strokeType').addEventListener('change', () => {
            const type = $('strokeType').value;
            if (!type) {
                renderColorParams($('strokeParams'), type, {}, { isStroke: true });
                return;
            }
            const defaults = getColorDefaults(type) || defaultStrokeColorParams();
            if (typeof defaults.strokeWidth !== 'number') {
                defaults.strokeWidth = 2;
            }
            renderColorParams($('strokeParams'), type, defaults, { isStroke: true });
        });
        $('letterType').addEventListener('change', () => {
            const type = $('letterType').value;
            renderParams(
                $('letterParams'),
                letterSchema[type] || {},
                {},
                letterParamMeta[type] || null,
                getLetterDefaults(type),
            );
            updateLetterWarning();
        });
        $('pathMorphType').addEventListener('change', () => {
            const type = $('pathMorphType').value;
            renderParams(
                $('pathMorphParams'),
                pathMorphSchema[type] || {},
                {},
                pathMorphParamMeta[type] || null,
                getPathMorphDefaults(type),
            );
            updatePathWarning();
        });
        const bgModeLayersRadio = document.getElementById('bgModeLayers');
        const bgModeKnockoutRadio = document.getElementById('bgModeKnockout');
        if (bgModeLayersRadio) {
            bgModeLayersRadio.addEventListener('change', () => {
                if (bgModeLayersRadio.checked) setBackgroundMode('layers');
            });
        }
        if (bgModeKnockoutRadio) {
            bgModeKnockoutRadio.addEventListener('change', () => {
                if (bgModeKnockoutRadio.checked) setBackgroundMode('knockout');
            });
        }
        $('addBackgroundLayerBtn').addEventListener('click', () => {
            if (state.backgroundMode !== 'layers') return;
            const options = getBackgroundTypeOptions();
            const firstType = (options[0] && options[0].value) || 'solid';
            const layer = makeDefaultBackgroundLayer(firstType);
            state.backgroundLayers = Array.isArray(state.backgroundLayers) ? state.backgroundLayers : [];
            state.backgroundLayers.push(layer);
            state.activeBackgroundIndex = state.backgroundLayers.length - 1;
            renderBackgroundLayers();
        });

        fillSelect($('transformType'), [
            { value: 'none', label: 'Нет' },
            { value: 'slideLoop', label: 'SlideLoop' },
            { value: 'scalePulse', label: 'ScalePulse' },
            { value: 'shakeLoop', label: 'ShakeLoop' },
            { value: 'bounce', label: 'Bounce' },
            { value: 'vibrate', label: 'Vibrate' },
        ]);
        fillSelect($('colorType'), [
            { value: '', label: '— Отключено —' },
            { value: 'none', label: 'None (статичный)' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        $('colorType').value = 'none';
        fillSelect($('strokeType'), [
            { value: '', label: '— Отключено —' },
            { value: 'none', label: 'None (статичный)' },
            { value: 'cycleRGB', label: 'CycleRGB' },
            { value: 'rainbow', label: 'Rainbow' },
        ]);
        $('strokeType').value = 'none';
        fillSelect($('letterType'), [
            { value: 'none', label: 'None' },
            { value: 'vibrate', label: 'Vibrate' },
            { value: 'typingFall', label: 'TypingFall' },
            { value: 'wave', label: 'Wave' },
            { value: 'zigzag', label: 'ZigZag' },
            { value: 'rotate', label: 'Rotate' },
        ]);
        fillSelect($('pathMorphType'), [
            { value: 'none', label: 'None' },
            { value: 'warp', label: 'Warp' },
            { value: 'warpAiry', label: 'WarpAiry' },
            { value: 'skewPulse', label: 'SkewPulse' },
            { value: 'skewSwing', label: 'SkewSwing' },
        ]);

        renderParams(
            $('transformParams'),
            transformSchema[$('transformType').value] || {},
            {},
            transformParamMeta[$('transformType').value] || null,
            getTransformDefaults($('transformType').value),
        );
        renderColorParams($('colorParams'), $('colorType').value, defaultFillColorParams());
        renderColorParams($('strokeParams'), $('strokeType').value, defaultStrokeColorParams(), { isStroke: true });
        renderParams(
            $('letterParams'),
            letterSchema[$('letterType').value] || {},
            {},
            letterParamMeta[$('letterType').value] || null,
            getLetterDefaults($('letterType').value),
        );
        renderParams(
            $('pathMorphParams'),
            pathMorphSchema[$('pathMorphType').value] || {},
            {},
            pathMorphParamMeta[$('pathMorphType').value] || null,
            getPathMorphDefaults($('pathMorphType').value),
        );
        updateLetterWarning();
        updatePathWarning();
        updateLetterWarning();
        updatePathWarning();
        updateDurationRange();
        setDurationValue(parseInt(durationInput.value || '0', 10) || 0);
        renderBackgroundLayers();
        renderKnockoutControls();
        updateBackgroundVisibility();
        updateTextAnimationsAvailability();
        try {
            const meta = await api('./api/meta');
            state.meta = meta;
            if (meta && Array.isArray(meta.fonts)) {
                const fontSelect = $('fontFile');
                fontSelect.innerHTML = '';
                meta.fonts.forEach((name) => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    fontSelect.appendChild(opt);
                });
                if (meta.defaults && meta.defaults.fontFile) {
                    fontSelect.value = meta.defaults.fontFile;
                }
                updateFontFilePreview();
            }
            if (meta && meta.defaults) {
                const widthEl = $('width');
                const heightEl = $('height');
                const fontSizeEl = $('fontSize');
                const frameRateEl = $('frameRate');
                const durationEl = $('duration');
                if (widthEl) widthEl.placeholder = String(meta.defaults.width);
                if (heightEl) heightEl.placeholder = String(meta.defaults.height);
                if (fontSizeEl) fontSizeEl.placeholder = String(meta.defaults.fontSize);
                if (frameRateEl) frameRateEl.placeholder = String(meta.defaults.frameRate);
                if (durationEl) durationEl.placeholder = String(meta.defaults.duration);
                frameRateSelect.value = meta.defaults.frameRate === 30 ? '30' : '60';
                updateDurationRange();
                setDurationValue(meta.defaults.duration ?? 0);
            }
            renderBackgroundLayers();
            renderKnockoutControls();
            updateBackgroundVisibility();
        } catch (err) {
            console.error('Failed to load meta', err);
        }

        await refreshVariants();
        state.initialized = true;
    }

    window.addEventListener('DOMContentLoaded', init);
})();
